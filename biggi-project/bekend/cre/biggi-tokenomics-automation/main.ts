import {
  bytesToHex,
  cre,
  encodeCallMsg,
  EVMClient,
  getNetwork,
  LAST_FINALIZED_BLOCK_NUMBER,
  Runner,
  type Runtime,
} from "@chainlink/cre-sdk";
import {
  decodeFunctionResult,
  encodeFunctionData,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "invalid EVM address");
const decimalStringSchema = z.string().regex(/^\d+$/, "must be a decimal integer string");

const configSchema = z.object({
  chainSelectorName: z.string().min(1),
  schedule: z.string().min(1),
  token: addressSchema,
  wpol: addressSchema,
  pair: addressSchema,
  pairWpolIsToken0: z.boolean(),
  reserve: addressSchema,
  treasury: addressSchema,
  buybackAgent: addressSchema,
  dripDistributor: addressSchema,
  dripLM: addressSchema,
  liquidityManager: addressSchema,
  liquidityVault: addressSchema,
  policy: z.object({
    minPairWpolReserveWei: decimalStringSchema,
    minPairBiggiReserveWei: decimalStringSchema,
    maxDripBpsOfPairReserve: z.number().int().min(0).max(10_000),
    maxBuybackBpsOfPairReserve: z.number().int().min(0).max(10_000),
  }),
});
type Config = z.infer<typeof configSchema>;

const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const pairAbi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
]);

const buybackAbi = parseAbi([
  "function autoBuybackEnabled() view returns (bool)",
  "function paused() view returns (bool)",
]);

const dripAbi = parseAbi([
  "function effectiveAvailable() view returns (uint256)",
  "function paused() view returns (bool)",
]);

const liquidityManagerAbi = parseAbi([
  "function autoTopUpEnabled() view returns (bool)",
]);

type PairState = {
  reserveWpolWei: bigint;
  reserveBiggiWei: bigint;
  lpTotalSupply: bigint;
  blockTimestampLast: number;
};

function assertConfiguredAddress(value: string, fieldName: string): asserts value is Address {
  if (!value || value.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(`${fieldName} must be configured with a deployed contract address`);
  }
}

function callContract(
  runtime: Runtime<Config>,
  client: EVMClient,
  address: Address,
  data: Hex,
): Hex {
  const result = client
    .callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: address, data }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result();
  return bytesToHex(result.data);
}

type ReadAbi =
  | typeof erc20Abi
  | typeof pairAbi
  | typeof buybackAbi
  | typeof dripAbi
  | typeof liquidityManagerAbi;

function readFunction(
  runtime: Runtime<Config>,
  client: EVMClient,
  address: Address,
  abi: ReadAbi,
  functionName: string,
  args: readonly unknown[] = [],
): unknown {
  const encode = encodeFunctionData as unknown as (params: {
    abi: unknown;
    functionName: string;
    args?: readonly unknown[];
  }) => Hex;
  const decode = decodeFunctionResult as unknown as (params: {
    abi: unknown;
    functionName: string;
    data: Hex;
  }) => unknown;

  const data = encode({
    abi,
    functionName,
    args,
  });
  return decode({
    abi,
    functionName,
    data: callContract(runtime, client, address, data),
  });
}

function readUint(
  runtime: Runtime<Config>,
  client: EVMClient,
  address: Address,
  abi: ReadAbi,
  functionName: string,
  args: readonly unknown[] = [],
): bigint {
  return readFunction(runtime, client, address, abi, functionName, args) as bigint;
}

function readBool(
  runtime: Runtime<Config>,
  client: EVMClient,
  address: Address,
  abi: typeof buybackAbi | typeof dripAbi | typeof liquidityManagerAbi,
  functionName: string,
): boolean {
  return readFunction(runtime, client, address, abi, functionName) as boolean;
}

