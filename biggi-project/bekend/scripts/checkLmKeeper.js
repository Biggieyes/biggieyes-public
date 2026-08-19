/**
 * Quick status for LM automation:
 *  - prints LM.keeper
 *  - prints reserve balances (polBalance, dexRefillBiggi)
 *
 * Env: LIQUIDITY_MANAGER, RESERVE
 */

require("dotenv").config({ path: "./scripts/.env" });
const hre = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const lmAddr = requireEnv("LIQUIDITY_MANAGER");
  const reserveAddr = requireEnv("RESERVE");
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer:", signer.address);

  const lm = new hre.ethers.Contract(lmAddr, ["function keeper() view returns (address)"], signer);
  const reserve = new hre.ethers.Contract(reserveAddr, [
    "function polBalance() view returns (uint256)",
    "function dexRefillBiggi() view returns (uint256)"
  ], signer);

  console.log("LM keeper:", await lm.keeper());
  console.log("Reserve polBalance:", (await reserve.polBalance()).toString());
  console.log("Reserve dexRefillBiggi:", (await reserve.dexRefillBiggi()).toString());
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
