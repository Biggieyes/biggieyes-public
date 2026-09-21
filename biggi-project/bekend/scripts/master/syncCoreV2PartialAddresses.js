const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(backendRoot, "../..");
const stateFile = path.join(backendRoot, "addresses.core-v2-migration.resume.polygon.json");
const distributorReportFile = path.join(
  backendRoot,
  "reports/distributor-v2-migration-polygon.json",
);

const OLD = {
  MAIN: "0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4",
  VRF_ROUTER: "0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F",
  DISTRIBUTOR: "0xCE892698159D8D799D5eF7f0dF0111487511fD22",
  MAIN_READER: "0xde05be77024eABf37E4eA4fbBD58F161081be2f3",
  MULTI_COLLECTION_READER: "0xa65B4e88E37F085B9009295eA0AcF05e18a82884",
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`Updated ${path.relative(repoRoot, file).replaceAll("\\", "/")}`);
}

function sameAddress(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

function requireAddress(value, label) {
  if (!/^0x[0-9a-f]{40}$/i.test(String(value || ""))) {
    throw new Error(`${label} is missing or invalid`);
  }
  return value;
}

function assertCurrent(value, oldValue, newValue, label) {
  if (!sameAddress(value, oldValue) && !sameAddress(value, newValue)) {
    throw new Error(`${label} drifted from both the V1 and V2 checkpoints`);
  }
}

function syncJson(file, addresses, futureMains) {
  const value = readJson(file);
  const replacements = {
    MAIN: addresses.MAIN,
    COLLECTION_VRF: addresses.MAIN,
    CHAPTER_1_MAIN: addresses.MAIN,
    COLLECTION: addresses.MAIN,
    VRF_ROUTER: addresses.VRF_ROUTER,
    VRF_READER: addresses.VRF_ROUTER,
    BIGGIVRFREADER: addresses.VRF_ROUTER,
    DISTRIBUTOR: addresses.DISTRIBUTOR,
    MULTI_COLLECTION_DISTRIBUTOR: addresses.DISTRIBUTOR,
    MAIN_READER: addresses.MAIN_READER,
    READER: addresses.MAIN_READER,
    MULTI_COLLECTION_READER: addresses.MULTI_COLLECTION_READER,
    MULTI_COLLECTION_DISTRIBUTOR_READER: addresses.MULTI_COLLECTION_READER,
    MCD_READER_V2: addresses.MULTI_COLLECTION_READER,
    MCD_READER: addresses.MULTI_COLLECTION_READER,
    BIGGI_REWARDS_READER: addresses.MULTI_COLLECTION_READER,
    BiggiREWARDSReader: addresses.MULTI_COLLECTION_READER,
    COLLECTION_REWARDS_READER: addresses.MULTI_COLLECTION_READER,
  };

  for (const [key, replacement] of Object.entries(replacements)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    let oldValue = OLD.MAIN;
    if (["VRF_ROUTER", "VRF_READER", "BIGGIVRFREADER"].includes(key)) {
      oldValue = OLD.VRF_ROUTER;
    } else if (["DISTRIBUTOR", "MULTI_COLLECTION_DISTRIBUTOR"].includes(key)) {
      oldValue = OLD.DISTRIBUTOR;
    } else if (["MAIN_READER", "READER"].includes(key)) {
      oldValue = OLD.MAIN_READER;
    } else if ([
      "MULTI_COLLECTION_READER",
      "MULTI_COLLECTION_DISTRIBUTOR_READER",
      "MCD_READER_V2",
      "MCD_READER",
      "BIGGI_REWARDS_READER",
      "BiggiREWARDSReader",
      "COLLECTION_REWARDS_READER",
    ].includes(key)) {
      oldValue = OLD.MULTI_COLLECTION_READER;
    }
    assertCurrent(value[key], oldValue, replacement, `${path.basename(file)}.${key}`);
    value[key] = replacement;
  }

  if (Array.isArray(value.chapters)) {
    const chapterOne = value.chapters.find((chapter) => Number(chapter.chapterId) === 1);
    if (!chapterOne) throw new Error(`${path.basename(file)} is missing chapter 1`);
    assertCurrent(chapterOne.MAIN, OLD.MAIN, addresses.MAIN, `${path.basename(file)}.chapters[1].MAIN`);
    chapterOne.MAIN = addresses.MAIN;

    for (const [chapterId, expectedMain] of futureMains.entries()) {
      const chapter = value.chapters.find((entry) => Number(entry.chapterId) === chapterId);
      if (!chapter || !sameAddress(chapter.MAIN, expectedMain)) {
        throw new Error(`${path.basename(file)} chapter ${chapterId} must remain on its V1 Main`);
      }
      if (chapter.active !== false) {
        throw new Error(`${path.basename(file)} chapter ${chapterId} must remain inactive`);
      }
    }
  }

  if (path.basename(file) === "addresses.master.json") {
    value.OLD_CORE_V1_MAIN = OLD.MAIN;
    value.OLD_CORE_V1_VRF_ROUTER = OLD.VRF_ROUTER;
    value.OLD_DISTRIBUTOR_V1 = OLD.DISTRIBUTOR;
    value.OLD_MAIN_READER_V1 = OLD.MAIN_READER;
    value.OLD_MULTI_COLLECTION_READER_V1 = OLD.MULTI_COLLECTION_READER;
    value.NFT_REWARDS_VRF_ROUTER = OLD.VRF_ROUTER;
    value.CORE_V2_CUTOVER_THROUGH_CHAPTER = 1;
    value.CORE_V2_CHAPTERS_ACTIVE = false;
    value.CORE_V2_PARTIAL_CUTOVER_AT = addresses.cutoverAt;
    value.CORE_V2_PARTIAL_CUTOVER_BLOCK = addresses.cutoverBlock;
    value.DISTRIBUTOR_V2_MIGRATED_AT = addresses.distributorMigratedAt;
  }

  writeJson(file, value);
}

function syncEnv(file, updates) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const [key, replacement] of Object.entries(updates)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index < 0) continue;
    lines[index] = `${key}=${replacement}`;
  }
  fs.writeFileSync(file, lines.join("\n"));
  console.log(`Updated ${path.relative(repoRoot, file).replaceAll("\\", "/")}`);
}

