// scripts/setTestParams.js
// Nastaví testovací parametry pro Policy a LiquidityManager.
// Spusť: node scripts/setTestParams.js  (nebo npx hardhat run scripts/setTestParams.js --network amoy)

const hre = require("hardhat");
const { ethers } = hre;
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.AMOY_RPC_URL || "https://polygon-amoy-bor.publicnode.com");
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("Signer:", signer.address);

  const policyAddr = process.env.POLICY;
  const lmAddr = process.env.LIQUIDITY_MANAGER;
  if (!policyAddr || !lmAddr) throw new Error("POLICY or LIQUIDITY_MANAGER missing in .env");

  const gas = {
    maxPriorityFeePerGas: ethers.utils.parseUnits(process.env.GAS_PRIORITY_GWEI || "30", "gwei"),
    maxFeePerGas: ethers.utils.parseUnits(process.env.GAS_FEE_GWEI || "60", "gwei"),
  };

  const policy = new ethers.Contract(
    policyAddr,
    [
      "function setSwapSlippageBps(uint256) external",
      "function setTxDeadlineSec(uint256) external",
      "function setMinBuybackInterval(uint256) external",
      "function setBuybacksPaused(bool) external",
      "function setMaxDailyBuybackNative(uint256) external",
    ],
    signer
  );

  const lm = new ethers.Contract(
    lmAddr,
    [
      "function setTokenPct(uint8) external",
      "function setSlippageBps(uint256) external",
      "function setTxDeadlineSec(uint256) external",
    ],
    signer
  );

  console.log("Setting policy params (swapSlippage=300 bps, deadline=600s, cooldown=60s, maxDaily=0, unpause)...");
  await (await policy.setSwapSlippageBps(300, gas)).wait();
  await (await policy.setTxDeadlineSec(600, gas)).wait();
  await (await policy.setMinBuybackInterval(60, gas)).wait();
  await (await policy.setBuybacksPaused(false, gas)).wait();
  await (await policy.setMaxDailyBuybackNative(0, gas)).wait();

  console.log("Setting LiquidityManager params (tokenPct=50%, slippage=300 bps, deadline=900s)...");
  await (await lm.setTokenPct(50, gas)).wait();
  await (await lm.setSlippageBps(300, gas)).wait();
  await (await lm.setTxDeadlineSec(900, gas)).wait();

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
