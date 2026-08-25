import {
  cre,
  bytesToHex,
  encodeCallMsg,
  EVMClient,
  getNetwork,
  LAST_FINALIZED_BLOCK_NUMBER,
  prepareReportRequest,
  Runner,
  TxStatus,
  type Runtime,
} from "@chainlink/cre-sdk";
import {
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "invalid EVM address");
const hexSchema = z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/, "invalid hex bytes");
const gasLimitSchema = z
  .string()
  .regex(/^\d+$/, "gas limit must be an integer")
  .refine((value) => BigInt(value) > 0n && BigInt(value) <= 5_000_000n, "gas limit must be 1..5000000");

const targetSchema = z.object({
  name: z.string().min(1),
  address: addressSchema,
  kind: z.enum(["AUTOMATION", "WEEK_ROLL"]),
  enabled: z.boolean(),
  checkData: hexSchema.optional(),
  writeGasLimit: gasLimitSchema.optional(),
});

const configSchema = z.object({
  chainSelectorName: z.string(),
  receiverAddress: addressSchema,
  schedule: z.string(),
  dryRun: z.boolean(),
  targets: z.array(targetSchema).min(1),
});
type Config = z.infer<typeof configSchema>;
type TargetConfig = z.infer<typeof targetSchema>;

const emissionControllerAbi = [
  {
    type: "function",
    name: "currentWeek",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "weekState",
    stateMutability: "view",
    inputs: [{ name: "weekId", type: "uint64" }],
    outputs: [
      { name: "initialized", type: "bool" },
      { name: "observedBiggiInflow", type: "uint256" },
      { name: "tokenRewardsBalance", type: "uint256" },
      { name: "budget", type: "uint256" },
      { name: "paid", type: "uint256" },
      { name: "unitReward", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "rollCurrentWeek",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "weekId", type: "uint64" }],
  },
] as const;

const automationCompatibleAbi = [
  {
    type: "function",
    name: "checkUpkeep",
    stateMutability: "view",
    inputs: [{ name: "checkData", type: "bytes" }],
    outputs: [
      { name: "upkeepNeeded", type: "bool" },
      { name: "performData", type: "bytes" },
    ],
  },
  {
    type: "function",
    name: "performUpkeep",
    stateMutability: "nonpayable",
    inputs: [{ name: "performData", type: "bytes" }],
    outputs: [],
  },
] as const;

function assertConfiguredAddress(value: string | undefined, fieldName: string): asserts value is Address {
  if (!value || value.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`${fieldName} must be configured with a deployed contract address`);
  }
}

function readContract(
  runtime: Runtime<Config>,
  client: EVMClient,
  address: Address,
  data: Hex,
): Hex {
  const result = client.callContract(runtime, {
    call: encodeCallMsg({ from: zeroAddress, to: address, data }),
    blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
  }).result();
  return bytesToHex(result.data);
}

function buildWeekRollCall(runtime: Runtime<Config>, client: EVMClient, address: Address): Hex | null {
  const currentWeekData = encodeFunctionData({
    abi: emissionControllerAbi,
    functionName: "currentWeek",
  });
  const weekId = decodeFunctionResult({
    abi: emissionControllerAbi,
    functionName: "currentWeek",
    data: readContract(runtime, client, address, currentWeekData),
  });

  const weekStateData = encodeFunctionData({
    abi: emissionControllerAbi,
    functionName: "weekState",
    args: [weekId],
  });
  const weekState = decodeFunctionResult({
    abi: emissionControllerAbi,
    functionName: "weekState",
    data: readContract(runtime, client, address, weekStateData),
  });

  if (weekState[0]) return null;
  return encodeFunctionData({
    abi: emissionControllerAbi,
    functionName: "rollCurrentWeek",
  });
}

function buildTargetCall(runtime: Runtime<Config>, client: EVMClient, target: TargetConfig): Hex | null {
  const address = target.address as Address;
  if (target.kind === "WEEK_ROLL") {
    return buildWeekRollCall(runtime, client, address);
  }

  const checkCall = encodeFunctionData({
    abi: automationCompatibleAbi,
    functionName: "checkUpkeep",
    args: [(target.checkData ?? "0x") as Hex],
  });
  const [needed, performData] = decodeFunctionResult({
    abi: automationCompatibleAbi,
    functionName: "checkUpkeep",
    data: readContract(runtime, client, address, checkCall),
  });
  if (!needed) return null;

  return encodeFunctionData({
    abi: automationCompatibleAbi,
    functionName: "performUpkeep",
    args: [performData],
  });
}

function writeTargetReport(
  runtime: Runtime<Config>,
  client: EVMClient,
  receiverAddress: Address,
  target: TargetConfig,
  callData: Hex,
): string {
  const reportPayload = encodeAbiParameters(
    [{ name: "target", type: "address" }, { name: "callData", type: "bytes" }],
    [target.address as Address, callData],
  );
  const report = runtime.report(prepareReportRequest(reportPayload)).result();
  const result = client.writeReport(runtime, {
    receiver: receiverAddress,
    report,
    gasConfig: { gasLimit: target.writeGasLimit ?? "900000" },
  }).result();

  if (result.txStatus !== TxStatus.SUCCESS) {
    throw new Error(result.errorMessage || `writeReport status ${result.txStatus}`);
  }
  return bytesToHex(result.txHash || new Uint8Array(32));
}

const runAutomation = (runtime: Runtime<Config>): string => {
  const config = runtime.config;
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: config.chainSelectorName });
  if (!network) throw new Error(`Network not found: ${config.chainSelectorName}`);
  if (!config.dryRun) assertConfiguredAddress(config.receiverAddress, "receiverAddress");

  const client = new EVMClient(network.chainSelector.selector);
  let needed = 0;
  let submitted = 0;
  let failed = 0;
  let enabled = 0;

  for (const target of config.targets) {
    if (!target.enabled) continue;
    enabled += 1;
    try {
      assertConfiguredAddress(target.address, `${target.name}.address`);
      const callData = buildTargetCall(runtime, client, target);
      if (!callData) {
        runtime.log(`[${target.name}] no action needed`);
        continue;
      }

      needed += 1;
      if (config.dryRun) {
        runtime.log(`[${target.name}] action needed; dry-run skipped write`);
        continue;
      }

      const txHash = writeTargetReport(
        runtime,
        client,
        config.receiverAddress as Address,
        target,
        callData,
      );
      submitted += 1;
      runtime.log(`[${target.name}] submitted ${txHash}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      runtime.log(`[${target.name}] failed: ${message}`);
    }
  }

  if (failed > 0) {
    throw new Error(`${failed} of ${enabled} enabled automation targets failed`);
  }
  return JSON.stringify({ needed, submitted, failed, dryRun: config.dryRun });
};

function initWorkflow(config: Config) {
  return [
    cre.handler(
      new cre.capabilities.CronCapability().trigger({ schedule: config.schedule }),
      runAutomation,
    ),
  ];
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
