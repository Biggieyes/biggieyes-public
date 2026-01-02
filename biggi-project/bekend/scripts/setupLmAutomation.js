/**
 * Setup LM branch (Reserve -> LiquidityManager -> LiquidityVault) and KeeperProxy automation.
 * Reads required addresses and thresholds from .env.
 *
 * Required env vars:
 *  - RESERVE
 *  - LIQUIDITY_MANAGER
 *  - LIQUIDITY_VAULT
 *  - ROUTER
 *  - FACTORY
 *  - PAIR             (whitelisted pair address)
 *  - KEEPER_PROXY     (Chainlink upkeep proxy calling LM)
 *  - INTERVAL_SEC     (check interval in seconds)
 *  - MIN_MATIC_WEI    (threshold in wei for reserve)
 *  - MIN_TOKENS_WEI   (threshold in wei for reserve BIGGI)
 *  - REQUESTED_MATIC_WEI (amount LM should request per upkeep)
 */

require("dotenv").config({ path: "./scripts/.env" });
const hre = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const reserveAddr   = requireEnv("RESERVE");
  const lmAddr        = requireEnv("LIQUIDITY_MANAGER");
  const vaultAddr     = requireEnv("LIQUIDITY_VAULT");
  const routerAddr    = requireEnv("ROUTER");
  const factoryAddr   = requireEnv("FACTORY");
  const pairAddr      = requireEnv("PAIR");
  const keeperProxy   = requireEnv("KEEPER_PROXY");
  const intervalSec   = requireEnv("INTERVAL_SEC");
  const minMaticWei   = requireEnv("MIN_MATIC_WEI");
  const minTokensWei  = requireEnv("MIN_TOKENS_WEI");
  const reqMaticWei   = requireEnv("REQUESTED_MATIC_WEI");

  const [signer] = await hre.ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  // Minimal ABIs for the calls we need
  const reserveAbi = ["function setLiquidityManager(address) external"];
  const lmAbi = [
    "function setRouter(address) external",
    "function setFactory(address) external",
    "function setReserve(address) external",
    "function setLiquidityVault(address) external",
    "function setKeeper(address) external"
  ];
  const vaultAbi = [
    "function setLiquidityManager(address) external",
    "function addWhitelistedPair(address) external"
  ];
  const proxyAbi = [
    "function setConfig(address reserve_, address lm_, uint256 intervalSec, uint256 minMatic_, uint256 minTokens_, uint256 requestedMatic_) external"
  ];

  const reserve = new hre.ethers.Contract(reserveAddr, reserveAbi, signer);
  const lm      = new hre.ethers.Contract(lmAddr, lmAbi, signer);
  const vault   = new hre.ethers.Contract(vaultAddr, vaultAbi, signer);
  const proxy   = new hre.ethers.Contract(keeperProxy, proxyAbi, signer);

  // Wiring
  await (await reserve.setLiquidityManager(lmAddr)).wait();
  await (await lm.setRouter(routerAddr)).wait();
  await (await lm.setFactory(factoryAddr)).wait();
  await (await lm.setReserve(reserveAddr)).wait();
  await (await lm.setLiquidityVault(vaultAddr)).wait();
  await (await lm.setKeeper(keeperProxy)).wait();
  await (await vault.setLiquidityManager(lmAddr)).wait();
  try {
    await (await vault.addWhitelistedPair(pairAddr)).wait();
  } catch (e) {
    if (String(e).includes("already whitelisted")) {
      console.log("Pair already whitelisted, skipping.");
    } else {
      throw e;
    }
  }

  // KeeperProxy config
  await (
    await proxy.setConfig(
      reserveAddr,
      lmAddr,
      intervalSec,
      minMaticWei,
      minTokensWei,
      reqMaticWei
    )
  ).wait();

  console.log("Done: LM branch wired + KeeperProxy configured.");
  console.log(`  reserve : ${reserveAddr}`);
  console.log(`  lm      : ${lmAddr}`);
  console.log(`  vault   : ${vaultAddr}`);
  console.log(`  router  : ${routerAddr}`);
  console.log(`  factory : ${factoryAddr}`);
  console.log(`  pair    : ${pairAddr}`);
  console.log(`  proxy   : ${keeperProxy}`);
  console.log(`  interval: ${intervalSec}s, minMatic: ${minMaticWei}, minTokens: ${minTokensWei}, requestedMatic: ${reqMaticWei}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
