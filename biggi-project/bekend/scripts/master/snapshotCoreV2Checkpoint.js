const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const root = path.resolve(__dirname, "../..");
  const sourceFile = path.resolve(env(
    "CORE_V2_RESUME_FILE",
    path.join(root, "addresses.core-v2-migration.resume.polygon.json"),
  ));
  const snapshotFile = path.resolve(env(
    "CORE_V2_CHECKPOINT_SNAPSHOT",
    path.join(root, "reports/checkpoints/core-v2-stage-chapters-1-2.polygon.json"),
  ));
  const manifestFile = path.resolve(env(
    "CORE_V2_CHECKPOINT_MANIFEST",
    path.join(root, "reports/checkpoints/core-v2-stage-chapters-1-2.manifest.json"),
  ));
  const migrationReportFile = path.resolve(env(
    "CORE_V2_REPORT_FILE",
    path.join(root, "reports/core-v2-migration-polygon.json"),
  ));
  const source = fs.readFileSync(sourceFile);
  const state = JSON.parse(source.toString("utf8"));
  if (Number(state.chainId) !== 137 || state.status !== "staged-chapters-1-2-configured") {
    throw new Error("Checkpoint is not the expected Polygon stage 1-2 state");
  }
  if (state.pending) throw new Error("Checkpoint has a pending transaction and cannot be snapshotted");
  const configuredChapters = state.chapters
    .filter((chapter) => chapter.configured)
    .map((chapter) => Number(chapter.id))
    .sort((left, right) => left - right);
  if (JSON.stringify(configuredChapters) !== JSON.stringify([1, 2])) {
    throw new Error("Checkpoint configured-chapter set is not exactly [1,2]");
  }

  fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
  fs.writeFileSync(snapshotFile, source);
  const snapshot = fs.readFileSync(snapshotFile);
  if (!source.equals(snapshot)) throw new Error("Checkpoint snapshot byte comparison failed");
  const manifest = {
    schemaVersion: 1,
    chainId: 137,
    status: state.status,
    sourceFile,
    snapshotFile,
    sha256: sha256(snapshot),
    successfulTransactions: (state.transactions || []).length,
    failedTransactions: (state.failedTransactions || []).length,
    pendingTransaction: false,
    router: state.router,
    chapters: state.chapters.map(({ id, oldMain, newMain, configured }) => ({
      id: Number(id),
      oldMain,
      newMain,
      configured: Boolean(configured),
    })),
    snapshottedAt: new Date().toISOString(),
  };
  writeJson(manifestFile, manifest);
  const existingReport = fs.existsSync(migrationReportFile)
    ? JSON.parse(fs.readFileSync(migrationReportFile, "utf8"))
    : {};
  writeJson(migrationReportFile, {
    ...existingReport,
    mode: "execute-staged",
    chainId: 137,
    owner: state.owner,
    deployer: state.deployer,
    result: "staged-chapters-1-2-configured-no-cutover",
    status: state.status,
    router: state.router,
    chapters: state.chapters,
    transactions: state.transactions || [],
    failedTransactions: state.failedTransactions || [],
    cutoverStarted: false,
    chaptersRemainInactive: true,
    reconstructedFromCheckpoint: true,
    checkpointSha256: manifest.sha256,
    updatedAt: new Date().toISOString(),
  });
  console.log(JSON.stringify(manifest, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message || "CORE V2 checkpoint snapshot failed");
  process.exitCode = 1;
}
