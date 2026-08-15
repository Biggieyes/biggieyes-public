// scripts/deployAndWireLM.js
// Run: npx hardhat run scripts/deployAndWireLM.js --network polygon
// Deploys a new BiggiLiquidityManager, wires Reserve/Vault/Orchestrator/MasterConfig,
// and applies the live automation defaults used by the liquidity stack.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_RESERVE = ["function setLiquidityManager(address) external"];
const ABI_VAULT = [
  "function setLiquidityManager(address) external",
  "function addWhitelistedPair(address) external"
];
const ABI_ORCHESTRATOR = ["function setLM(address) external"];
const ABI_MC = ["function setLiquidityBranch(address,address,address,address,address) external"];
const ABI_LM_SETTERS = [
  "function setRouter(address) external",
  "function setFactory(address) external",
  "function setReserve(address) external",
  "function setLiquidityVault(address) external",
  "function setKeeper(address) external",
  "function setTokenPct(uint8) external",
  "function setSlippageBps(uint256) external",
  "function setTxDeadlineSec(uint256) external",
  "function setAutoTopUpConfig(bool,uint256,uint256) external"
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function gasOverrides() {
  const prio = process.env.GAS_PRIORITY_GWEI || "30";
  const fee = process.env.GAS_FEE_GWEI || "60";
  return {
    maxPriorityFeePerGas: ethers.utils.parseUnits(prio, "gwei"),
    maxFeePerGas: ethers.utils.parseUnits(fee, "gwei"),
  };
}

async function maybeWhitelistPair(vault, pair, gas) {
  if (!pair) return;
  try {
    await (await vault.addWhitelistedPair(pair, gas)).wait();
  } catch (error) {
    if (!String(error).includes("already whitelisted")) throw error;
  }
}

async function main() {
  const env = process.env;
  const required = [
    "BIGGI",
    "ROUTER",
    "LIQUIDITY_VAULT",
    "RESERVE",
    "FACTORY",
    "WETH",
    "MASTER_CONFIG",
    "ORCHESTRATOR",
    "PRIVATE_KEY"
  ];
  for (const key of required) requireEnv(key);

  const gas = gasOverrides();
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const keeper = env.KEEPER_ADDR || env.ORCHESTRATOR;
  const tokenPct = Number(env.TOKEN_PCT || "100");
  const slippageBps = env.SLIPPAGE_BPS || "300";
  const deadlineSec = env.DEADLINE_SEC || "600";
  const autoEnabled = env.AUTO_ENABLED === "1";
  const autoTrigger = env.AUTO_TRIGGER_POL_WEI || ethers.utils.parseEther("0.5").toString();
  const autoRequest = env.AUTO_REQUEST_POL_WEI || ethers.utils.parseEther("0.5").toString();

  const LMFactory = await ethers.getContractFactory("BiggiLiquidityManager");
  const lm = await LMFactory.deploy(env.BIGGI, env.ROUTER, env.LIQUIDITY_VAULT, deployer.address, env.RESERVE, gas);
  await lm.deployed();
  console.log("New LM deployed:", lm.address);

  const lmSet = new ethers.Contract(lm.address, ABI_LM_SETTERS, deployer);
  const reserve = new ethers.Contract(env.RESERVE, ABI_RESERVE, deployer);
  const vault = new ethers.Contract(env.LIQUIDITY_VAULT, ABI_VAULT, deployer);
  const orchestrator = new ethers.Contract(env.ORCHESTRATOR, ABI_ORCHESTRATOR, deployer);
  const mc = new ethers.Contract(env.MASTER_CONFIG, ABI_MC, deployer);

  console.log("LM.setFactory ->", env.FACTORY);
  await (await lmSet.setFactory(env.FACTORY, gas)).wait();
  console.log("LM.setReserve ->", env.RESERVE);
  await (await lmSet.setReserve(env.RESERVE, gas)).wait();
  console.log("LM.setLiquidityVault ->", env.LIQUIDITY_VAULT);
  await (await lmSet.setLiquidityVault(env.LIQUIDITY_VAULT, gas)).wait();
  console.log("LM.setRouter ->", env.ROUTER);
  await (await lmSet.setRouter(env.ROUTER, gas)).wait();
  console.log("LM.setKeeper ->", keeper);
  await (await lmSet.setKeeper(keeper, gas)).wait();
  console.log("LM.setTokenPct ->", tokenPct);
  await (await lmSet.setTokenPct(tokenPct, gas)).wait();
  console.log("LM.setSlippageBps ->", slippageBps);
  await (await lmSet.setSlippageBps(slippageBps, gas)).wait();
  console.log("LM.setTxDeadlineSec ->", deadlineSec);
  await (await lmSet.setTxDeadlineSec(deadlineSec, gas)).wait();
  console.log("LM.setAutoTopUpConfig ->", autoEnabled, autoTrigger, autoRequest);
  await (await lmSet.setAutoTopUpConfig(autoEnabled, autoTrigger, autoRequest, gas)).wait();

  console.log("Reserve.setLiquidityManager ->", lm.address);
  await (await reserve.setLiquidityManager(lm.address, gas)).wait();

  console.log("Vault.setLiquidityManager ->", lm.address);
  await (await vault.setLiquidityManager(lm.address, gas)).wait();
  await maybeWhitelistPair(vault, env.PAIR, gas);

  console.log("Orchestrator.setLM ->", lm.address);
  await (await orchestrator.setLM(lm.address, gas)).wait();

  console.log("MasterConfig.setLiquidityBranch ->", lm.address, env.LIQUIDITY_VAULT, env.ROUTER, env.FACTORY, env.WETH);
  await (await mc.setLiquidityBranch(lm.address, env.LIQUIDITY_VAULT, env.ROUTER, env.FACTORY, env.WETH, gas)).wait();

  console.log("NEW_LM=", lm.address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
