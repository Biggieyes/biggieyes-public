const fs = require("fs");
const path = require("path");

const ZERO = "0x0000000000000000000000000000000000000000";

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function resolveFile(inputPath, fallback) {
  const value = inputPath || fallback;
  if (path.isAbsolute(value)) return value;
  return path.resolve(process.cwd(), value);
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || "")) && String(value).toLowerCase() !== ZERO;
}

function setEnvLine(lines, key, value) {
  const entry = `${key}=${value}`;
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = entry;
  else lines.push(entry);
}

function syncEnvFile(filePath, updates) {
  if (!fs.existsSync(filePath)) return;
  const encoding = "utf8";
  const lines = fs.readFileSync(filePath, encoding).split(/\r?\n/);
  for (const [key, value] of Object.entries(updates)) {
    if (value) setEnvLine(lines, key, value);
  }
  fs.writeFileSync(filePath, lines.join("\n"), encoding);
  console.log(`Updated ${filePath}`);
}

function main() {
  const addressesFile = resolveFile(env("ADDRESSES_FILE", env("OUTPUT_FILE")), "./addresses.visibility.polygon.json");
  if (!fs.existsSync(addressesFile)) throw new Error(`Addresses file not found: ${addressesFile}`);
  const A = JSON.parse(fs.readFileSync(addressesFile, "utf8"));

  const updates = {
    VITE_ADDR_MAIN: A.MAIN,
    VITE_ADDR_COLLECTION_VRF: A.MAIN,
    VITE_ADDR_MAIN2: A.MAIN2,
    VITE_ADDR_COLLECTION_PUBLIC: A.MAIN2,
    VITE_VRF_ROUTER: A.VRF_ROUTER,
    VITE_ADDR_COMPUTE: A.COMPUTE,
    VITE_ADDR_TICKET_HUB: A.TICKET_HUB,
    VITE_ADDR_COLLECTION_REWARDS: A.COLLECTION_REWARDS,
    VITE_ADDR_NFT_REWARDS: A.NFT_REWARDS,
    VITE_ADDR_MAIN_READER: A.MAIN_READER,
    VITE_ADDR_CHAPTER_SERIES_READER: A.CHAPTER_SERIES_READER,
    VITE_ADDR_NFT_REWARDS_READER: A.NFT_REWARDS_READER,
    VITE_ADDR_SERIES_REGISTRY: A.REGISTRY,
    VITE_ADDR_CHAPTER_CONTROLLER: A.CHAPTER_CONTROLLER,
  };

  for (const [key, value] of Object.entries(updates)) {
    if (value && !isAddress(value)) throw new Error(`${key} is not a nonzero address: ${value}`);
  }

  const repoRoot = path.resolve(process.cwd(), "../..");
  syncEnvFile(path.join(repoRoot, ".env"), updates);
  syncEnvFile(path.join(repoRoot, ".env.example"), updates);

  const masterPath = path.resolve(process.cwd(), "addresses.master.json");
  const master = fs.existsSync(masterPath) ? JSON.parse(fs.readFileSync(masterPath, "utf8")) : {};
  const merged = {
    ...master,
    ...A,
    MAIN: A.MAIN,
    MAIN2: A.MAIN2,
    TICKET_HUB: A.TICKET_HUB,
    COMPUTE: A.COMPUTE,
    VRF_ROUTER: A.VRF_ROUTER,
    REGISTRY: A.REGISTRY,
    CHAPTER_CONTROLLER: A.CHAPTER_CONTROLLER,
    COLLECTION_REWARDS: A.COLLECTION_REWARDS,
    NFT_REWARDS: A.NFT_REWARDS,
    MAIN_READER: A.MAIN_READER,
    CHAPTER_SERIES_READER: A.CHAPTER_SERIES_READER,
    NFT_REWARDS_READER: A.NFT_REWARDS_READER,
    BIGGI_NAMES_LIB: A.BIGGI_NAMES_LIB,
    BIGGI_NAMES_LIB2: A.BIGGI_NAMES_LIB2,
    source: "addresses.visibility.polygon.json",
    syncedAt: new Date().toISOString(),
  };
  fs.writeFileSync(masterPath, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`Updated ${masterPath}`);
}

main();
