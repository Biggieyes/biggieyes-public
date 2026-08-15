// Configure BiggiPolicy
// Env (req): POLICY
// Env (opt): SLIPPAGE_BPS, DEADLINE_SEC, MIN_INTERVAL_SEC, PAUSED=1/0, MAX_DAILY_NATIVE
// Run: POLICY=<addr> npx hardhat run scripts/setupPolicy.js --network <net>

const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const policyAddr = requireEnv("POLICY");
  const policy = await ethers.getContractAt("BiggiPolicy", policyAddr, signer);

  if (process.env.SLIPPAGE_BPS) {
    await (await policy.setSwapSlippageBps(process.env.SLIPPAGE_BPS)).wait();
  }
  if (process.env.DEADLINE_SEC) {
    await (await policy.setTxDeadlineSec(process.env.DEADLINE_SEC)).wait();
  }
  if (process.env.MIN_INTERVAL_SEC) {
    await (await policy.setMinBuybackInterval(process.env.MIN_INTERVAL_SEC)).wait();
  }
  if (process.env.MAX_DAILY_NATIVE) {
    await (await policy.setMaxDailyBuybackNative(process.env.MAX_DAILY_NATIVE)).wait();
  }
  if (process.env.PAUSED === "1") {
    await (await policy.setBuybacksPaused(true)).wait();
  } else if (process.env.PAUSED === "0") {
    await (await policy.setBuybacksPaused(false)).wait();
  }

  console.log("Policy configured.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
