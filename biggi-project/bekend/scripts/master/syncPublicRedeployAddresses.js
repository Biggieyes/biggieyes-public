const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(backendRoot, "../..");
const masterFile = path.join(backendRoot, "addresses.master.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function syncJson(file, byChapter, readyByChapter, completedAt, blockNumber) {
  if (!fs.existsSync(file)) return;
  const value = readJson(file);
  if (Object.prototype.hasOwnProperty.call(value, "MAIN2")) value.MAIN2 = byChapter.get(1);
  if (Object.prototype.hasOwnProperty.call(value, "COLLECTION_PUBLIC")) value.COLLECTION_PUBLIC = byChapter.get(1);
  if (Array.isArray(value.chapters)) {
    value.chapters = value.chapters.map((chapter) => ({
      ...chapter,
      MAIN2: byChapter.get(Number(chapter.chapterId)) || chapter.MAIN2,
      publicMetadataReady: readyByChapter.get(Number(chapter.chapterId)) === true,
    }));
  }
  for (const [chapterId, publicAddress] of byChapter.entries()) {
    const key = `CHAPTER_${chapterId}_MAIN2`;
    if (Object.prototype.hasOwnProperty.call(value, key)) value[key] = publicAddress;
  }
  value.PUBLIC_COLLECTIONS_REDEPLOYED_AT = completedAt;
  value.PUBLIC_COLLECTIONS_REDEPLOY_BLOCK = blockNumber;
  writeJson(file, value);
  console.log(`Updated ${file}`);
}

function syncEnv(file, updates) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const [key, value] of Object.entries(updates)) {
    const entry = `${key}=${value}`;
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = entry;
    else lines.push(entry);
  }
  fs.writeFileSync(file, lines.join("\n"));
  console.log(`Updated ${file}`);
}

function syncFrontendSource(file, byChapter) {
  if (!fs.existsSync(file)) return;
  let source = fs.readFileSync(file, "utf8");
  const updates = new Map([
    ["MAIN2", byChapter.get(1)],
    ["COLLECTION_PUBLIC", byChapter.get(1)],
    ...[...byChapter.entries()].map(([chapterId, publicAddress]) => [`CHAPTER_${chapterId}_MAIN2`, publicAddress]),
  ]);
  for (const [key, value] of updates.entries()) {
    const expression = new RegExp(`^(\\s*${key}:\\s*)"0x[0-9a-fA-F]{40}"(,?)$`, "m");
    if (!expression.test(source)) throw new Error(`Missing ${key} in ${file}`);
    source = source.replace(expression, `$1"${value}"$2`);
  }
  fs.writeFileSync(file, source);
  console.log(`Updated ${file}`);
}

function main() {
  const master = readJson(masterFile);
  if (!Array.isArray(master.chapters) || master.chapters.length !== 5) {
    throw new Error("addresses.master.json must contain five chapters");
  }
  const byChapter = new Map(master.chapters.map((chapter) => [Number(chapter.chapterId), chapter.MAIN2]));
  const report = readJson(path.join(backendRoot, "reports/public-collections-redeploy-polygon.json"));
  const readyByChapter = new Map(report.chapters.map((chapter) => [
    Number(chapter.chapterId),
    Array.isArray(chapter.targetUris) && chapter.targetUris.length === 10 && chapter.targetUris.every(Boolean),
  ]));
  const completedAt = master.publicCollectionsRedeployedAt;
  const blockNumber = master.publicCollectionsRedeployBlock;
  if (!completedAt || !blockNumber || byChapter.size !== 5) throw new Error("Public redeploy metadata is incomplete");
  master.chapters = master.chapters.map((chapter) => ({
    ...chapter,
    publicMetadataReady: readyByChapter.get(Number(chapter.chapterId)) === true,
  }));
  writeJson(masterFile, master);

  for (const relative of [
    "addresses.core.polygon.json",
    "addresses.visibility.polygon.json",
    "addresses.tokenomics.phase1.polygon.json",
    "addresses.tokenomics.phase2.polygon.json",
  ]) {
    syncJson(path.join(backendRoot, relative), byChapter, readyByChapter, completedAt, blockNumber);
  }

  syncEnv(path.join(backendRoot, ".env.core.polygon"), { MAIN2: byChapter.get(1) });
  const frontendEnv = {
    VITE_ADDR_MAIN2: byChapter.get(1),
    VITE_ADDR_COLLECTION_PUBLIC: byChapter.get(1),
  };
  syncEnv(path.join(repoRoot, ".env"), frontendEnv);
  syncEnv(path.join(repoRoot, ".env.example"), frontendEnv);
  syncFrontendSource(path.join(repoRoot, "src/shared/utils/addresses.js"), byChapter);
  syncFrontendSource(path.join(repoRoot, "public-repo/src/shared/utils/addresses.js"), byChapter);
}

main();
