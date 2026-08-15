// scripts/updateLiquidityBranch.js
// Spusť: npx hardhat run scripts/updateLiquidityBranch.js --network polygon
//
// Env potřebné:
//  RESERVE=0xbF694e346D69acCEb578eA7C52642C521178e385
//  LIQUIDITY_MANAGER=0xc5c197dA7d9693b16041381da11308b65dD2d7B0
//  LIQUIDITY_VAULT=0x91359936f14337CED7c1Ce03C64A872378a9650e
//  ROUTER=0x52141c1c00AdD7dF95031c684186b10b5fDf448b
//  FACTORY=0x48D4D4BD5336Cc51209603AB4fA11A2dEF0Ba30F
//  PAIR=0x59133d46598D178be59f2c6E1eFF222FFAf92229  (BIGGI-WETH)
// Volitelné: KEEPER (pokud chceš nastavit keeper na LM), GAS_PRIORITY_GWEI/GAS_FEE_GWEI

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_RESERVE = ["function setLiquidityManager(address lm) external"];
const ABI_LM = [
  "function setRouter(address r) external",
  "function setFactory(address f) external",
  "function setReserve(address r) external",
  "function setLiquidityVault(address v) external",
  "function setKeeper(address k) external",
];
const ABI_VAULT = [
  "function setLiquidityManager(address lm) external",
  "function addWhitelistedPair(address lpPair) external",
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
  const required = ["RESERVE", "LIQUIDITY_MANAGER", "LIQUIDITY_VAULT", "ROUTER", "FACTORY", "PAIR", "PRIVATE_KEY"];
  for (const k of required) {
    if (!env[k]) throw new Error(`Chybí env proměnná: ${k}`);
  }

  const signer = new ethers.Wallet(env.PRIVATE_KEY, hre.ethers.provider);
  const gas = gasOverrides();

  const reserve = new ethers.Contract(env.RESERVE, ABI_RESERVE, signer);
  const lm = new ethers.Contract(env.LIQUIDITY_MANAGER, ABI_LM, signer);
  const vault = new ethers.Contract(env.LIQUIDITY_VAULT, ABI_VAULT, signer);

  console.log("Signer:", signer.address);

  // Reserve -> LM
  console.log("Reserve.setLiquidityManager ->", env.LIQUIDITY_MANAGER);
  await (await reserve.setLiquidityManager(env.LIQUIDITY_MANAGER, gas)).wait();

  // LM wiring
  console.log("LM.setRouter ->", env.ROUTER);
  await (await lm.setRouter(env.ROUTER, gas)).wait();
  console.log("LM.setFactory ->", env.FACTORY);
  await (await lm.setFactory(env.FACTORY, gas)).wait();
  console.log("LM.setReserve ->", env.RESERVE);
  await (await lm.setReserve(env.RESERVE, gas)).wait();
  console.log("LM.setLiquidityVault ->", env.LIQUIDITY_VAULT);
  await (await lm.setLiquidityVault(env.LIQUIDITY_VAULT, gas)).wait();

  if (env.KEEPER) {
    console.log("LM.setKeeper ->", env.KEEPER);
    await (await lm.setKeeper(env.KEEPER, gas)).wait();
  } else {
    console.log("KEEPER není zadán, krok přeskočen.");
  }

  // Vault -> LM + whitelist pair
  console.log("Vault.setLiquidityManager ->", env.LIQUIDITY_MANAGER);
  await (await vault.setLiquidityManager(env.LIQUIDITY_MANAGER, gas)).wait();
  console.log("Vault.addWhitelistedPair ->", env.PAIR);
  await (await vault.addWhitelistedPair(env.PAIR, gas)).wait();

  console.log("Hotovo. Reserve/LM/Vault jsou propojené a pair whitelisted.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
