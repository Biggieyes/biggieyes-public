// Spusť: npx hardhat run scripts/deployAndWireAutomation.js --network polygon
// Deployne LiquidityAutomation a hned nastaví keeper v LiquidityManager.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_LM_SET_KEEPER = ["function setKeeper(address) external"];

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
  const required = ["LIQUIDITY_MANAGER", "BIGGI", "PRIVATE_KEY"];
  for (const k of required) if (!env[k]) throw new Error(`Chybí ${k} v .env`);

  const minMaticWei = env.MIN_MATIC_WEI || "100000000000000000"; // 0.1
  const maxMaticWei = env.MAX_MATIC_WEI || "500000000000000000"; // 0.5
  const minIntervalSec = env.MIN_INTERVAL_SEC || "900"; // 15 min

  const wallet = new ethers.Wallet(env.PRIVATE_KEY, hre.ethers.provider);
  const gas = gasOverrides();

  console.log("Deployer:", wallet.address);
  console.log("Params:", { minMaticWei, maxMaticWei, minIntervalSec });

  // Deploy automation
  const factory = await ethers.getContractFactory("LiquidityAutomation", wallet);
  const automation = await factory.deploy(
    env.LIQUIDITY_MANAGER,
    env.BIGGI,
    minMaticWei,
    maxMaticWei,
    minIntervalSec,
    wallet.address,
    gas
  );
  console.log("Deploy tx:", automation.deployTransaction.hash);
  await automation.deployed();
  console.log("Automation deployed:", automation.address);

  // Set keeper on LM
  const lm = new ethers.Contract(env.LIQUIDITY_MANAGER, ABI_LM_SET_KEEPER, wallet);
  console.log("LM.setKeeper ->", automation.address);
  const tx = await lm.setKeeper(automation.address, gas);
  console.log("setKeeper tx:", tx.hash);
  await tx.wait();
  console.log("Hotovo. Keeper na LM je automation kontrakt.");
  console.log("Další krok: zaregistruj Automation kontrakt v Chainlink Automation (Polygon mainnet) a fundni LINK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
