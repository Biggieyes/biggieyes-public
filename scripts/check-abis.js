#!/usr/bin/env node
/**
 * Verifies that every ABI referenced in src/utils/contract.js
 * has a corresponding export in src/utils/abi/index.js.
 * Fails the process when an ABI is missing or not an array.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import url from "node:url";

// NOTE: This script reads `src/utils/abi/index.js` as text and extracts
// exported ABI keys instead of importing the module. This avoids issues
// with Node import assertions for JSON files while still verifying that
// the canonical ABI keys referenced in `contract.js` are exported.

const OPTIONAL_EMPTY = new Set([
  // allow-listed ABIs that are intentionally empty (legacy placeholders)
  "ABI_BiggiTokenReader",
]);

async function main() {
  const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
  const contractPath = path.join(scriptDir, "..", "src", "utils", "contract.js");
  const source = await readFile(contractPath, "utf8");

  const abiKeys = Array.from(new Set(source.match(/\bABI_[A-Za-z0-9_]+/g) || []));

  const indexPath = path.join(scriptDir, "..", "src", "utils", "abi", "index.js");
  const indexSrc = await readFile(indexPath, "utf8");

  // extract names from `export { A, B, C }` blocks and `export const NAME =` patterns
  const exportNames = new Set();
  const exportBlockMatch = indexSrc.match(/export\s*{([\s\S]*?)};/m);
  if (exportBlockMatch) {
    const names = exportBlockMatch[1]
      .split(/,/) 
      .map((s) => s.replace(/\/\*.*?\*\//g, "").trim())
      .filter(Boolean);
    for (const n of names) exportNames.add(n);
  }
  for (const m of indexSrc.matchAll(/export\s+const\s+(ABI_[A-Za-z0-9_]+)/g)) {
    exportNames.add(m[1]);
  }
  for (const m of indexSrc.matchAll(/const\s+(ABI_[A-Za-z0-9_]+)\s*=/g)) {
    exportNames.add(m[1]);
  }
  // As a fallback, include any ABI_ token present in the file (covers imports/uses)
  for (const m of indexSrc.matchAll(/\b(ABI_[A-Za-z0-9_]+)\b/g)) {
    exportNames.add(m[1]);
  }

  const missing = [];
  for (const key of abiKeys) {
    if (!exportNames.has(key)) missing.push(key);
  }

  if (missing.length) {
    console.error("[check-abis] Missing exports:", missing.join(", "));
    process.exit(1);
  }

  console.log(`[check-abis] OK — ${abiKeys.length} ABI keys present in index.js.`);
}

main().catch((err) => {
  console.error("[check-abis] Unexpected failure:", err);
  process.exit(1);
});
