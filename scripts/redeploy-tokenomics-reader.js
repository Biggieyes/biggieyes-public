#!/usr/bin/env node
import { spawnSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BACKEND_DIR = join(ROOT, "biggi-project", "bekend");
const BACKEND_ENV = join(BACKEND_DIR, "scripts", ".env");
const ADDRESS_FILE = join(ROOT, "src", "utils", "addresses.js");

function runHardhatDeploy() {
  console.log("Redeploying BiggiTokenomikReader via Hardhat...");
  const result = spawnSync(
    "npx",
    ["hardhat", "run", "scripts/deployTokenomikReader.js", "--network", "amoy"],
    {
      cwd: BACKEND_DIR,
      encoding: "utf8",
    }
  );
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error("Hardhat deploy failed (see previous logs)");
  }
  const match = /BiggiTokenomikReader deployed at:\s*(0x[0-9a-fA-F]{40})/i.exec(result.stdout);
  if (!match) throw new Error("Unable to parse deployed address from Hardhat output");
  return match[1];
}

function replaceEnvValue(text, key, value) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (!regex.test(text)) throw new Error(`Missing ${key} in env file`);
  return text.replace(regex, `${key}=${value}`);
}

function replaceAddressEntry(text, key, value) {
  const regex = new RegExp(`(${key}:\\s*)"(0x[0-9a-fA-F]{40})"`);
  if (!regex.test(text)) throw new Error(`Unable to find ${key} entry in addresses file`);
  return text.replace(regex, `$1"${value}"`);
}

function updateEnvFile(address) {
  const env = readFileSync(BACKEND_ENV, "utf8");
  const patched = replaceEnvValue(env, "TOKENOMIK_READER", address);
  writeFileSync(BACKEND_ENV, patched, "utf8");
  console.log(`Updated ${BACKEND_ENV}: TOKENOMIK_READER=${address}`);
}

function updateAddressFile(address) {
  const content = readFileSync(ADDRESS_FILE, "utf8");
  const patched = replaceAddressEntry(content, "BIGGI_TOKENOMICS_READER", address);
  writeFileSync(ADDRESS_FILE, patched, "utf8");
  console.log(`Updated ${ADDRESS_FILE}: BIGGI_TOKENOMICS_READER=${address}`);
}

function main() {
  const address = runHardhatDeploy();
  updateEnvFile(address);
  updateAddressFile(address);
  console.log("Redeployment complete. BiggiTokenomikReader is now pointed at:", address);
}

main();
