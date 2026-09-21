const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function read(file) {
  return fs.readFileSync(file);
}

function readJson(file) {
  return JSON.parse(read(file).toString("utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const root = path.resolve(__dirname, "../..");
  const repoRoot = path.resolve(root, "../..");
  const stateFile = path.join(root, "addresses.core-v2-migration.resume.polygon.json");
  const addressFile = path.join(root, "addresses.master.json");
  const stateBuffer = read(stateFile);
  const addressBuffer = read(addressFile);
  const state = JSON.parse(stateBuffer.toString("utf8"));
  const book = JSON.parse(addressBuffer.toString("utf8"));
  const acceptedStatuses = new Set([
    "staged-chapters-1-2-configured",
    "partial-cutover-through-1-chapters-inactive",
    "complete",
  ]);
  if (Number(state.chainId) !== 137 || state.pending || !acceptedStatuses.has(state.status)) {
    throw new Error("CORE V2 checkpoint is not at a supported safe boundary");
  }
  if (!Array.isArray(state.chapters) || state.chapters.length !== 5 || !Array.isArray(book.chapters)) {
    throw new Error("CORE V2 chapter maps are incomplete");
  }

  const artifactRoot = path.join(root, "artifacts-master/contracts/default_workspace (10)/contracts/BIGGI_MASTER");
  const artifacts = {
    BiggiMainV2: path.join(artifactRoot, "CORE/BiggiMainV2.sol/BiggiEyesMainV2.json"),
    BiggiVRFRouterV2: path.join(artifactRoot, "CORE/BiggiVrfRouterV2.sol/BiggiVRFRouterV2.json"),
    BiggiMainReader: path.join(artifactRoot, "CORE/CORE_READERS/BiggiMainReader.sol/BiggiMainReader.json"),
    BiggiMultiCollectionDistributorV2: path.join(
      artifactRoot,
      "CORE/BiggiMultiCollectionDistributor.sol/BiggiMultiCollectionDistributor.json",
    ),
    BiggiMultiCollectionDistributorReaderV2: path.join(
      artifactRoot,
      "CORE/CORE_READERS/BiggiMultiCollectionDistributorReaderV2.sol/BiggiMultiCollectionDistributorReaderV2.json",
    ),
  };
  const outputRoot = path.join(root, "reports/cutover/core-v2");
  const abiOutputs = {};
  for (const [label, artifactFile] of Object.entries(artifacts)) {
    const artifact = readJson(artifactFile);
    const outputFile = path.join(outputRoot, "abi", `${label}.abi.json`);
    writeJson(outputFile, artifact.abi);
    abiOutputs[label] = {
      file: path.relative(repoRoot, outputFile).replaceAll("\\", "/"),
      sha256: sha256(read(outputFile)),
      entries: artifact.abi.length,
    };
  }

  const chapters = [...state.chapters]
    .sort((left, right) => Number(left.id) - Number(right.id))
    .map((chapter) => {
      const canonical = book.chapters.find((entry) => Number(entry.chapterId) === Number(chapter.id));
      const expectedCanonicalMain = chapter.cutover ? chapter.newMain : chapter.oldMain;
      if (!canonical || canonical.MAIN.toLowerCase() !== expectedCanonicalMain.toLowerCase()) {
        throw new Error(`Canonical chapter ${chapter.id} drifted from the migration checkpoint`);
      }
      return {
        chapterId: Number(chapter.id),
        expectedOldMain: chapter.oldMain,
        proposedMainV2: chapter.newMain,
        publicCollectionUnchanged: canonical.MAIN2,
        currentlyConfigured: Boolean(chapter.configured),
        currentlyCutOver: Boolean(chapter.cutover),
      };
    });

  const draft = {
    schemaVersion: 1,
    chainId: 137,
    activationAllowed: false,
    checkpointStatus: state.status,
    checkpointSha256: sha256(stateBuffer),
    canonicalAddressBookSha256: sha256(addressBuffer),
    knownAddressChanges: {
      VRF_ROUTER: { expectedOld: state.oldRouter, proposedNew: state.router },
      MAIN: { expectedOld: chapters[0].expectedOldMain, proposedNew: chapters[0].proposedMainV2 },
      chapters,
    },
    resolvedDeploymentAddresses: {
      MAIN_READER: state.mainReader || book.MAIN_READER || null,
      DISTRIBUTOR: book.DISTRIBUTOR || null,
      MULTI_COLLECTION_READER: book.MULTI_COLLECTION_READER || null,
    },
    abiOutputs,
    applyOnlyAfter: [
      "Target chapter is prepared and remains inactive before activation",
      "Every earlier chapter is sold out and inactive",
      "Distributor V2 migration and strict CORE relationship checks pass",
      "All target contracts are source verified and runtime verified",
    ],
    productionFilesToUpdateTogether: [
      "biggi-project/bekend/addresses.master.json",
      "src/shared/utils/addresses.js",
      "public-repo/src/shared/utils/addresses.js",
      "src/config/abi/BiggiMain.json",
      "src/config/abi/BiggiVRFRouter.json",
      "src/config/abi/BiggiMultiCollectionDistributor.json",
      "src/config/abi/BiggiMultiCollectionDistributorReaderV2.json",
      "public-repo/src/config/abi/BiggiMain.json",
      "public-repo/src/config/abi/BiggiVRFRouter.json",
      "public-repo/src/config/abi/BiggiMultiCollectionDistributor.json",
      "public-repo/src/config/abi/BiggiMultiCollectionDistributorReaderV2.json",
      "biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_ABI/BiggiEyesMain.abi.json",
      "biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_ABI/BiggiVRFRouter.abi.json",
      "biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_ABI/BiggiMultiCollectionDistributor.abi.json",
      "biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_ABI/BiggiMultiCollectionDistributorReaderV2.abi.json"
    ],
    generatedAt: new Date().toISOString(),
  };
  const draftFile = path.join(outputRoot, "cutover-draft.json");
  writeJson(draftFile, draft);
  console.log(JSON.stringify({
    result: "draft-only-no-production-files-modified",
    draftFile: path.relative(repoRoot, draftFile).replaceAll("\\", "/"),
    checkpointSha256: draft.checkpointSha256,
    canonicalAddressBookSha256: draft.canonicalAddressBookSha256,
    abiOutputs,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message || "CORE V2 cutover draft preparation failed");
  process.exitCode = 1;
}
