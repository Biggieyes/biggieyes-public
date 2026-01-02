// scripts/wireLiquidityBranch.js
// Spusť: npx hardhat run scripts/wireLiquidityBranch.js --network amoy
// Nastaví Reserve -> LM -> Vault propojení a whitelisting páru. Volitelně spustí jeden pairing (executePairing) přes keeper/owner.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_RESERVE = ["function setLiquidityManager(address) external"];
const ABI_LM = [
  "function setRouter(address) external",
  "function setFactory(address) external",
  "function setReserve(address) external",
  "function setLiquidityVault(address) external",
  "function setKeeper(address) external",
  "function executePairing(uint256 requestedMatic) external",
];
const ABI_VAULT = [
  "function setLiquidityManager(address) external",
  "function addWhitelistedPair(address) external",
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
  for (const k of required) if (!env[k]) throw new Error(`Chybí ${k} v .env`);

  const signer = new ethers.Wallet(env.PRIVATE_KEY, hre.ethers.provider);
  const gas = gasOverrides();

  const reserve = new ethers.Contract(env.RESERVE, ABI_RESERVE, signer);
  const lm = new ethers.Contract(env.LIQUIDITY_MANAGER, ABI_LM, signer);
  const vault = new ethers.Contract(env.LIQUIDITY_VAULT, ABI_VAULT, signer);

  console.log("Signer:", signer.address);
  console.log("Reserve:", env.RESERVE);
  console.log("LM:", env.LIQUIDITY_MANAGER);
  console.log("Vault:", env.LIQUIDITY_VAULT);
  console.log("Router/Factory:", env.ROUTER, env.FACTORY);
  console.log("Pair:", env.PAIR);
  console.log("Keeper:", env.KEEPER_ADDR || "<not set>");

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

  if (env.KEEPER_ADDR) {
    console.log("LM.setKeeper ->", env.KEEPER_ADDR);
    await (await lm.setKeeper(env.KEEPER_ADDR, gas)).wait();
  } else {
    console.log("KEEPER_ADDR není zadán, krok přeskočen");
  }

  // Vault wiring
  console.log("Vault.setLiquidityManager ->", env.LIQUIDITY_MANAGER);
  await (await vault.setLiquidityManager(env.LIQUIDITY_MANAGER, gas)).wait();
  console.log("Vault.addWhitelistedPair ->", env.PAIR);
  await (await vault.addWhitelistedPair(env.PAIR, gas)).wait();

  // Volitelně spustit pairing (mintne LP do vaultu a LM zavolá syncPairBalance)
  if (env.RUN_PAIRING === "true") {
    const requested = env.REQUESTED_MATIC_WEI;
    if (!requested) throw new Error("RUN_PAIRING=true, ale chybí REQUESTED_MATIC_WEI");
    console.log("LM.executePairing ->", requested, "wei");
    await (await lm.executePairing(requested, gas)).wait();
    console.log("Pairing hotov.");
  } else {
    console.log("RUN_PAIRING není true, pairing se nespustil.");
  }

  console.log("Hotovo. Rameno Reserve-LM-Vault je nastavené.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});