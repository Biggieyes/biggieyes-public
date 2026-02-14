// Wire BiggiToken + BiggiTreasury (optionally initialDistribute)
// Env (required): TOKEN, TREASURY, RESERVE, DRIP_DISTRIBUTOR, TOKEN_REWARDS
// Env (optional): DISTRIBUTOR, BUYBACK_AGENT, REWARDS_OPERATOR, DO_DISTRIBUTE=1 to call initialDistribute
// Run: TOKEN=<addr> TREASURY=<addr> RESERVE=<addr> DRIP_DISTRIBUTOR=<addr> TOKEN_REWARDS=<addr> npx hardhat run scripts/setupTokenAndTreasury.js --network <net>

const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const tokenAddr = requireEnv("TOKEN");
  const treasuryAddr = requireEnv("TREASURY");
  const reserveAddr = requireEnv("RESERVE");
  const dripDistributorAddr = requireEnv("DRIP_DISTRIBUTOR");
  const tokenRewardsAddr = requireEnv("TOKEN_REWARDS");

  const distributorAddr = process.env.DISTRIBUTOR;
  const buybackAddr = process.env.BUYBACK_AGENT;
  const rewardsOp = process.env.REWARDS_OPERATOR;
  const doDistribute = process.env.DO_DISTRIBUTE === "1";

  const token = await ethers.getContractAt("BiggiToken", tokenAddr, signer);
  const treasury = await ethers.getContractAt("BiggiTreasury", treasuryAddr, signer);

  console.log("Configuring BiggiToken...");
  await (await token.setReserve(reserveAddr)).wait();
  await (await token.setDripDistributor(dripDistributorAddr)).wait();
  await (await token.setTokenRewards(tokenRewardsAddr)).wait();
  if (rewardsOp) {
    await (await token.setRewardsOperator(rewardsOp)).wait();
  }
  if (doDistribute) {
    try {
      await (await token.initialDistribute()).wait();
      console.log("initialDistribute executed");
    } catch (e) {
      console.log("initialDistribute failed/skipped:", e.reason || e.message);
    }
  }

  console.log("Configuring BiggiTreasury...");
  await (await treasury.setReserve(reserveAddr)).wait();
  await (await treasury.setDripDistributor(dripDistributorAddr)).wait();
  await (await treasury.setTokenRewards(tokenRewardsAddr)).wait();
  if (distributorAddr) {
    await (await treasury.setDistributor(distributorAddr)).wait();
  }
  if (buybackAddr) {
    await (await treasury.setBuybackAgent(buybackAddr)).wait();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
