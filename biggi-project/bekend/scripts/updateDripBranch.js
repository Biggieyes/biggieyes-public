// scripts/updateDripBranch.js
// Spusť: `npx hardhat run scripts/updateDripBranch.js --network amoy`
//
// Env proměnné (nezbytné):
//  AMOY_RPC_URL, PRIVATE_KEY
//  DRIP_LM                = adresa BiggiDripLiquidityManager
//  DRIP_DISTRIBUTOR       = adresa DripDistributor
//  RESERVE                = adresa Reserve (kam má jít native)
//  TREASURY               = adresa Treasury (pro DripDistributor.setTreasury)
//  ROUTER                 = adresa UniswapV2 routeru (DEX)
//  BUYBACK_AGENT          = adresa BuybackAgenta (pro dripLM onlyBuybackAgent)
// Volitelné:
//  TOKENS_PER_MINT        = kolik BIGGI se účtuje za 1 mint (raw units, např. 1000e18)
//  SELL_PCT               = % z nahlášeného buybacku, které má DripLM prodávat (default 70)
//  SLIPPAGE_BPS           = slippage BPS pro DripLM (default 200)
//  DEADLINE_SEC           = deadline sec pro DripLM (default 600)
//  DRIP_KEEPER_PROXY      = adresa DripKeeperProxy (pokud chceš přenastavit dripLM)
//
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_DRIP_LM = [
  "function setRouter(address r) external",
  "function setReserve(address r) external",
  "function setDripDistributor(address d) external",
  "function setBuybackAgent(address a) external",
  "function setSellPct(uint8 pct) external",
  "function setSlippageBps(uint256 bps) external",
  "function setTxDeadlineSec(uint256 sec_) external",
];

const ABI_DRIP_DISTRIBUTOR = [
  "function setDripLM(address lm) external",
  "function setTreasury(address t) external",
  "function setTokensPerMint(uint256 v) external",
];

const ABI_KEEPER_PROXY = ["function setDripLM(address _dripLM) external"];

async function attach(addr, abi, signer) {
  return new ethers.Contract(addr, abi, signer);
}

function gasOverridesFromEnv() {
  const prio = process.env.GAS_PRIORITY_GWEI || "30";
  const fee = process.env.GAS_FEE_GWEI || "60";
  return {
    maxPriorityFeePerGas: ethers.utils.parseUnits(prio, "gwei"),
    maxFeePerGas: ethers.utils.parseUnits(fee, "gwei"),
  };
}

async function main() {
  const env = process.env;
  const required = ["DRIP_LM", "DRIP_DISTRIBUTOR", "RESERVE", "TREASURY", "ROUTER", "BUYBACK_AGENT", "PRIVATE_KEY"];
  for (const k of required) {
    if (!env[k]) throw new Error(`Chybí env proměnná: ${k}`);
  }

  const signer = new ethers.Wallet(env.PRIVATE_KEY, hre.ethers.provider);
  console.log("Signer:", signer.address);

   // EIP-1559 overrides (Amoy vyžaduje vyšší tip)
  const gasOverrides = gasOverridesFromEnv();

  const dripLM = await attach(env.DRIP_LM, ABI_DRIP_LM, signer);
  const dripD = await attach(env.DRIP_DISTRIBUTOR, ABI_DRIP_DISTRIBUTOR, signer);

  // DripDistributor wiring
  console.log("DripDistributor.setDripLM ->", env.DRIP_LM);
  await (await dripD.setDripLM(env.DRIP_LM, gasOverrides)).wait();

  console.log("DripDistributor.setTreasury ->", env.TREASURY);
  await (await dripD.setTreasury(env.TREASURY, gasOverrides)).wait();

  if (env.TOKENS_PER_MINT) {
    console.log("DripDistributor.setTokensPerMint ->", env.TOKENS_PER_MINT);
    await (await dripD.setTokensPerMint(env.TOKENS_PER_MINT, gasOverrides)).wait();
  }

  // DripLM wiring
  console.log("DripLM.setRouter ->", env.ROUTER);
  await (await dripLM.setRouter(env.ROUTER, gasOverrides)).wait();

  console.log("DripLM.setReserve ->", env.RESERVE);
  await (await dripLM.setReserve(env.RESERVE, gasOverrides)).wait();

  console.log("DripLM.setDripDistributor ->", env.DRIP_DISTRIBUTOR);
  await (await dripLM.setDripDistributor(env.DRIP_DISTRIBUTOR, gasOverrides)).wait();

  console.log("DripLM.setBuybackAgent ->", env.BUYBACK_AGENT);
  await (await dripLM.setBuybackAgent(env.BUYBACK_AGENT, gasOverrides)).wait();

  if (env.SELL_PCT) {
    console.log("DripLM.setSellPct ->", env.SELL_PCT);
    await (await dripLM.setSellPct(Number(env.SELL_PCT), gasOverrides)).wait();
  }
  if (env.SLIPPAGE_BPS) {
    console.log("DripLM.setSlippageBps ->", env.SLIPPAGE_BPS);
    await (await dripLM.setSlippageBps(env.SLIPPAGE_BPS, gasOverrides)).wait();
  }
  if (env.DEADLINE_SEC) {
    console.log("DripLM.setTxDeadlineSec ->", env.DEADLINE_SEC);
    await (await dripLM.setTxDeadlineSec(env.DEADLINE_SEC, gasOverrides)).wait();
  }

  // Keeper proxy optional
  if (env.DRIP_KEEPER_PROXY) {
    const proxy = await attach(env.DRIP_KEEPER_PROXY, ABI_KEEPER_PROXY, signer);
    console.log("DripKeeperProxy.setDripLM ->", env.DRIP_LM);
    await (await proxy.setDripLM(env.DRIP_LM, gasOverrides)).wait();
  } else {
    console.log("DRIP_KEEPER_PROXY není zadán, krok přeskočen.");
  }

  console.log("Hotovo. Drip branch je nasměrovaná na router, reserve a nového buyback agenta.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