function syncFrontendSource(file, addresses) {
  let source = fs.readFileSync(file, "utf8");
  const replacements = {
    MAIN: addresses.MAIN,
    COLLECTION_VRF: addresses.MAIN,
    CHAPTER_1_MAIN: addresses.MAIN,
    VRF_ROUTER: addresses.VRF_ROUTER,
    VRF_READER: addresses.VRF_ROUTER,
    DISTRIBUTOR: addresses.DISTRIBUTOR,
    MULTI_COLLECTION_DISTRIBUTOR: addresses.DISTRIBUTOR,
    MAIN_READER: addresses.MAIN_READER,
    READER: addresses.MAIN_READER,
    MULTI_COLLECTION_READER: addresses.MULTI_COLLECTION_READER,
    MULTI_COLLECTION_DISTRIBUTOR_READER: addresses.MULTI_COLLECTION_READER,
    MCD_READER_V2: addresses.MULTI_COLLECTION_READER,
    BIGGI_REWARDS_READER: addresses.MULTI_COLLECTION_READER,
    COLLECTION_REWARDS_READER: addresses.MULTI_COLLECTION_READER,
  };
  for (const [key, replacement] of Object.entries(replacements)) {
    const expression = new RegExp(`^(\\s*${key}:\\s*)"0x[0-9a-fA-F]{40}"(,?)$`, "m");
    if (!expression.test(source)) throw new Error(`Missing ${key} in ${file}`);
    source = source.replace(expression, `$1"${replacement}"$2`);
  }
  fs.writeFileSync(file, source);
  console.log(`Updated ${path.relative(repoRoot, file).replaceAll("\\", "/")}`);
}

function syncHtml(file, addresses) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes(OLD.MAIN) && !source.includes(addresses.MAIN)) {
    throw new Error(`Originals collection address was not found in ${file}`);
  }
  source = source.replaceAll(OLD.MAIN, addresses.MAIN);
  fs.writeFileSync(file, source);
  console.log(`Updated ${path.relative(repoRoot, file).replaceAll("\\", "/")}`);
}

function copyAbi(source, destinations) {
  const abi = readJson(source);
  if (!Array.isArray(abi)) throw new Error(`Invalid generated ABI: ${source}`);
  for (const destination of destinations) writeJson(destination, abi);
}

