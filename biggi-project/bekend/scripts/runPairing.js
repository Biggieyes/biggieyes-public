// scripts/runPairing.js
// Spusť: REQUESTED_MATIC_WEI=500000000000000000 npx hardhat run scripts/runPairing.js --network amoy
// Volá executePairing na BiggiLiquidityManager s inline ABI (není třeba artifact).

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_LM = ["function executePairing(uint256) external"];

function gasOverrides() {
  const prio = process.env.GAS_PRIORITY_GWEI || "30";
  const fee = process.env.GAS_FEE_GWEI || "60";
  return {
    maxPriorityFeePerGas: ethers.utils.parseUnits(prio, "gwei"),
    maxFeePerGas: ethers.utils.parseUnits(fee, "gwei"),
  };
}

async function main() {
  const env = process.env;
  if (!env.LIQUIDITY_MANAGER) throw new Error("Chybí LIQUIDITY_MANAGER v .env");
  if (!env.REQUESTED_MATIC_WEI) throw new Error("Chybí REQUESTED_MATIC_WEI v env nebo inline před příkazem");
  if (!env.PRIVATE_KEY) throw new Error("Chybí PRIVATE_KEY v .env");

  const signer = new ethers.Wallet(env.PRIVATE_KEY, hre.ethers.provider);
  const lm = new ethers.Contract(env.LIQUIDITY_MANAGER, ABI_LM, signer);
  const gas = gasOverrides();

  console.log("LM:", env.LIQUIDITY_MANAGER);
  console.log("Signer:", signer.address);
  console.log("executePairing requestedMaticWei:", env.REQUESTED_MATIC_WEI);

  const tx = await lm.executePairing(env.REQUESTED_MATIC_WEI, gas);
  console.log("tx:", tx.hash);
  await tx.wait();
  console.log("Hotovo. Zkontroluj LP ve Vaultu.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});