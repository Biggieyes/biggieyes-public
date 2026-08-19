const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function envBool(name, fallback = false) {
  const raw = env(name, "");
  if (raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function loadJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadAddresses(root) {
  return {
    ...loadJson(path.resolve(root, "addresses.master.json")),
    ...loadJson(path.resolve(root, "addresses.visibility.polygon.json")),
    ...loadJson(path.resolve(root, "addresses.tokenomics.phase1.polygon.json")),
    ...loadJson(path.resolve(root, "addresses.tokenomics.phase2.polygon.json")),
  };
}

async function txMaybe(report, execute, label, shouldRun, sendTx) {
  if (!(await shouldRun())) {
    report.unchanged.push(label);
    return;
  }
  if (!execute) {
    report.actions.push({ label, dryRun: true });
    return;
  }
  const tx = await sendTx();
  console.log(`[TX] ${label}: ${tx.hash}`);
  const rc = await tx.wait();
  report.actions.push({ label, tx: tx.hash, status: rc.status, blockNumber: rc.blockNumber });
}

async function main() {
  const root = path.resolve(__dirname, "../..");
  const A = loadAddresses(root);
  const chain = await ethers.provider.getNetwork();
  if (network.name === "polygon" && chain.chainId !== 137) {
    throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);
  }

  const execute = envBool("EXECUTE_TOKENOMICS_ACTIVATION", false);
  const compromisedOwner = ethers.utils.isAddress(env("COMPROMISED_OWNER_ADDRESS"))
    ? ethers.utils.getAddress(env("COMPROMISED_OWNER_ADDRESS"))
    : ethers.constants.AddressZero;
  const signers = await ethers.getSigners();
  const deployer = signers[0] || null;
  if (execute && !deployer) {
    throw new Error("EXECUTE_TOKENOMICS_ACTIVATION requires a local signer.");
  }
  if (execute && compromisedOwner !== ethers.constants.AddressZero && deployer.address === compromisedOwner) {
    throw new Error("Refusing tokenomics activation transaction from COMPROMISED_OWNER_ADDRESS");
  }
  const activateAll = envBool("ACTIVATE_ALL_KEEPERS", false);
  const confirmed = envBool("I_UNDERSTAND_KEEPERS_GO_LIVE", false);
  const flags = {
    enableLiquidityOrchestrator: envBool("ENABLE_LIQUIDITY_ORCHESTRATOR", activateAll),
    enableLiquidityKeeper: envBool("ENABLE_LIQUIDITY_KEEPER", activateAll),
    // Drip is executed by BuybackAgent after a successful buyback. The legacy
    // standalone proxy must not be included in ACTIVATE_ALL_KEEPERS.
    enableDripKeeper: envBool("ENABLE_DRIP_KEEPER", false),
    enableBuybackUpkeep: envBool("ENABLE_BUYBACK_UPKEEP", activateAll),
    enableAutoBuyback: envBool("ENABLE_AUTO_BUYBACK", activateAll),
    enableLmAutoTopUp: envBool("ENABLE_LM_AUTO_TOPUP", false),
  };
  const report = {
    network: network.name,
    chainId: chain.chainId,
    createdAt: new Date().toISOString(),
    execute,
    flags,
    actions: [],
    unchanged: [],
    blockers: [],
    values: {},
  };

  const token = await ethers.getContractAt(["function distributed() view returns (bool)", "function totalSupply() view returns (uint256)"], A.BIGGI_TOKEN);
  const pair = await ethers.getContractAt(["function getReserves() view returns (uint112,uint112,uint32)", "function totalSupply() view returns (uint256)"], A.PAIR);
  const supplyController = await ethers.getContractAt(["function snapshotBaseline() external"], A.SUPPLY_CONTROLLER);
  const dexGuard = await ethers.getContractAt(["function snapshotBaseline() external"], A.DEX_RESERVE_GUARD);
  const orchestrator = await ethers.getContractAt(["function paused() view returns (bool)", "function unpauseAll() external"], A.LIQUIDITY_ORCHESTRATOR);
  const keeper = await ethers.getContractAt(["function paused() view returns (bool)", "function unpauseAll() external"], A.LIQUIDITY_KEEPER_PROXY);
  const dripKeeper = await ethers.getContractAt(["function paused() view returns (bool)", "function unpause() external"], A.DRIP_KEEPER_PROXY);
  const buybackUpkeep = await ethers.getContractAt(["function paused() view returns (bool)", "function setPaused(bool) external"], A.BUYBACK_UPKEEP_PROXY);
  const buyback = await ethers.getContractAt(["function autoBuybackEnabled() view returns (bool)", "function toggleAutoBuyback(bool) external"], A.BUYBACK_AGENT);
  const lm = await ethers.getContractAt(
    [
      "function autoTopUpEnabled() view returns (bool)",
      "function setAutoTopUpConfig(bool,uint256,uint256) external",
    ],
    A.LIQUIDITY_MANAGER
  );

  const [distributed, totalSupply, reserves, lpSupply] = await Promise.all([
    token.distributed(),
    token.totalSupply(),
    pair.getReserves(),
    pair.totalSupply(),
  ]);
  report.values = {
    distributed,
    totalSupply: totalSupply.toString(),
    pairReserve0: reserves[0].toString(),
    pairReserve1: reserves[1].toString(),
    pairLpSupply: lpSupply.toString(),
  };

  if (!distributed || totalSupply.eq(0)) report.blockers.push("BIGGI initial distribution is not executed.");
  if (reserves[0].eq(0) || reserves[1].eq(0) || lpSupply.eq(0)) report.blockers.push("PAIR has no liquidity.");
  if (flags.enableDripKeeper) {
    report.blockers.push("DRIP_KEEPER_PROXY must remain paused; BuybackAgent triggers drip directly.");
  }
  if (execute && !confirmed) report.blockers.push("Set I_UNDERSTAND_KEEPERS_GO_LIVE=1 to execute activation.");

  if (report.blockers.length === 0) {
    await txMaybe(report, execute, "SupplyController.snapshotBaseline", async () => true, () => supplyController.snapshotBaseline());
    await txMaybe(report, execute, "DexReserveGuard.snapshotBaseline", async () => true, () => dexGuard.snapshotBaseline());

    if (flags.enableLiquidityOrchestrator) {
      await txMaybe(report, execute, "LiquidityOrchestrator.unpauseAll", () => orchestrator.paused(), () => orchestrator.unpauseAll());
    }
    if (flags.enableLiquidityKeeper) {
      await txMaybe(report, execute, "LiquidityKeeperProxy.unpauseAll", () => keeper.paused(), () => keeper.unpauseAll());
    }
    if (flags.enableDripKeeper) {
      await txMaybe(report, execute, "DripKeeperProxy.unpause", () => dripKeeper.paused(), () => dripKeeper.unpause());
    }
    if (flags.enableBuybackUpkeep) {
      await txMaybe(report, execute, "BuybackUpkeepProxy.setPaused(false)", () => buybackUpkeep.paused(), () => buybackUpkeep.setPaused(false));
    }
    if (flags.enableAutoBuyback) {
      await txMaybe(report, execute, "BuybackAgent.toggleAutoBuyback(true)", async () => !(await buyback.autoBuybackEnabled()), () => buyback.toggleAutoBuyback(true));
    }
    if (flags.enableLmAutoTopUp) {
      await txMaybe(
        report,
        execute,
        "LiquidityManager.setAutoTopUpConfig(true,...)",
        async () => !(await lm.autoTopUpEnabled()),
        () =>
          lm.setAutoTopUpConfig(
            true,
            ethers.utils.parseEther(env("LIQ_AUTO_TRIGGER_MIN_POL", "5")),
            ethers.utils.parseEther(env("LIQ_AUTO_REQUEST_POL", "5"))
          )
      );
    }
  }

  const reportFile = path.resolve(root, env("TOKENOMICS_ACTIVATION_REPORT", "reports/tokenomics-activation-polygon.json"));
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ execute, blockers: report.blockers.length, actions: report.actions.length, report: reportFile }, null, 2));

  if (execute && report.blockers.length > 0) {
    throw new Error(`Tokenomics activation blocked. See ${reportFile}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
