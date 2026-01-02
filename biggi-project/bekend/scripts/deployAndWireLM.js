// scripts/deployAndWireLM.js
// Spusť: npx hardhat run scripts/deployAndWireLM.js --network amoy
// Deployne nový BiggiLiquidityManager (opravený pull API), nastaví Reserve/Vault/MasterConfig a keeper.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_RESERVE = ["function setLiquidityManager(address) external"];
const ABI_VAULT = ["function setLiquidityManager(address) external"];
const ABI_MC = ["function setLiquidityBranch(address,address,address,address,address) external"];
const ABI_LM_SETTERS = [
  "function setRouter(address) external",
  "function setFactory(address) external",
  "function setReserve(address) external",
  "function setLiquidityVault(address) external",
  "function setKeeper(address) external",
];

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
  const required = ["BIGGI", "ROUTER", "LIQUIDITY_VAULT", "RESERVE", "FACTORY", "WETH", "MASTER_CONFIG", "PRIVATE_KEY"];
  for (const k of required) if (!env[k]) throw new Error(`Chybí ${k} v .env`);

  const gas = gasOverrides();
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Deploy LM
  const LMFactory = await ethers.getContractFactory("BiggiLiquidityManager");
  const lm = await LMFactory.deploy(env.BIGGI, env.ROUTER, env.LIQUIDITY_VAULT, deployer.address, env.RESERVE, gas);
  await lm.deployed();
  console.log("New LM deployed:", lm.address);

  // Setters on LM (factory, reserve, vault, router, keeper)
  const lmSet = new ethers.Contract(lm.address, ABI_LM_SETTERS, deployer);
  console.log("LM.setFactory ->", env.FACTORY);
  await (await lmSet.setFactory(env.FACTORY, gas)).wait();
  console.log("LM.setReserve ->", env.RESERVE);
  await (await lmSet.setReserve(env.RESERVE, gas)).wait();
  console.log("LM.setLiquidityVault ->", env.LIQUIDITY_VAULT);
  await (await lmSet.setLiquidityVault(env.LIQUIDITY_VAULT, gas)).wait();
  console.log("LM.setRouter ->", env.ROUTER);
  await (await lmSet.setRouter(env.ROUTER, gas)).wait();
  if (env.KEEPER_ADDR) {
    console.log("LM.setKeeper ->", env.KEEPER_ADDR);
    await (await lmSet.setKeeper(env.KEEPER_ADDR, gas)).wait();
  }

  // Reserve -> LM
  const reserve = new ethers.Contract(env.RESERVE, ABI_RESERVE, deployer);
  console.log("Reserve.setLiquidityManager ->", lm.address);
  await (await reserve.setLiquidityManager(lm.address, gas)).wait();

  // Vault -> LM
  const vault = new ethers.Contract(env.LIQUIDITY_VAULT, ABI_VAULT, deployer);
  console.log("Vault.setLiquidityManager ->", lm.address);
  await (await vault.setLiquidityManager(lm.address, gas)).wait();

  // MasterConfig liquidity branch
  const mc = new ethers.Contract(env.MASTER_CONFIG, ABI_MC, deployer);
  console.log("MasterConfig.setLiquidityBranch ->", lm.address, env.LIQUIDITY_VAULT, env.ROUTER, env.FACTORY, env.WETH);
  await (await mc.setLiquidityBranch(lm.address, env.LIQUIDITY_VAULT, env.ROUTER, env.FACTORY, env.WETH, gas)).wait();

  console.log("Hotovo. Zapiš si novou adresu LM do .env (LIQUIDITY_MANAGER) a případně FE.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});