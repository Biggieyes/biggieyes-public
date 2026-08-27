import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ARTIFACT_ROOT = path.join(
  ROOT,
  "biggi-project",
  "bekend",
  "artifacts-master",
  "contracts",
  "default_workspace (10)",
  "contracts",
  "BIGGI_MASTER",
);
const CORE_ABI_ROOT = path.join(
  ROOT,
  "biggi-project",
  "bekend",
  "contracts",
  "default_workspace (10)",
  "contracts",
  "BIGGI_MASTER",
  "CORE",
  "CORE_ABI",
);
const OUT_DIRS = [
  path.join(ROOT, "src", "config", "abi"),
  path.join(ROOT, "public-repo", "src", "config", "abi"),
];

const ARTIFACT_OUTPUT_MAP = {
  BiggiBuybackAgent: "BiggiBuybackAgent",
  BiggiBuybackReader: "BiggiBuybackReader",
  BiggiBuybackDripSetup: "BiggiBuybackDripSetup",
  BiggiCollectionRewards: "BiggiCollectionRewards",
  BiggiCommunityCenter: "BiggiCommunityCenter",
  BiggiCompute: "BiggiCompute",
  BiggiDripDistributor: "BiggiDripDistributor",
  BiggiDRIPDistributor: "BiggiDripDistributor",
  DripKeeperProxy: "DripKeeperProxy",
  BiggiDRIPKeeper: "DripKeeperProxy",
  BiggiDripLMToModerator: "BiggiDripLMToModerator",
  BiggiDripLMToModeratorV2: "BiggiDripLMToModeratorV2",
  BiggiDRIPLM: "BiggiDripLMToModerator",
  BiggiLiquidityBranchUserReader: "BiggiLiquidityBranchUserReader",
  BiggiLiquidityHelperReader: "BiggiLiquidityHelperReader",
  BiggiLiquidityManager: "BiggiLiquidityManager",
  BiggiLpPriceFeed: "BiggiLpPriceFeed",
  BiggiReserveTreasuryReader: "BiggiReserveTreasuryReader",
  BiggiReserveV4: "BiggiReserveV4",
  BiggiToken: "BiggiToken",
  BiggiTokenomikReader: "BiggiTokenomikReader",
  BiggiTokenRewardsReader: "BiggiTokenRewardsReader",
  BiggiTreasury: "BiggiTreasury",
  BiggiBuybackUpkeepProxy: "BiggiBuybackUpkeepProxy",
  BiggiUpkeeperProxy: "BiggiBuybackUpkeepProxy",
  BiggiVRFRouter: "BiggiVRFRouter",
  LiquidityAutomation: "LiquidityAutomation",
  LiquidityKeeperProxy: "BiggiLiquidityKeeperProxy",
  LiquidityVault: "LiquidityVault",
  ModeratorCenter: "ModeratorCenter",
  ModeratorCenterV2: "ModeratorCenterV2",
  BiggiDexReserveGuard: "BiggiDexReserveGuard",
  BiggiDexReserveGuardReader: "BiggiDexReserveGuardReader",
  BiggiSupplyController: "BiggiSupplyController",
  BiggiSupplyControllerReader: "BiggiSupplyControllerReader",
  BiggiSupplyGuardian: "BiggiSupplyGuardian",
  BiggiSupplyGuardianReader: "BiggiSupplyGuardianReader",
  BiggiSystemReader: "BiggiSystemReader",
  BiggiTokenomicsSystemAddonReader: "BiggiTokenomicsSystemAddonReader",
  Multicall2: "Multicall2",
};

const EXTRA_ARTIFACT_OUTPUTS = {
  BiggiLiquidityOrchestrator: "BiggiLiquidityOrchestrator",
  BiggiMasterTokenomicsConfig: "BiggiMasterTokenomicsConfig",
  LiquiditySetup: "LiquiditySetup",
};

// External DEX interfaces and the legacy reader have no BIGGI_MASTER artifact.
// Keep their reviewed frontend snapshots mirrored between both trees.
const PRESERVED_OUTPUTS = [
  "BiggiMultiCollectionDistributorReader",
  "UniswapV2Factory",
  "UniswapV2Pair",
  "UniswapV2Router02",
  "WETH9",
];

