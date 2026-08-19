import fs from "fs";
import path from "path";
import process from "process";
import { globSync } from "glob";

const DEFAULT_SOL_DIR =
  "C:\\Users\\biggi\\OneDrive\\Obrázky\\Desktop\\FRONTEND\\BIGGINFTWEB\\biggi-project\\bekend\\contracts\\default_workspace (10)\\contracts\\BIGGI_MAINNET_SOURCE";
const SOL_DIR = process.argv[2] || DEFAULT_SOL_DIR;
const ABI_DIR = process.argv[3] || "src/utils/abi";
const SKIP_SOL = new Set(["biggimain"]);

const MANUAL_MAP = {
  biggimain: "BiggiMain",
  biggimainvrf: "BiggiMain",
  biggimainpublic: "BiggiMain2",
  biggireader: "BiggiMainReader",
  biggitokenomikreader: "BiggiTokenomicReader",
  biggibuybackdripsetup: "BiggiBuyBackDripSetup",
  biggibuybackagent: "BiggiBuybackAgent",
  biggibuybackreader: "BiggiBuybackReader",
  biggicollectionreader: "BiggiCollectionReader",
  biggicollectionrewards: "BiggiCollectionRewards",
  biggicommunitycenter: "BiggiCommunityCenter",
  biggicompute: "BiggiCompute",
  biggidistributor: "BiggiDistributor",
  biggidripdistributor: "BiggiDripDistributor",
  biggidripreader: "BiggiDripReader",
  biggidripliquiditymanager: "BiggiDripLM",
  biggidripkeeperproxy: "BiggiDripKeeper",
  biggikeeperproxy: "BiggiUpkeeperProxy",
  biggiliquiditymanager: "BiggiLiquidityManager",
  biggiliquiditysetup: "BiggiLiquiditySetup",
  biggiliquidityvaultreader: "BiggiLiquidityVaultReader",
  biggilppricefeed: "BiggiLpPriceFeed",
  biggimulticollectiondistributor: "BiggiMultiCollectionDistributor",
  bigginftrewards: "BiggiNFTRewards",
  biggipolicy: "BiggiPolicy",
  biggireserve: "BiggiReserve",
  biggirewardsreader: "BiggiRewardsReader",
  biggitoken: "BiggiToken",
  biggitokenrewards: "BiggiTokenRewards",
  biggitreasury: "BiggiTreasury",
  biggitreasuryreader: "BiggiTreasuryReader",
  biggiupkeepproxy: "BiggiUpkeeperProxy",
  biggivrfreader: "BiggiVRFReader",
  biggiweth9: "BiggiWeth9",
  biggimoderatorcenter: "ModeratorCenter",
  liquidityautomation: "LiquidityAutomation",
  dripdistributor: "DripDistributor",
  driplm: "DripLM",
};

function normalizeName(name) {
  return String(name || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function stripComments(source) {
  const withoutBlock = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlock.replace(/\/\/.*$/gm, "");
}

function extractPublicFunctions(source) {
  const cleaned = stripComments(source);
  const functions = new Set();
  const regex = /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*([^;{]*)/g;
  let match;
  while ((match = regex.exec(cleaned))) {
    const name = match[1];
    const tail = match[2] || "";
    if (/\b(public|external)\b/.test(tail)) {
      functions.add(name);
    }
  }
  return functions;
}

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadAbiMap() {
  const abiFiles = globSync(`${ABI_DIR}/**/*.json`, { nodir: true });
  const abiByNorm = new Map();
  const abiByName = new Map();
  for (const file of abiFiles) {
    const base = path.basename(file, ".json");
    const norm = normalizeName(base);
    abiByNorm.set(norm, file);
    abiByName.set(base, file);
  }
  return { abiFiles, abiByNorm, abiByName };
}

function extractAbiFunctions(abiJson) {
  const abi = Array.isArray(abiJson) ? abiJson : abiJson?.abi || null;
  if (!Array.isArray(abi)) return new Set();
  const fns = new Set();
  for (const entry of abi) {
    if (entry && entry.type === "function" && entry.name) {
      fns.add(entry.name);
    }
  }
  return fns;
}

function main() {
  const solFiles = globSync(`${SOL_DIR}/**/*.sol`, { nodir: true });
  const { abiFiles, abiByNorm, abiByName } = loadAbiMap();
  const unmapped = [];
  const mismatches = [];

  for (const solFile of solFiles) {
    const base = path.basename(solFile, ".sol");
    const norm = normalizeName(base);
    if (SKIP_SOL.has(norm)) continue;
    const functions = extractPublicFunctions(fs.readFileSync(solFile, "utf8"));
    if (!functions.size) continue;

    let abiFile = null;
    const manual = MANUAL_MAP[norm];
    if (manual && abiByName.has(manual)) {
      abiFile = abiByName.get(manual);
    } else if (abiByNorm.has(norm)) {
      abiFile = abiByNorm.get(norm);
    }

    if (!abiFile) {
      unmapped.push({ solFile, base });
      continue;
    }

    const abiJson = readJson(abiFile);
    const abiFunctions = extractAbiFunctions(abiJson);

    const missingInAbi = [...functions].filter((fn) => !abiFunctions.has(fn));
    const extraInAbi = [...abiFunctions].filter((fn) => !functions.has(fn));

    if (missingInAbi.length || extraInAbi.length) {
      mismatches.push({
        solFile,
        abiFile,
        base,
        missingInAbi,
        extraInAbi,
      });
    }
  }

  console.log(
    `Solidity files: ${solFiles.length}, ABI files: ${abiFiles.length}`,
  );
  console.log(`Mapped mismatches: ${mismatches.length}`);
  console.log(`Unmapped contracts: ${unmapped.length}`);

  if (unmapped.length) {
    console.log("Unmapped solidity files:");
    for (const entry of unmapped) {
      console.log(`- ${entry.base} (${entry.solFile})`);
    }
  }

  if (!mismatches.length) {
    console.log("No ABI mismatches detected (heuristic).");
    return;
  }

  console.log("ABI mismatches:");
  for (const entry of mismatches) {
    console.log(
      `- ${entry.base}: missing ${entry.missingInAbi.length}, extra ${entry.extraInAbi.length}`,
    );
    if (entry.missingInAbi.length) {
      console.log(`  missing: ${entry.missingInAbi.join(", ")}`);
    }
    if (entry.extraInAbi.length) {
      console.log(`  extra: ${entry.extraInAbi.join(", ")}`);
    }
    console.log(`  sol: ${entry.solFile}`);
    console.log(`  abi: ${entry.abiFile}`);
  }
}

main();
