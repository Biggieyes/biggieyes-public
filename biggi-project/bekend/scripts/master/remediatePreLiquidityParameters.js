const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const {
  addressFromKey,
  loadProductionConfig,
  validateProductionConfig,
} = require("./lib/productionActivationPlan");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const MIN_SAFE_BUYBACK_THRESHOLD = ethers.utils.parseEther("0.001");

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function envBool(name, fallback = false) {
  const raw = env(name);
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function serializeError(error) {
  return error?.reason || error?.error?.message || error?.message || String(error);
}

function sameAddress(a, b) {
  try {
    return ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
  } catch {
    return false;
  }
}

function writeReport(root, report) {
  const reportFile = path.resolve(root, "reports/pre-liquidity-remediation-polygon.json");
  const evidenceFile = path.resolve(
    root,
    "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/FOR_SUPPORT/EVIDENCE/pre-liquidity-remediation-polygon.json"
  );
  const body = `${JSON.stringify(report, null, 2)}\n`;
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.mkdirSync(path.dirname(evidenceFile), { recursive: true });
  fs.writeFileSync(reportFile, body);
  fs.writeFileSync(evidenceFile, body);
  let executionFile = null;
  if (report.execute && report.transactions.length > 0) {
    executionFile = path.resolve(root, "reports/pre-liquidity-remediation-execution-polygon.json");
    const executionEvidenceFile = path.resolve(
      root,
      "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/FOR_SUPPORT/EVIDENCE/pre-liquidity-remediation-execution-polygon.json"
    );
    fs.writeFileSync(executionFile, body);
    fs.writeFileSync(executionEvidenceFile, body);
  }
  return { reportFile, executionFile };
}

async function readState(buyback, liquidityManager) {
  const [
    buybackOwner,
    buybackPaused,
    buybackThreshold,
    liquidityManagerOwner,
    autoTopUpEnabled,
    autoTriggerMinPolWei,
    autoRequestPolWei,
  ] = await Promise.all([
    buyback.owner(),
    buyback.paused(),
    buyback.minNativeThresholdWei(),
    liquidityManager.owner(),
    liquidityManager.autoTopUpEnabled(),
    liquidityManager.autoTriggerMinPolWei(),
    liquidityManager.autoRequestPolWei(),
  ]);

  return {
    buyback: {
      owner: buybackOwner,
      paused: buybackPaused,
      minNativeThresholdWei: buybackThreshold.toString(),
    },
    liquidityManager: {
      owner: liquidityManagerOwner,
      autoTopUpEnabled,
      autoTriggerMinPolWei: autoTriggerMinPolWei.toString(),
      autoRequestPolWei: autoRequestPolWei.toString(),
    },
  };
}

async function main() {
  const root = path.resolve(__dirname, "../..");
  const chain = await ethers.provider.getNetwork();
  if (network.name !== "polygon" || chain.chainId !== 137) {
    throw new Error(`Expected Polygon mainnet (chainId 137), got ${network.name}/${chain.chainId}`);
  }

  const execute = envBool("EXECUTE_PRE_LIQUIDITY_REMEDIATION");
  const acknowledged = envBool("I_UNDERSTAND_PRE_LIQUIDITY_REMEDIATION");
  const addresses = loadJson(path.resolve(root, "addresses.master.json"));
  const { file: configFile, config } = loadProductionConfig(root);
  const { owner: expectedOwner } = validateProductionConfig(config, addresses);
  const buybackAddress = addressFromKey(addresses, config.tokenomics.buybackUpkeep.addressKey);
  const liquidityManagerAddress = addressFromKey(addresses, config.tokenomics.liquidityManager.addressKey);
  const desiredThreshold = ethers.BigNumber.from(config.tokenomics.buybackUpkeep.minNativeThresholdWei);
  const desiredAutoEnabled = config.tokenomics.liquidityManager.autoTopUpEnabled;
  const desiredAutoTrigger = ethers.BigNumber.from(config.tokenomics.liquidityManager.autoTriggerMinPolWei);
  const desiredAutoRequest = ethers.BigNumber.from(config.tokenomics.liquidityManager.autoRequestPolWei);

  const buybackInterface = new ethers.utils.Interface([
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function minNativeThresholdWei() view returns (uint256)",
    "function setThreshold(uint256)",
  ]);
  const liquidityManagerInterface = new ethers.utils.Interface([
    "function owner() view returns (address)",
    "function autoTopUpEnabled() view returns (bool)",
    "function autoTriggerMinPolWei() view returns (uint256)",
    "function autoRequestPolWei() view returns (uint256)",
    "function setAutoTopUpConfig(bool,uint256,uint256)",
  ]);
  const buyback = new ethers.Contract(buybackAddress, buybackInterface, ethers.provider);
  const liquidityManager = new ethers.Contract(liquidityManagerAddress, liquidityManagerInterface, ethers.provider);
  const before = await readState(buyback, liquidityManager);
  const report = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    network: network.name,
    chainId: chain.chainId,
    sourceBlock: await ethers.provider.getBlockNumber(),
    configFile: path.relative(root, configFile).replaceAll("\\", "/"),
    execute,
    expectedOwner,
    contracts: {
      buybackUpkeepProxy: buybackAddress,
      liquidityManager: liquidityManagerAddress,
    },
    desired: {
      buybackThresholdWei: desiredThreshold.toString(),
      liquidityManager: {
        autoTopUpEnabled: desiredAutoEnabled,
        autoTriggerMinPolWei: desiredAutoTrigger.toString(),
        autoRequestPolWei: desiredAutoRequest.toString(),
      },
    },
    before,
    plannedActions: [],
    transactions: [],
    blockers: [],
    errors: [],
  };

  const [buybackCode, liquidityManagerCode] = await Promise.all([
    ethers.provider.getCode(buybackAddress),
    ethers.provider.getCode(liquidityManagerAddress),
  ]);
  if (buybackCode === "0x") report.blockers.push("BuybackUpkeepProxy has no bytecode");
  if (liquidityManagerCode === "0x") report.blockers.push("LiquidityManager has no bytecode");
  if (!sameAddress(before.buyback.owner, expectedOwner)) {
    report.blockers.push(`BuybackUpkeepProxy owner mismatch: ${before.buyback.owner}`);
  }
  if (!sameAddress(before.liquidityManager.owner, expectedOwner)) {
    report.blockers.push(`LiquidityManager owner mismatch: ${before.liquidityManager.owner}`);
  }
  if (!before.buyback.paused) {
    report.blockers.push("BuybackUpkeepProxy must remain paused during pre-liquidity remediation");
  }
  if (before.liquidityManager.autoTopUpEnabled) {
    report.blockers.push("LiquidityManager auto top-up must be disabled during pre-liquidity remediation");
  }
  if (desiredThreshold.lt(MIN_SAFE_BUYBACK_THRESHOLD)) {
    report.blockers.push("Canonical buyback threshold is below the 0.001 POL safety floor");
  }
  if (desiredAutoEnabled !== false || desiredAutoTrigger.isZero() || desiredAutoRequest.isZero()) {
    report.blockers.push("Canonical pre-liquidity LiquidityManager configuration is invalid");
  }

  if (!ethers.BigNumber.from(before.buyback.minNativeThresholdWei).eq(desiredThreshold)) {
    report.plannedActions.push({
      id: "buyback-threshold",
      to: buybackAddress,
      value: "0",
      method: "setThreshold(uint256)",
      args: [desiredThreshold.toString()],
      data: buybackInterface.encodeFunctionData("setThreshold", [desiredThreshold]),
    });
  }
  if (
    before.liquidityManager.autoTopUpEnabled !== desiredAutoEnabled ||
    !ethers.BigNumber.from(before.liquidityManager.autoTriggerMinPolWei).eq(desiredAutoTrigger) ||
    !ethers.BigNumber.from(before.liquidityManager.autoRequestPolWei).eq(desiredAutoRequest)
  ) {
    report.plannedActions.push({
      id: "liquidity-manager-auto-topup-config",
      to: liquidityManagerAddress,
      value: "0",
      method: "setAutoTopUpConfig(bool,uint256,uint256)",
      args: [desiredAutoEnabled, desiredAutoTrigger.toString(), desiredAutoRequest.toString()],
      data: liquidityManagerInterface.encodeFunctionData("setAutoTopUpConfig", [
        desiredAutoEnabled,
        desiredAutoTrigger,
        desiredAutoRequest,
      ]),
    });
  }

  for (const action of report.plannedActions) {
    try {
      const request = { from: expectedOwner, to: action.to, value: 0, data: action.data };
      await ethers.provider.call(request);
      const estimatedGas = await ethers.provider.estimateGas(request);
      action.simulation = "passed";
      action.estimatedGas = estimatedGas.toString();
    } catch (error) {
      action.simulation = "failed";
      action.error = serializeError(error);
      report.blockers.push(`${action.id} simulation failed: ${action.error}`);
    }
  }

  let signer = null;
  if (execute) {
    [signer] = await ethers.getSigners();
    if (!acknowledged) {
      report.blockers.push("Set I_UNDERSTAND_PRE_LIQUIDITY_REMEDIATION=1 before execution");
    }
    if (!signer) {
      report.blockers.push("No Polygon owner signer is configured");
    } else if (!sameAddress(signer.address, expectedOwner)) {
      report.blockers.push(`Configured signer ${signer.address} is not expected owner ${expectedOwner}`);
    }
    const compromised = env("COMPROMISED_OWNER_ADDRESS");
    if (signer && ethers.utils.isAddress(compromised) && sameAddress(signer.address, compromised)) {
      report.blockers.push("Refusing transaction from COMPROMISED_OWNER_ADDRESS");
    }
  }

  if (execute && report.blockers.length === 0) {
    for (const action of report.plannedActions) {
      try {
        const gasLimit = ethers.BigNumber.from(action.estimatedGas).mul(120).div(100);
        const tx = await signer.sendTransaction({
          to: action.to,
          value: 0,
          data: action.data,
          gasLimit,
        });
        const receipt = await tx.wait();
        if (receipt.status !== 1) throw new Error(`Transaction ${tx.hash} reverted`);
        report.transactions.push({
          id: action.id,
          hash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status,
        });
      } catch (error) {
        report.errors.push(`${action.id}: ${serializeError(error)}`);
        break;
      }
    }
  }

  report.after = await readState(buyback, liquidityManager);
  report.postconditions = {
    buybackThresholdCanonical: ethers.BigNumber.from(report.after.buyback.minNativeThresholdWei).eq(desiredThreshold),
    liquidityManagerCanonical:
      report.after.liquidityManager.autoTopUpEnabled === desiredAutoEnabled &&
      ethers.BigNumber.from(report.after.liquidityManager.autoTriggerMinPolWei).eq(desiredAutoTrigger) &&
      ethers.BigNumber.from(report.after.liquidityManager.autoRequestPolWei).eq(desiredAutoRequest),
    buybackStillPaused: report.after.buyback.paused,
    liquidityManagerStillDisabled: report.after.liquidityManager.autoTopUpEnabled === false,
  };
  report.complete = Object.values(report.postconditions).every(Boolean);
  report.okForExecution = report.blockers.length === 0 && report.errors.length === 0;
  const { reportFile, executionFile } = writeReport(root, report);

  console.log(JSON.stringify({
    execute,
    plannedActions: report.plannedActions.length,
    submittedTransactions: report.transactions.length,
    blockers: report.blockers.length,
    errors: report.errors.length,
    complete: report.complete,
    report: reportFile,
    executionReport: executionFile,
  }, null, 2));

  if (report.blockers.length || report.errors.length) {
    throw new Error(`Pre-liquidity remediation failed. See ${reportFile}`);
  }
  if (execute && !report.complete) {
    throw new Error(`Pre-liquidity remediation postconditions failed. See ${reportFile}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