const CORE_OUTPUT_MAP = {
  BiggiMain: "BiggiEyesMain.abi.json",
  BiggiMain2: "BiggiEyesMain2.abi.json",
  BiggiTicketHub: "BiggiTicketHub.abi.json",
  BiggiSeriesRegistry: "BiggiSeriesRegistry.abi.json",
  BiggiChapterController: "BiggiChapterController.abi.json",
  BiggiCompute: "BiggiCompute.abi.json",
  BiggiCollectionRewards: "BiggiCollectionRewards.abi.json",
  BiggiTokenRewards: "BiggiTokenRewards.abi.json",
  BiggiNftRewards: "BiggiNFTRewards.abi.json",
  BiggiVRFRouter: "BiggiVRFRouter.abi.json",
  BiggiMultiCollectionDistributor: "BiggiMultiCollectionDistributor.abi.json",
  BiggiMainReader: "BiggiMainReader.abi.json",
  BiggiChapterSeriesReader: "BiggiChapterSeriesReader.abi.json",
  BiggiMultiCollectionDistributorReaderV2:
    "BiggiMultiCollectionDistributorReaderV2.abi.json",
  BiggiNftRewardsReader: "BiggiNftRewardsReader.abi.json",
};

function collectJsonFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsonFiles(full, out);
      continue;
    }
    if (!entry.name.endsWith(".json") || entry.name.endsWith(".dbg.json")) {
      continue;
    }
    out.push(full);
  }
  return out;
}

function loadArtifacts() {
  const byName = new Map();
  for (const file of collectJsonFiles(ARTIFACT_ROOT)) {
    try {
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      const name = json.contractName || path.basename(file, ".json");
      if (Array.isArray(json.abi)) byName.set(name, json.abi);
    } catch {
      // Ignore unrelated malformed artifact files.
    }
  }
  return byName;
}

function writeAbi(outName, abi) {
  if (!Array.isArray(abi)) return false;
  for (const outDir of OUT_DIRS) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, `${outName}.json`),
      `${JSON.stringify(abi, null, 2)}\n`,
    );
  }
  return true;
}

function readCoreAbi(fileName) {
  const file = path.join(CORE_ABI_ROOT, fileName);
  if (!fs.existsSync(file)) return null;
  const abi = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(abi) ? abi : null;
}

function main() {
  if (!fs.existsSync(ARTIFACT_ROOT)) {
    throw new Error(`Artifact folder not found: ${ARTIFACT_ROOT}`);
  }
  if (!fs.existsSync(CORE_ABI_ROOT)) {
    throw new Error(`CORE ABI folder not found: ${CORE_ABI_ROOT}`);
  }

  const artifacts = loadArtifacts();
  const missing = [];
  let synced = 0;

  for (const [outName, contractName] of Object.entries({
    ...ARTIFACT_OUTPUT_MAP,
    ...EXTRA_ARTIFACT_OUTPUTS,
  })) {
    if (writeAbi(outName, artifacts.get(contractName))) synced += 1;
    else missing.push(`${outName} <- ${contractName}`);
  }

  // Current CORE ABI snapshots override older mainnet-source artifacts.
  for (const [outName, fileName] of Object.entries(CORE_OUTPUT_MAP)) {
    if (writeAbi(outName, readCoreAbi(fileName))) synced += 1;
    else missing.push(`${outName} <- CORE_ABI/${fileName}`);
  }

  for (const outName of PRESERVED_OUTPUTS) {
    const source = path.join(OUT_DIRS[0], `${outName}.json`);
    if (!fs.existsSync(source)) {
      missing.push(`${outName} <- reviewed frontend snapshot`);
      continue;
    }
    const abi = JSON.parse(fs.readFileSync(source, "utf8"));
    if (writeAbi(outName, abi)) synced += 1;
    else missing.push(`${outName} <- reviewed frontend snapshot`);
  }

  if (missing.length) {
    throw new Error(`Missing ABI sources: ${missing.join(", ")}`);
  }

  console.log(
    `Synced ${synced} ABI mappings into ${OUT_DIRS.length} frontend trees.`,
  );
}

main();
