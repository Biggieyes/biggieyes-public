import fs from "fs";
import path from "path";
import process from "process";
import { pathToFileURL } from "url";

function normalizeAddr(value) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return v.toLowerCase();
}

function loadBackendAddresses() {
  const backendPath = path.resolve("biggi-project/bekend/addresses.json");
  if (!fs.existsSync(backendPath)) return null;
  const raw = fs.readFileSync(backendPath, "utf8");
  return JSON.parse(raw);
}

async function loadFrontendAddresses() {
  const url = pathToFileURL(path.resolve("src/shared/utils/addresses.js")).href;
  const mod = await import(url);
  return mod.ADDR || mod.ADDRESSES || null;
}

function diffKeys(a, b) {
  const aKeys = new Set(Object.keys(a || {}));
  const bKeys = new Set(Object.keys(b || {}));
  const onlyA = [...aKeys].filter((k) => !bKeys.has(k));
  const onlyB = [...bKeys].filter((k) => !aKeys.has(k));
  return { onlyA, onlyB };
}

function diffValues(a, b) {
  const mismatches = [];
  for (const key of Object.keys(a || {})) {
    if (!(key in (b || {}))) continue;
    const av = normalizeAddr(a[key]);
    const bv = normalizeAddr(b[key]);
    if (!av || !bv) continue;
    if (av !== bv) mismatches.push({ key, a: a[key], b: b[key] });
  }
  return mismatches;
}

async function main() {
  const fe = await loadFrontendAddresses();
  const be = loadBackendAddresses();

  if (!fe) throw new Error("Frontend addresses not found (ADDR export missing)");
  if (!be) throw new Error("Backend addresses.json not found");

  const { onlyA: onlyFE, onlyB: onlyBE } = diffKeys(fe, be);
  const mismatches = diffValues(fe, be);

  console.log("Contracts address mirror check");
  console.log(`Frontend keys: ${Object.keys(fe).length}`);
  console.log(`Backend keys: ${Object.keys(be).length}`);

  if (onlyFE.length) {
    console.log("Missing in backend:");
    for (const k of onlyFE.sort()) console.log(`- ${k}`);
  }
  if (onlyBE.length) {
    console.log("Missing in frontend:");
    for (const k of onlyBE.sort()) console.log(`- ${k}`);
  }
  if (mismatches.length) {
    console.log("Mismatched values:");
    for (const m of mismatches) {
      console.log(`- ${m.key}: FE=${m.a} | BE=${m.b}`);
    }
  }

  if (!onlyFE.length && !onlyBE.length && !mismatches.length) {
    console.log("OK: addresses mirror matches (non-empty values).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
