// Spusť: npx hardhat run scripts/setKeeperToAutomation.js --network amoy
// Nastaví keeper na LiquidityManager na adresu Automation kontraktu.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_LM = ["function setKeeper(address) external"];

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
  if (!env.AUTOMATION_CONTRACT) throw new Error("Chybí AUTOMATION_CONTRACT v .env");
  if (!env.PRIVATE_KEY) throw new Error("Chybí PRIVATE_KEY v .env");

  const signer = new ethers.Wallet(env.PRIVATE_KEY, hre.ethers.provider);
  const lm = new ethers.Contract(env.LIQUIDITY_MANAGER, ABI_LM, signer);
  const gas = gasOverrides();

  console.log("LM:", env.LIQUIDITY_MANAGER);
  console.log("Nastavuji keeper ->", env.AUTOMATION_CONTRACT);

  const tx = await lm.setKeeper(env.AUTOMATION_CONTRACT, gas);
  console.log("tx:", tx.hash);
  await tx.wait();
  console.log("Hotovo. Keeper je nyní automation kontrakt.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
