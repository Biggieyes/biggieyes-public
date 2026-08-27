import fs from "fs";
import path from "path";
import process from "process";
import { pathToFileURL } from "url";

function findRepositoryRoot() {
  const candidates = [process.cwd(), path.resolve(process.cwd(), "..")];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "biggi-project", "bekend"))) {
      return candidate;
    }
  }
  throw new Error("Repository root with biggi-project/bekend was not found");
}

const ROOT = findRepositoryRoot();
const BACKEND = path.join(ROOT, "biggi-project", "bekend");
const CORE_ABI = path.join(
  BACKEND,
  "contracts",
  "default_workspace (10)",
  "contracts",
  "BIGGI_MASTER",
  "CORE",
  "CORE_ABI",
);

const CORE_ABI_MAP = {
  BiggiMain: "BiggiEyesMain.abi.json",
  BiggiMain2: "BiggiEyesMain2.abi.json",
  BiggiTicketHub: "BiggiTicketHub.abi.json",
  BiggiSeriesRegistry: "BiggiSeriesRegistry.abi.json",
  BiggiChapterController: "BiggiChapterController.abi.json",
  BiggiMainReader: "BiggiMainReader.abi.json",
  BiggiChapterSeriesReader: "BiggiChapterSeriesReader.abi.json",
  BiggiCollectionRewards: "BiggiCollectionRewards.abi.json",
};

const BACKEND_ONLY_RUNTIME_KEYS = new Set([
  "OLD_TICKET_HUB",
  "MODERATOR_V2_DEPLOYED",
  "MODERATOR_V2_ACTIVATED",
]);
const FRONTEND_ONLY_ALIAS_KEYS = new Set(["MODERATORCENTER_V2"]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function stableValue(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^0x[0-9a-f]{40}$/i.test(trimmed)
      ? trimmed.toLowerCase()
      : trimmed;
  }
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function sameValue(a, b) {
  return JSON.stringify(stableValue(a)) === JSON.stringify(stableValue(b));
}

async function loadFrontend(relativePath) {
  const file = path.join(ROOT, relativePath);
  const mod = await import(`${pathToFileURL(file).href}?check=${Date.now()}`);
  return {
    addresses: mod.ADDR || mod.ADDRESSES || null,
    chapters: mod.CORE_CHAPTERS || null,
  };
}

function compareMaps(label, expected, actual, failures) {
  const runtimeExpected = Object.fromEntries(
    Object.entries(expected || {}).filter(
      ([key]) => !BACKEND_ONLY_RUNTIME_KEYS.has(key),
    ),
  );
  const runtimeActual = Object.fromEntries(
    Object.entries(actual || {}).filter(
      ([key]) => !FRONTEND_ONLY_ALIAS_KEYS.has(key),
    ),
  );
  const expectedKeys = new Set(Object.keys(runtimeExpected));
  const actualKeys = new Set(Object.keys(runtimeActual));
  const missing = [...expectedKeys].filter((key) => !actualKeys.has(key));
  const extra = [...actualKeys].filter((key) => !expectedKeys.has(key));
  const mismatches = [...expectedKeys]
    .filter((key) => actualKeys.has(key))
    .filter((key) => !sameValue(runtimeExpected[key], runtimeActual[key]));

  if (missing.length) failures.push(`${label}: missing ${missing.sort().join(", ")}`);
  if (extra.length) failures.push(`${label}: extra ${extra.sort().join(", ")}`);
  for (const key of mismatches.sort()) {
    failures.push(
      `${label}: ${key} expected=${JSON.stringify(runtimeExpected[key])} actual=${JSON.stringify(runtimeActual[key])}`,
    );
  }

  console.log(
    `${label}: expected=${expectedKeys.size}, actual=${actualKeys.size}, issues=${missing.length + extra.length + mismatches.length}`,
  );
}

function compareChapters(label, frontendChapters, manifest, failures) {
  const expected = manifest.chapters || [];
  const actual = frontendChapters || [];
  if (actual.length !== expected.length) {
    failures.push(`${label}: chapter count expected=${expected.length} actual=${actual.length}`);
  }

  for (const chapter of expected) {
    const frontend = actual.find(
      (entry) => Number(entry.chapterId) === Number(chapter.chapterId),
    );
    if (!frontend) {
      failures.push(`${label}: missing chapter ${chapter.chapterId}`);
      continue;
    }
    const checks = {
      seriesId: chapter.seriesId,
      seriesName: chapter.seriesName,
      main: chapter.MAIN,
      main2: chapter.MAIN2,
      active: chapter.active,
    };
    for (const [key, expectedValue] of Object.entries(checks)) {
      if (!sameValue(expectedValue, frontend[key])) {
        failures.push(
          `${label}: chapter ${chapter.chapterId} ${key} expected=${JSON.stringify(expectedValue)} actual=${JSON.stringify(frontend[key])}`,
        );
      }
    }
  }

  console.log(`${label}: manifest=${expected.length}, frontend=${actual.length}`);
}

function compareCoreAbis(frontendDir, label, failures) {
  for (const [frontendName, canonicalName] of Object.entries(CORE_ABI_MAP)) {
    const expectedFile = path.join(CORE_ABI, canonicalName);
    const actualFile = path.join(frontendDir, `${frontendName}.json`);
    if (!fs.existsSync(actualFile)) {
      failures.push(`${label}: missing ABI ${frontendName}.json`);
      continue;
    }
    if (!sameValue(readJson(expectedFile), readJson(actualFile))) {
      failures.push(`${label}: ABI mismatch ${frontendName}.json`);
    }
  }
  console.log(`${label}: checked ${Object.keys(CORE_ABI_MAP).length} CORE ABIs`);
}

async function main() {
  const backendAddresses = readJson(path.join(BACKEND, "addresses.json"));
  const manifest = readJson(path.join(BACKEND, "addresses.master.json"));
  const rootFrontend = await loadFrontend("src/shared/utils/addresses.js");
  const publicFrontend = await loadFrontend(
    "public-repo/src/shared/utils/addresses.js",
  );
  const failures = [];

  compareMaps(
    "root frontend addresses",
    backendAddresses,
    rootFrontend.addresses,
    failures,
  );
  compareMaps(
    "public frontend addresses",
    backendAddresses,
    publicFrontend.addresses,
    failures,
  );
  compareChapters("root CORE chapters", rootFrontend.chapters, manifest, failures);
  compareChapters(
    "public CORE chapters",
    publicFrontend.chapters,
    manifest,
    failures,
  );
  compareCoreAbis(path.join(ROOT, "src", "config", "abi"), "root frontend", failures);
  compareCoreAbis(
    path.join(ROOT, "public-repo", "src", "config", "abi"),
    "public frontend",
    failures,
  );

  if (failures.length) {
    console.error("Contract/frontend consistency check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("OK: backend, both frontends, five chapters and CORE ABIs match.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