function main() {
  const state = readJson(stateFile);
  const distributor = readJson(distributorReportFile);
  if (Number(state.chainId) !== 137 || state.status !== "partial-cutover-through-1-chapters-inactive") {
    throw new Error("CORE V2 state is not at the approved Originals-only checkpoint");
  }
  if (!Array.isArray(state.chapters) || state.chapters.length !== 5) {
    throw new Error("CORE V2 state must contain exactly five chapters");
  }
  const ordered = [...state.chapters].sort((left, right) => Number(left.id) - Number(right.id));
  if (ordered[0].cutover !== true || ordered.slice(1).some((chapter) => chapter.cutover === true)) {
    throw new Error("Only chapter 1 may be cut over during this synchronization");
  }
  if (Number(distributor.chainId) !== 137 || !distributor.DISTRIBUTOR || !distributor.MULTI_COLLECTION_READER) {
    throw new Error("Completed Distributor V2 report is missing");
  }

  const latestCutoverTransaction = [...(state.transactions || [])]
    .filter((transaction) => Number.isInteger(Number(transaction.blockNumber)))
    .sort((left, right) => Number(right.blockNumber) - Number(left.blockNumber))[0];
  const addresses = {
    MAIN: requireAddress(ordered[0].newMain, "chapter 1 Main V2"),
    VRF_ROUTER: requireAddress(state.router, "VRF router V2"),
    DISTRIBUTOR: requireAddress(distributor.DISTRIBUTOR, "Distributor V2"),
    MAIN_READER: requireAddress(state.mainReader, "MainReader V2"),
    MULTI_COLLECTION_READER: requireAddress(distributor.MULTI_COLLECTION_READER, "Distributor reader V2"),
    cutoverAt: state.completedAt || state.updatedAt,
    cutoverBlock: Number(latestCutoverTransaction?.blockNumber || 0),
    distributorMigratedAt: distributor.migratedAt,
  };
  const futureMains = new Map(ordered.slice(1).map((chapter) => [Number(chapter.id), chapter.oldMain]));

  for (const relative of [
    "addresses.master.json",
    "addresses.json",
    "addresses.core.polygon.json",
    "addresses.visibility.polygon.json",
    "addresses.tokenomics.phase1.polygon.json",
    "addresses.tokenomics.phase2.polygon.json",
  ]) {
    syncJson(path.join(backendRoot, relative), addresses, futureMains);
  }

  const frontendUpdates = {
    VITE_ADDR_MAIN: addresses.MAIN,
    VITE_ADDR_COLLECTION_VRF: addresses.MAIN,
    VITE_ADDR_VRF_ROUTER: addresses.VRF_ROUTER,
    VITE_VRF_ROUTER: addresses.VRF_ROUTER,
    VITE_ADDR_DISTRIBUTOR: addresses.DISTRIBUTOR,
    VITE_ADDR_MULTI_COLLECTION_DISTRIBUTOR: addresses.DISTRIBUTOR,
    VITE_ADDR_MAIN_READER: addresses.MAIN_READER,
    VITE_ADDR_MULTI_COLLECTION_DISTRIBUTOR_READER: addresses.MULTI_COLLECTION_READER,
    VITE_ADDR_MCD_READER_V2: addresses.MULTI_COLLECTION_READER,
  };
  syncEnv(path.join(repoRoot, ".env"), frontendUpdates);
  syncEnv(path.join(repoRoot, ".env.local"), frontendUpdates);
  syncEnv(path.join(repoRoot, ".env.development.local"), frontendUpdates);
  syncEnv(path.join(repoRoot, ".env.example"), frontendUpdates);
  syncEnv(path.join(backendRoot, ".env.core.polygon"), {
    VRF_ROUTER: addresses.VRF_ROUTER,
    MAIN: addresses.MAIN,
    DISTRIBUTOR: addresses.DISTRIBUTOR,
    MAIN_READER: addresses.MAIN_READER,
    MULTI_COLLECTION_READER: addresses.MULTI_COLLECTION_READER,
  });

  syncFrontendSource(path.join(repoRoot, "src/shared/utils/addresses.js"), addresses);
  syncFrontendSource(path.join(repoRoot, "public-repo/src/shared/utils/addresses.js"), addresses);
  syncHtml(path.join(repoRoot, "index.html"), addresses);
  syncHtml(path.join(repoRoot, "public-repo/index.html"), addresses);

  const generatedAbiRoot = path.join(backendRoot, "reports/cutover/core-v2/abi");
  const canonicalAbiRoot = path.join(
    backendRoot,
    "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_ABI",
  );
  const frontendAbiRoots = [
    path.join(repoRoot, "src/config/abi"),
    path.join(repoRoot, "public-repo/src/config/abi"),
  ];
  copyAbi(path.join(generatedAbiRoot, "BiggiMainV2.abi.json"), [
    path.join(canonicalAbiRoot, "BiggiEyesMain.abi.json"),
    ...frontendAbiRoots.map((root) => path.join(root, "BiggiMain.json")),
  ]);
  copyAbi(path.join(generatedAbiRoot, "BiggiVRFRouterV2.abi.json"), [
    path.join(canonicalAbiRoot, "BiggiVRFRouter.abi.json"),
    ...frontendAbiRoots.map((root) => path.join(root, "BiggiVRFRouter.json")),
  ]);
  copyAbi(path.join(generatedAbiRoot, "BiggiMultiCollectionDistributorV2.abi.json"), [
    path.join(canonicalAbiRoot, "BiggiMultiCollectionDistributor.abi.json"),
    ...frontendAbiRoots.map((root) => path.join(root, "BiggiMultiCollectionDistributor.json")),
  ]);
  copyAbi(path.join(generatedAbiRoot, "BiggiMultiCollectionDistributorReaderV2.abi.json"), [
    path.join(canonicalAbiRoot, "BiggiMultiCollectionDistributorReaderV2.abi.json"),
    ...frontendAbiRoots.map((root) => path.join(root, "BiggiMultiCollectionDistributorReaderV2.json")),
  ]);

  console.log(JSON.stringify({
    result: "core-v2-originals-addresses-synchronized",
    chainId: 137,
    cutoverThroughChapter: 1,
    chaptersActive: false,
    futureChapterMainsUnchanged: [...futureMains.keys()],
  }, null, 2));
}

main();
