// Wire BiggiDripLMToModerator
// Env (req): DRIP_LM, ROUTER, DRIP_DISTRIBUTOR, RESERVE, BUYBACK_AGENT, MODERATOR_CENTER
// Env (opt): RESERVE_BPS, MODERATOR_BPS, SELL_PCT, SLIPPAGE_BPS, DEADLINE_SEC
// Run: DRIP_LM=<addr> ROUTER=<addr> DRIP_DISTRIBUTOR=<addr> RESERVE=<addr> BUYBACK_AGENT=<addr> MODERATOR_CENTER=<addr> npx hardhat run scripts/setupDripLM.js --network <net>

const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const lmAddr = requireEnv("DRIP_LM");
  const router = requireEnv("ROUTER");
  const distributor = requireEnv("DRIP_DISTRIBUTOR");
  const reserve = requireEnv("RESERVE");
  const buyback = requireEnv("BUYBACK_AGENT");
  const moderator = requireEnv("MODERATOR_CENTER");

  const reserveBps = process.env.RESERVE_BPS;
  const moderatorBps = process.env.MODERATOR_BPS;
  const sellPct = process.env.SELL_PCT;
  const slippage = process.env.SLIPPAGE_BPS;
  const deadline = process.env.DEADLINE_SEC;

  const lm = await ethers.getContractAt("BiggiDripLMToModerator", lmAddr, signer);

  await (await lm.setRouter(router)).wait();
  await (await lm.setDripDistributor(distributor)).wait();
  await (await lm.setReserve(reserve)).wait();
  await (await lm.setBuybackAgent(buyback)).wait();
  await (await lm.setModeratorCenter(moderator)).wait();

  if (reserveBps && moderatorBps) {
    await (await lm.setShares(reserveBps, moderatorBps)).wait();
  }
  if (sellPct) {
    await (await lm.setSellPct(sellPct)).wait();
  }
  if (slippage) {
    await (await lm.setSlippageBps(slippage)).wait();
  }
  if (deadline) {
    await (await lm.setTxDeadlineSec(deadline)).wait();
  }

  console.log("Drip LM wired.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
