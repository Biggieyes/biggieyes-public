import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ARTIFACT_ROOT = path.join(
  ROOT,
  "biggi-project",
  "bekend",
  "artifacts",
  "contracts",
  "default_workspace (10)",
  "contracts",
  "BIGGIEYESOFFICIALTESTNET",
);
const OUT_DIR = path.join(ROOT, "src", "config", "abi");

const OUTPUT_MAP = {
  BiggiBuybackAgent: "BiggiBuybackAgent",
  BiggiBuybackReader: "BiggiBuybackReader",
  BiggiBuybackDripSetup: "BiggiBuybackDripSetup",
  BiggiCollectionRewards: "BiggiCollectionRewards",
  BiggiCommunityCenter: "BiggiCommunityCenter",
  BiggiCompute: "BiggiCompute",
  BiggiDRIPDistributor: "BiggiDripDistributor",
  BiggiDRIPKeeper: "DripKeeperProxy",
  BiggiDRIPLM: "BiggiDripLMToModerator",
  BiggiLiquidityBranchUserReader: "BiggiLiquidityBranchUserReader",
  BiggiLiquidityHelperReader: "BiggiLiquidityHelperReader",
  BiggiLiquidityManager: "BiggiLiquidityManager",
  BiggiLpPriceFeed: "BiggiLpPriceFeed",
  BiggiMain: "BiggiEyesMain",
  BiggiMain2: "BiggiEyesMain2",
  BiggiMainReader: "BiggiMainReader",
  BiggiMultiCollectionDistributor: "MultiCollectionDistributor",
  BiggiMultiCollectionDistributorReader: "BiggiMultiCollectionDistributorReader",
  BiggiMultiCollectionDistributorReaderV2: "BiggiMultiCollectionDistributorReaderV2",
  BiggiNftRewards: "BiggiNFTRewards",
  BiggiPolicy: "BiggiPolicy",
  BiggiReserveTreasuryReader: "BiggiReserveTreasuryReader",
  BiggiReserveV4: "BiggiReserveV4",
  BiggiToken: "BiggiToken",
  BiggiTokenomikReader: "BiggiTokenomikReader",
  BiggiTokenRewards: "BiggiTokenRewards",
  BiggiTreasury: "BiggiTreasury",
  BiggiUpkeeperProxy: "BiggiBuybackUpkeepProxy",
  BiggiVRFRouter: "BiggiVRFRouter",
  LiquidityAutomation: "LiquidityAutomation",
  LiquidityKeeperProxy: "BiggiLiquidityKeeperProxy",
  LiquidityVault: "LiquidityVault",
  ModeratorCenter: "ModeratorCenter",
  UniswapV2Factory: "UniswapV2Factory",
  UniswapV2Pair: "UniswapV2Pair",
  UniswapV2Router02: "UniswapV2Router02",
  WETH9: "WETH9",
};

const EXTRA_OUTPUTS = {
  BiggiLiquidityOrchestrator: "BiggiLiquidityOrchestrator",
  BiggiMasterTokenomicsConfig: "BiggiMasterTokenomicsConfig",
  LiquiditySetup: "LiquiditySetup",
};

function collectJsonFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsonFiles(full, out);
      continue;
    }
    if (!entry.name.endsWith(".json")) continue;
    if (entry.name.endsWith(".dbg.json")) continue;
    out.push(full);
  }
  return out;
}

function loadArtifacts() {
  const files = collectJsonFiles(ARTIFACT_ROOT);
  const byName = new Map();
  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const json = JSON.parse(raw);
      const name = json.contractName || path.basename(file, ".json");
      if (!Array.isArray(json.abi)) continue;
      byName.set(name, { file, abi: json.abi });
    } catch {
      // ignore parse errors
    }
  }
  return byName;
}

function writeAbi(outName, artifact) {
  if (!artifact) return false;
  if (!Array.isArray(artifact.abi)) return false;
  const outPath = path.join(OUT_DIR, `${outName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact.abi, null, 2) + "\n");
  return true;
}

function main() {
  if (!fs.existsSync(ARTIFACT_ROOT)) {
    throw new Error(`Artifact folder not found: ${ARTIFACT_ROOT}`);
  }
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const artifacts = loadArtifacts();
  const missing = [];

  for (const [outName, contractName] of Object.entries(OUTPUT_MAP)) {
    const artifact = artifacts.get(contractName);
    if (!writeAbi(outName, artifact)) {
      missing.push({ outName, contractName });
    }
  }

  for (const [outName, contractName] of Object.entries(EXTRA_OUTPUTS)) {
    const artifact = artifacts.get(contractName);
    if (!artifact) {
      missing.push({ outName, contractName });
      continue;
    }
    writeAbi(outName, artifact);
  }

  if (missing.length) {
    const list = missing
      .map((m) => `${m.outName} <- ${m.contractName}`)
      .join(", ");
    console.warn(`Missing artifacts for: ${list}`);
  }

  console.log(
    `Synced ABI files: ${Object.keys(OUTPUT_MAP).length + Object.keys(EXTRA_OUTPUTS).length}`,
  );
}

main();
