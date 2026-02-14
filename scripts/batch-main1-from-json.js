import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, Interface, JsonRpcProvider, Wallet } from "ethers";
import { ADDR } from "../src/shared/utils/addresses.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const getArg = (name, fallback = null) => {
  const idx = argv.indexOf(name);
  if (idx === -1) return fallback;
  const next = argv[idx + 1];
  if (!next || next.startsWith("--")) return fallback;
  return next;
};

const jsonPath = getArg("--json", process.env.BATCH_JSON);
const batchSize = Number(getArg("--batch-size", "55"));
const fromBatch = Number(getArg("--from", "1"));
const toBatch = Number(getArg("--to", "0"));
const mode = hasFlag("--send")
  ? "send"
  : hasFlag("--calldata")
    ? "calldata"
    : "print";

const rpcUrl = getArg("--rpc", process.env.RPC_URL || process.env.VITE_RPC_URL_AMOY);
const privateKey = process.env.PRIVATE_KEY;
const mainAddress =
  getArg("--main", null) ||
  process.env.MAIN_ADDRESS ||
  process.env.VITE_MAIN ||
  ADDR.MAIN;

if (!jsonPath) {
  console.error("Missing --json path or BATCH_JSON env.");
  process.exit(1);
}
if (!Number.isFinite(batchSize) || batchSize <= 0) {
  console.error("Invalid --batch-size");
  process.exit(1);
}
if (!mainAddress) {
  console.error("MAIN address missing. Use --main or set MAIN_ADDRESS/VITE_MAIN.");
  process.exit(1);
}

const toNumberish = (value) => {
  if (value == null) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return value;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.startsWith("0x")) return BigInt(raw);
  const num = Number(raw);
  if (Number.isSafeInteger(num)) return num;
  return BigInt(raw);
};

const normalizeArray = (arr, field) => {
  if (!Array.isArray(arr)) {
    throw new Error(`${field} is not an array`);
  }
  return arr.map((v, idx) => {
    const out = toNumberish(v);
    if (out == null) {
      throw new Error(`${field}[${idx}] is invalid: ${v}`);
    }
    return out;
  });
};

const raw = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
const fields = ["indices", "bg_codes", "block_indices", "main_ids"];
const length = raw?.indices?.length ?? 0;
if (!length) throw new Error("Empty indices array in JSON");
for (const field of fields) {
  if (!Array.isArray(raw[field])) throw new Error(`Missing ${field} array`);
  if (raw[field].length !== length) {
    throw new Error(`Length mismatch for ${field} (${raw[field].length} vs ${length})`);
  }
}

const data = {
  indices: normalizeArray(raw.indices, "indices"),
  bg_codes: normalizeArray(raw.bg_codes, "bg_codes"),
  block_indices: normalizeArray(raw.block_indices, "block_indices"),
  main_ids: normalizeArray(raw.main_ids, "main_ids"),
};

const batchCount = Math.ceil(length / batchSize);
const startIdx = Math.max(1, fromBatch);
const endIdx = toBatch && toBatch > 0 ? Math.min(toBatch, batchCount) : batchCount;

console.log(`Batches: ${batchCount} (size ${batchSize}), range ${startIdx}..${endIdx}`);
console.log(`MAIN address: ${mainAddress}`);

const sliceBatch = (i) => {
  const start = (i - 1) * batchSize;
  const end = i * batchSize;
  return {
    indices: data.indices.slice(start, end),
    bgCodes: data.bg_codes.slice(start, end),
    blockIndices: data.block_indices.slice(start, end),
    mainIds: data.main_ids.slice(start, end),
  };
};

if (mode === "print") {
  for (let i = startIdx; i <= endIdx; i++) {
    const batch = sliceBatch(i);
    console.log(`\n--- Batch ${i} ---`);
    console.log(`indices: ${JSON.stringify(batch.indices)}`);
    console.log(`bg_codes: ${JSON.stringify(batch.bgCodes)}`);
    console.log(`block_indices: ${JSON.stringify(batch.blockIndices)}`);
    console.log(`main_ids: ${JSON.stringify(batch.mainIds)}`);
  }
  process.exit(0);
}

const abiPath = path.resolve(__dirname, "../src/config/abi/BiggiMain.json");
const abi = JSON.parse(await fs.readFile(abiPath, "utf-8"));
const iface = new Interface(abi);

if (mode === "calldata") {
  for (let i = startIdx; i <= endIdx; i++) {
    const batch = sliceBatch(i);
    const data = iface.encodeFunctionData("batchSetNFTBackgroundAndBlock", [
      batch.indices,
      batch.bgCodes,
      batch.blockIndices,
      batch.mainIds,
    ]);
    console.log(`\n--- Batch ${i} calldata ---`);
    console.log(data);
  }
  process.exit(0);
}

if (!rpcUrl) {
  console.error("Missing RPC URL. Use --rpc or set RPC_URL/VITE_RPC_URL_AMOY.");
  process.exit(1);
}
if (!privateKey) {
  console.error("Missing PRIVATE_KEY env for send mode.");
  process.exit(1);
}
if (process.env.CONFIRM_SEND !== "1") {
  console.error("Set CONFIRM_SEND=1 to send transactions.");
  process.exit(1);
}

const provider = new JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privateKey, provider);
const contract = new Contract(mainAddress, abi, wallet);

for (let i = startIdx; i <= endIdx; i++) {
  const batch = sliceBatch(i);
  console.log(`Sending batch ${i} (${batch.indices.length} items)...`);
  const tx = await contract.batchSetNFTBackgroundAndBlock(
    batch.indices,
    batch.bgCodes,
    batch.blockIndices,
    batch.mainIds,
  );
  console.log(`tx: ${tx.hash}`);
  await tx.wait(1);
}

console.log("Done.");
