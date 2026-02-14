// Wire BiggiBuyBackAgent + Policy toggles
// Env (req): BUYBACK_AGENT, ROUTER, TREASURY, POLICY
// Env (opt): DRIP_LM, KEEPER, SWAP_PATH=addr1,addr2,..., FALLBACK_SLIPPAGE_BPS, FALLBACK_DEADLINE_SEC, FALLBACK_COOLDOWN_SEC, AUTO_BUYBACK (1/0)
// Run: BUYBACK_AGENT=<addr> ROUTER=<addr> TREASURY=<addr> POLICY=<addr> npx hardhat run scripts/setupBuyback.js --network <net>

const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const agentAddr = requireEnv("BUYBACK_AGENT");
  const router = requireEnv("ROUTER");
  const treasury = requireEnv("TREASURY");
  const policy = requireEnv("POLICY");
  const dripLm = process.env.DRIP_LM;
  const keeper = process.env.KEEPER;
  const swapPathRaw = process.env.SWAP_PATH;
  const swapPath = swapPathRaw ? swapPathRaw.split(",").map((x) => x.trim()).filter(Boolean) : [];
  const fbSlip = process.env.FALLBACK_SLIPPAGE_BPS;
  const fbDeadline = process.env.FALLBACK_DEADLINE_SEC;
  const fbCooldown = process.env.FALLBACK_COOLDOWN_SEC;
  const autoBuyback = process.env.AUTO_BUYBACK;

  const agent = await ethers.getContractAt("BiggiBuybackAgent", agentAddr, signer);

  await (await agent.setRouter(router)).wait();
  await (await agent.setTreasury(treasury)).wait();
  await (await agent.setPolicy(policy)).wait();
  if (dripLm) await (await agent.setDripLM(dripLm)).wait();
  if (keeper) await (await agent.setKeeper(keeper)).wait();
  if (swapPath.length > 0) {
    await (await agent.setSwapPath(swapPath)).wait();
  }
  if (fbSlip || fbDeadline || fbCooldown) {
    const slip = fbSlip || 200;
    const deadline = fbDeadline || 600;
    const cooldown = fbCooldown || 300;
    await (await agent.setFallbacks(slip, deadline, cooldown)).wait();
  }
  if (autoBuyback === "1") {
    await (await agent.toggleAutoBuyback(true)).wait();
  } else if (autoBuyback === "0") {
    await (await agent.toggleAutoBuyback(false)).wait();
  }

  console.log("Buyback agent wired.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
