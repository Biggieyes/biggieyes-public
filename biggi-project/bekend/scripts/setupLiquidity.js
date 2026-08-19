// Wire LiquidityManager + LiquidityOrchestrator
// Env (req): LIQUIDITY_MANAGER, ORCHESTRATOR, ROUTER, FACTORY, RESERVE, VAULT
// Env (opt LM): KEEPER, TOKEN_PCT, SLIPPAGE_BPS, DEADLINE_SEC, AUTO_ENABLED=1/0, AUTO_TRIGGER_POL_WEI, AUTO_REQUEST_POL_WEI
// Env (opt ORCH): ORCH_KEEPER, MIN_POL_PER_TX, MAX_POL_PER_TX, MIN_DEX_REFILL_BIGGI, COOLDOWN_SEC, DAILY_QUOTA_POL
// Run: LIQUIDITY_MANAGER=<addr> ORCHESTRATOR=<addr> ROUTER=<addr> FACTORY=<addr> RESERVE=<addr> VAULT=<addr> npx hardhat run scripts/setupLiquidity.js --network <net>

const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const lmAddr = requireEnv("LIQUIDITY_MANAGER");
  const orchAddr = requireEnv("ORCHESTRATOR");
  const router = requireEnv("ROUTER");
  const factory = requireEnv("FACTORY");
  const reserve = requireEnv("RESERVE");
  const vault = requireEnv("VAULT");

  const lmKeeper = process.env.KEEPER;
  const tokenPct = process.env.TOKEN_PCT;
  const slip = process.env.SLIPPAGE_BPS;
  const deadline = process.env.DEADLINE_SEC;
  const autoEnabled = process.env.AUTO_ENABLED;
  const autoTrigger = process.env.AUTO_TRIGGER_POL_WEI;
  const autoRequest = process.env.AUTO_REQUEST_POL_WEI;

  const orchKeeper = process.env.ORCH_KEEPER;
  const minPol = process.env.MIN_POL_PER_TX;
  const maxPol = process.env.MAX_POL_PER_TX;
  const minDexBiggi = process.env.MIN_DEX_REFILL_BIGGI;
  const cooldown = process.env.COOLDOWN_SEC;
  const daily = process.env.DAILY_QUOTA_POL;

  const lm = await ethers.getContractAt("BiggiLiquidityManager", lmAddr, signer);
  const orch = await ethers.getContractAt("BiggiLiquidityOrchestrator", orchAddr, signer);

  console.log("Configuring LiquidityManager...");
  await (await lm.setRouter(router)).wait();
  await (await lm.setFactory(factory)).wait();
  await (await lm.setReserve(reserve)).wait();
  await (await lm.setLiquidityVault(vault)).wait();
  if (lmKeeper) await (await lm.setKeeper(lmKeeper)).wait();
  if (tokenPct) await (await lm.setTokenPct(tokenPct)).wait();
  if (slip) await (await lm.setSlippageBps(slip)).wait();
  if (deadline) await (await lm.setTxDeadlineSec(deadline)).wait();
  if (autoEnabled === "1" || autoEnabled === "0" || autoTrigger || autoRequest) {
    const enabled = autoEnabled === "0" ? false : true;
    const trigger = autoTrigger || "5000000000000000000"; // 5 POL default
    const request = autoRequest || trigger;
    await (await lm.setAutoTopUpConfig(enabled, trigger, request)).wait();
  }

  console.log("Configuring LiquidityOrchestrator...");
  await (await orch.setReserve(reserve)).wait();
  await (await orch.setLM(lmAddr)).wait();
  if (orchKeeper) await (await orch.setKeeper(orchKeeper)).wait();
  if (minPol || maxPol || minDexBiggi || cooldown || daily) {
    const min = minPol || "500000000000000000"; // 0.5
    const max = maxPol || "50000000000000000000"; // 50
    const minDex = minDexBiggi || "1000000000000000000"; // 1 BIGGI
    const cool = cooldown || "3600";
    const dq = daily || "0";
    await (await orch.setLimits(min, max, minDex, cool, dq)).wait();
  }

  console.log("Liquidity stack wired.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
