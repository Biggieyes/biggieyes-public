// Spusť: npx hardhat run scripts/deployLiquidityAutomation.js --network polygon
// Deployne LiquidityAutomation a vypíše adresu. Nastaví owner = deployer.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

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
  const factory = await ethers.getContractFactory("LiquidityAutomation", wallet);
  const gas = gasOverrides();

  console.log("Deployer:", wallet.address);
  console.log("Args:", {
    lm: env.LIQUIDITY_MANAGER,
    biggi: env.BIGGI,
    minMaticWei,
    maxMaticWei,
    minIntervalSec,
  });

  const contract = await factory.deploy(
    env.LIQUIDITY_MANAGER,
    env.BIGGI,
    minMaticWei,
    maxMaticWei,
    minIntervalSec,
    wallet.address,
    gas
  );

  console.log("tx deploy:", contract.deployTransaction.hash);
  await contract.deployed();
  console.log("LiquidityAutomation deployed:", contract.address);
  console.log("-> Nastav LM.setKeeper na tuto adresu a zaregistruj upkeep v Chainlink Automation.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