function readPair(runtime: Runtime<Config>, client: EVMClient, config: Config): PairState {
  const reserves = readFunction(runtime, client, config.pair as Address, pairAbi, "getReserves") as readonly [
    bigint,
    bigint,
    number,
  ];
  const lpTotalSupply = readUint(runtime, client, config.pair as Address, pairAbi, "totalSupply");

  return {
    reserveWpolWei: config.pairWpolIsToken0 ? reserves[0] : reserves[1],
    reserveBiggiWei: config.pairWpolIsToken0 ? reserves[1] : reserves[0],
    lpTotalSupply,
    blockTimestampLast: Number(reserves[2]),
  };
}

function formatUnits18(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 1_000_000_000_000_000_000n;
  const fraction = (abs % 1_000_000_000_000_000_000n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

function bpsOf(value: bigint, bps: number): bigint {
  return (value * BigInt(bps)) / 10_000n;
}

const runTokenomicsHealth = (runtime: Runtime<Config>): string => {
  const config = runtime.config;
  for (const [field, value] of Object.entries({
    token: config.token,
    wpol: config.wpol,
    pair: config.pair,
    reserve: config.reserve,
    treasury: config.treasury,
    buybackAgent: config.buybackAgent,
    dripDistributor: config.dripDistributor,
    dripLM: config.dripLM,
    liquidityManager: config.liquidityManager,
    liquidityVault: config.liquidityVault,
  })) {
    assertConfiguredAddress(value, field);
  }

  const network = getNetwork({ chainFamily: "evm", chainSelectorName: config.chainSelectorName });
  if (!network) throw new Error(`Network not found: ${config.chainSelectorName}`);
  const client = new EVMClient(network.chainSelector.selector);

  const totalSupply = readUint(runtime, client, config.token as Address, erc20Abi, "totalSupply");
  const reserveBiggi = readUint(runtime, client, config.token as Address, erc20Abi, "balanceOf", [
    config.reserve,
  ]);
  const treasuryBiggi = readUint(runtime, client, config.token as Address, erc20Abi, "balanceOf", [
    config.treasury,
  ]);
  const buybackAgentBiggi = readUint(runtime, client, config.token as Address, erc20Abi, "balanceOf", [
    config.buybackAgent,
  ]);
  const dripDistributorBiggi = readUint(runtime, client, config.token as Address, erc20Abi, "balanceOf", [
    config.dripDistributor,
  ]);
  const reserveWpol = readUint(runtime, client, config.wpol as Address, erc20Abi, "balanceOf", [
    config.reserve,
  ]);
  const treasuryWpol = readUint(runtime, client, config.wpol as Address, erc20Abi, "balanceOf", [
    config.treasury,
  ]);
  const buybackAgentWpol = readUint(runtime, client, config.wpol as Address, erc20Abi, "balanceOf", [
    config.buybackAgent,
  ]);
  const pair = readPair(runtime, client, config);

  const dripPaused = readBool(runtime, client, config.dripDistributor as Address, dripAbi, "paused");
  const dripAvailable = readUint(runtime, client, config.dripDistributor as Address, dripAbi, "effectiveAvailable");
  const buybackAuto = readBool(runtime, client, config.buybackAgent as Address, buybackAbi, "autoBuybackEnabled");
  const buybackPaused = readBool(runtime, client, config.buybackAgent as Address, buybackAbi, "paused");
  const liquidityAutoTopUp = readBool(
    runtime,
    client,
    config.liquidityManager as Address,
    liquidityManagerAbi,
    "autoTopUpEnabled",
  );
  const minWpol = BigInt(config.policy.minPairWpolReserveWei);
  const minBiggi = BigInt(config.policy.minPairBiggiReserveWei);
  const hasPoolLiquidity = pair.reserveWpolWei >= minWpol && pair.reserveBiggiWei >= minBiggi && pair.lpTotalSupply > 0n;
  const hasBuybackBudget = buybackAgentWpol > 0n || treasuryWpol > 0n;
  const hasDripInventory = dripAvailable > 0n && dripDistributorBiggi > 0n && !dripPaused;

  const maxBuybackWpolWei = hasPoolLiquidity ? bpsOf(pair.reserveWpolWei, config.policy.maxBuybackBpsOfPairReserve) : 0n;
  const maxDripBiggiWei = hasPoolLiquidity ? bpsOf(pair.reserveBiggiWei, config.policy.maxDripBpsOfPairReserve) : 0n;
  const buybackAllowed = hasPoolLiquidity && hasBuybackBudget && buybackAuto && !buybackPaused && maxBuybackWpolWei > 0n;
  const dripOnBuyReady = hasPoolLiquidity && hasDripInventory && maxDripBiggiWei > 0n;
  const lmAllowed = hasPoolLiquidity && reserveWpol > 0n && reserveBiggi > 0n && liquidityAutoTopUp;

  const reasons: string[] = [];
  if (!hasPoolLiquidity) reasons.push("DEX pair has insufficient or zero BIGGI/WPOL liquidity");
  if (!hasBuybackBudget) reasons.push("No WPOL budget in BuybackAgent or Treasury");
  if (!buybackAuto) reasons.push("BuybackAgent auto buyback is disabled");
  if (buybackPaused) reasons.push("BuybackAgent is paused");
  if (!hasDripInventory) reasons.push("Drip inventory unavailable or DripDistributor paused");
  if (!liquidityAutoTopUp) reasons.push("LiquidityManager auto top-up is disabled");
  if (reserveWpol === 0n) reasons.push("Reserve has no WPOL for LP pairing");

  const decision = {
    timestamp: runtime.now().toISOString(),
    action: buybackAllowed || lmAllowed ? "READY_FOR_GUARDED_ACTION" : "NOOP",
    buybackAllowed,
    dripOnBuyReady,
    lmAllowed,
    reasons,
    pair: {
      pairWpolIsToken0: config.pairWpolIsToken0,
      reserveWpolWei: pair.reserveWpolWei.toString(),
      reserveWpol: formatUnits18(pair.reserveWpolWei),
      reserveBiggiWei: pair.reserveBiggiWei.toString(),
      reserveBiggi: formatUnits18(pair.reserveBiggiWei),
      lpTotalSupplyWei: pair.lpTotalSupply.toString(),
      blockTimestampLast: pair.blockTimestampLast,
    },
    balances: {
      totalSupplyBiggi: formatUnits18(totalSupply),
      reserveBiggi: formatUnits18(reserveBiggi),
      treasuryBiggi: formatUnits18(treasuryBiggi),
      buybackAgentBiggi: formatUnits18(buybackAgentBiggi),
      dripDistributorBiggi: formatUnits18(dripDistributorBiggi),
      reserveWpol: formatUnits18(reserveWpol),
      treasuryWpol: formatUnits18(treasuryWpol),
      buybackAgentWpol: formatUnits18(buybackAgentWpol),
    },
    drip: {
      triggerMode: "BUYBACK_SUCCESS_ONLY",
      standaloneCronBranch: false,
      paused: dripPaused,
      availableBiggi: formatUnits18(dripAvailable),
      maxRecommendedDripBiggi: formatUnits18(maxDripBiggiWei),
    },
    buyback: {
      autoBuybackEnabled: buybackAuto,
      paused: buybackPaused,
      maxRecommendedBuybackWpol: formatUnits18(maxBuybackWpolWei),
    },
    liquidity: {
      autoTopUpEnabled: liquidityAutoTopUp,
    },
  };

  runtime.log(`BIGGI tokenomics decision: ${decision.action}`);
  runtime.log(`BIGGI tokenomics reasons: ${reasons.join("; ") || "none"}`);
  runtime.log(`BIGGI/WPOL reserves: ${decision.pair.reserveWpol} WPOL / ${decision.pair.reserveBiggi} BIGGI`);
  return JSON.stringify(decision);
};

function initWorkflow(config: Config) {
  return [
    cre.handler(
      new cre.capabilities.CronCapability().trigger({ schedule: config.schedule }),
      runTokenomicsHealth,
    ),
  ];
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
