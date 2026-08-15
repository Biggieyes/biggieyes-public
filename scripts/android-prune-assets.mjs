import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const assetsRoot = path.join(
  repoRoot,
  "android",
  "app",
  "src",
  "main",
  "assets",
  "public",
);
const canonicalBlackDir = path.join(assetsRoot, "images", "blocks", "BLACK");

const ROOT_BLACK_IMAGE_RE = /^Biggi_\d+_BLACK_(O|B|W|BR|BL|G|V|R|P)\.png$/i;

async function sha256(filePath) {
  const data = await fs.readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function pruneAndroidAssets() {
  try {
    await fs.access(assetsRoot);
  } catch {
    console.log(`[skip] Android assets not found: ${assetsRoot}`);
    return;
  }

  const entries = await fs.readdir(assetsRoot, { withFileTypes: true });
  let removedCount = 0;
  let removedBytes = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!ROOT_BLACK_IMAGE_RE.test(entry.name)) continue;

    const rootFile = path.join(assetsRoot, entry.name);
    const canonicalFile = path.join(canonicalBlackDir, entry.name);

    try {
      await fs.access(canonicalFile);
    } catch {
      skipped += 1;
      continue;
    }

    const [rootStat, canonicalStat] = await Promise.all([
      fs.stat(rootFile),
      fs.stat(canonicalFile),
    ]);

    if (rootStat.size !== canonicalStat.size) {
      skipped += 1;
      continue;
    }

    const [rootHash, canonicalHash] = await Promise.all([
      sha256(rootFile),
      sha256(canonicalFile),
    ]);

    if (rootHash !== canonicalHash) {
      skipped += 1;
      continue;
    }

    await fs.unlink(rootFile);
    removedCount += 1;
    removedBytes += rootStat.size;
  }

  const removedMb = (removedBytes / (1024 * 1024)).toFixed(2);
  console.log(
    `[done] Removed ${removedCount} duplicated Android assets (${removedMb} MB).`,
  );
  if (skipped > 0) {
    console.log(
      `[info] Skipped ${skipped} files because they were not exact duplicates.`,
    );
  }
}

pruneAndroidAssets().catch((error) => {
  console.error("[error] Android asset prune failed.");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
