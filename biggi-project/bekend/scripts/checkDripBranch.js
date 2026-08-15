// Spusť: npx hardhat run scripts/checkDripBranch.js --network polygon
// Čte stav DripLM, DripDistributor, Treasury, Distributoru a pump bundle v MasterConfig.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_LM = [
  "function router() view returns (address)",
  "function reserve() view returns (address)",
  "function dripDistributor() view returns (address)",
  "function buybackAgent() view returns (address)",
  "function moderatorCenter() view returns (address)",
  "function reserveShareBps() view returns (uint16)",
  "function moderatorShareBps() view returns (uint16)",
  "function sellPct() view returns (uint8)",
  "function slippageBps() view returns (uint256)",
  "function txDeadlineSec() view returns (uint256)",
];

const ABI_DD = [
  "function dripLM() view returns (address)",
  "function treasury() view returns (address)",
  "function tokensPerMintOperator() view returns (address)",
  "function tokensPerMint() view returns (uint256)",
  "function availableTokens() view returns (uint256)",
  "function effectiveAvailable() view returns (uint256)",
  "function totalReceived() view returns (uint256)",
  "function totalClaimed() view returns (uint256)",
  "function totalNotified() view returns (uint256)",
  "function biggiBalance() view returns (uint256)",
  "function paused() view returns (bool)",
  "function collections(address) view returns (bool)",
];

const ABI_TREASURY = [
  "function distributor() view returns (address)",
  "function buybackAgent() view returns (address)",
  "function reserveAddr() view returns (address)",
  "function dripDistributor() view returns (address)",
  "function tokenRewards() view returns (address)",
  "function polBalance() view returns (uint256)",
  "function biggiBalance() view returns (uint256)",
  "function totalBiggiReceivedFromBuyback() view returns (uint256)",
  "function totalPolReceivedFromDistributor() view returns (uint256)",
];

const ABI_DIST = [
  "function reserve() view returns (address)",
  "function buybackAgent() view returns (address)",
  "function treasury() view returns (address)",
  "function totalReceived() view returns (uint256)",
  "function pending(address) view returns (uint256)",
];

const ABI_MC = [
  "function coreBundle() view returns (address,address,address,address)",
  "function pumpBundle() view returns (address,address,address,address)",
];

function fmt(wei) {
  return Number(ethers.utils.formatUnits(wei, 18)).toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function sameAddr(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

async function main() {
  const env = process.env;
  const lmAddr = env.DRIP_LM;
  const ddAddr = env.DRIP_DISTRIBUTOR;
  const mcAddr = env.MASTER_CONFIG;
  const treasuryAddr = env.TREASURY;
  const distributorAddr = env.DISTRIBUTOR;
  const collection1 = env.COLLECTION || env.MAIN;
  const collection2 = env.COLLECTION2 || env.MAIN2;
  if (!lmAddr || !ddAddr || !mcAddr || !treasuryAddr || !distributorAddr) {
    throw new Error("Chybí DRIP_LM / DRIP_DISTRIBUTOR / MASTER_CONFIG / TREASURY / DISTRIBUTOR v .env");
  }

  const lm = new ethers.Contract(lmAddr, ABI_LM, ethers.provider);
  const dd = new ethers.Contract(ddAddr, ABI_DD, ethers.provider);
  const treasury = new ethers.Contract(treasuryAddr, ABI_TREASURY, ethers.provider);
  const distributor = new ethers.Contract(distributorAddr, ABI_DIST, ethers.provider);
  const mc = new ethers.Contract(mcAddr, ABI_MC, ethers.provider);

  const [
    router,
    reserve,
    ddSet,
    buybackAgent,
    moderatorCenter,
    reserveShareBps,
    moderatorShareBps,
    sellPct,
    slippage,
    deadline,
    ddLm,
    ddTreasury,
    ddOperator,
    tokensPerMint,
    avail,
    effectiveAvail,
    totalReceived,
    totalClaimed,
    totalNotified,
    ddBalance,
    ddPaused,
    coll1Allowed,
    coll2Allowed,
    trDistributor,
    trBuyback,
    trReserve,
    trDrip,
    trTokenRewards,
    trPol,
    trBiggi,
    trBiggiFromBuyback,
    trPolFromDistributor,
    distReserve,
    distBuyback,
    distTreasury,
    distTotalReceived,
    distPendingBuyback,
    core,
    pump,
  ] = await Promise.all([
    lm.router(),
    lm.reserve(),
    lm.dripDistributor(),
    lm.buybackAgent(),
    lm.moderatorCenter(),
    lm.reserveShareBps(),
    lm.moderatorShareBps(),
    lm.sellPct(),
    lm.slippageBps(),
    lm.txDeadlineSec(),
    dd.dripLM(),
    dd.treasury(),
    dd.tokensPerMintOperator(),
    dd.tokensPerMint(),
    dd.availableTokens(),
    dd.effectiveAvailable(),
    dd.totalReceived(),
    dd.totalClaimed(),
    dd.totalNotified(),
    dd.biggiBalance(),
    dd.paused(),
    collection1 ? dd.collections(collection1) : Promise.resolve(false),
    collection2 ? dd.collections(collection2) : Promise.resolve(false),
    treasury.distributor(),
    treasury.buybackAgent(),
    treasury.reserveAddr(),
    treasury.dripDistributor(),
    treasury.tokenRewards(),
    treasury.polBalance(),
    treasury.biggiBalance(),
    treasury.totalBiggiReceivedFromBuyback(),
    treasury.totalPolReceivedFromDistributor(),
    distributor.reserve(),
    distributor.buybackAgent(),
    distributor.treasury(),
    distributor.totalReceived(),
    distributor.pending(env.BUYBACK_AGENT),
    mc.coreBundle(),
    mc.pumpBundle(),
  ]);

  console.log("Drip LM:", lmAddr);
  console.log("  router           ", router);
  console.log("  reserve          ", reserve);
  console.log("  dripDistributor  ", ddSet);
  console.log("  buybackAgent     ", buybackAgent);
  console.log("  moderatorCenter  ", moderatorCenter);
  console.log("  shares           ", `${reserveShareBps.toString()} / ${moderatorShareBps.toString()}`);
  console.log("  sellPct          ", sellPct.toString());
  console.log("  slippageBps      ", slippage.toString());
  console.log("  txDeadlineSec    ", deadline.toString());

  console.log("Drip Distributor:", ddAddr);
  console.log("  dripLM           ", ddLm);
  console.log("  treasury         ", ddTreasury);
  console.log("  operator         ", ddOperator);
  console.log("  tokensPerMint    ", tokensPerMint.toString());
  console.log("  availableTokens  ", avail.toString(), " (", fmt(avail), ")");
  console.log("  effectiveAvail   ", effectiveAvail.toString(), " (", fmt(effectiveAvail), ")");
  console.log("  biggiBalance     ", ddBalance.toString(), " (", fmt(ddBalance), ")");
  console.log("  totalReceived    ", totalReceived.toString(), " (", fmt(totalReceived), ")");
  console.log("  totalClaimed     ", totalClaimed.toString(), " (", fmt(totalClaimed), ")");
  console.log("  totalNotified    ", totalNotified.toString(), " (", fmt(totalNotified), ")");
  console.log("  paused           ", ddPaused);
  if (collection1) console.log("  collection1 ok   ", coll1Allowed, collection1);
  if (collection2) console.log("  collection2 ok   ", coll2Allowed, collection2);

  console.log("Treasury:", treasuryAddr);
  console.log("  distributor      ", trDistributor);
  console.log("  buybackAgent     ", trBuyback);
  console.log("  reserveAddr      ", trReserve);
  console.log("  dripDistributor  ", trDrip);
  console.log("  tokenRewards     ", trTokenRewards);
  console.log("  polBalance       ", trPol.toString(), " (", fmt(trPol), ")");
  console.log("  biggiBalance     ", trBiggi.toString(), " (", fmt(trBiggi), ")");
  console.log("  totalBiggiIn     ", trBiggiFromBuyback.toString(), " (", fmt(trBiggiFromBuyback), ")");
  console.log("  totalPolIn       ", trPolFromDistributor.toString(), " (", fmt(trPolFromDistributor), ")");

  console.log("Distributor:", distributorAddr);
  console.log("  reserve          ", distReserve);
  console.log("  buybackAgent     ", distBuyback);
  console.log("  treasury         ", distTreasury);
  console.log("  totalReceived    ", distTotalReceived.toString(), " (", fmt(distTotalReceived), ")");
  console.log("  pendingBuyback   ", distPendingBuyback.toString(), " (", fmt(distPendingBuyback), ")");

  console.log("MasterConfig core bundle (biggi, reserve, treasury, distributor):", core);
  console.log("MasterConfig pump bundle (buybackAgent, dripLM, dripDistributor, policy):", pump);

  const warnings = [];
  if (!sameAddr(ddLm, lmAddr)) warnings.push("DripDistributor.dripLM != DRIP_LM");
  if (!sameAddr(ddTreasury, treasuryAddr)) warnings.push("DripDistributor.treasury != TREASURY");
  if (!sameAddr(ddOperator, lmAddr)) warnings.push("DripDistributor.tokensPerMintOperator != DRIP_LM");
  if (!sameAddr(router, env.ROUTER)) warnings.push("DripLM.router != ROUTER");
  if (!sameAddr(reserve, env.RESERVE)) warnings.push("DripLM.reserve != RESERVE");
  if (!sameAddr(ddSet, ddAddr)) warnings.push("DripLM.dripDistributor != DRIP_DISTRIBUTOR");
  if (!sameAddr(buybackAgent, env.BUYBACK_AGENT)) warnings.push("DripLM.buybackAgent != BUYBACK_AGENT");
  if (!sameAddr(trDistributor, distributorAddr)) warnings.push("Treasury.distributor != DISTRIBUTOR");
  if (!sameAddr(trBuyback, env.BUYBACK_AGENT)) warnings.push("Treasury.buybackAgent != BUYBACK_AGENT");
  if (!sameAddr(trReserve, env.RESERVE)) warnings.push("Treasury.reserveAddr != RESERVE");
  if (!sameAddr(trDrip, ddAddr)) warnings.push("Treasury.dripDistributor != DRIP_DISTRIBUTOR");
  if (!sameAddr(distReserve, env.RESERVE)) warnings.push("Distributor.reserve != RESERVE");
  if (!sameAddr(distBuyback, env.BUYBACK_AGENT)) warnings.push("Distributor.buybackAgent != BUYBACK_AGENT");
  if (!sameAddr(distTreasury, treasuryAddr)) warnings.push("Distributor.treasury != TREASURY");
  if (!sameAddr(core[1], env.RESERVE)) warnings.push("MasterConfig.core.reserve != RESERVE");
  if (!sameAddr(core[2], treasuryAddr)) warnings.push("MasterConfig.core.treasury != TREASURY");
  if (!sameAddr(core[3], distributorAddr)) warnings.push("MasterConfig.core.distributor != DISTRIBUTOR");
  if (!sameAddr(pump[0], env.BUYBACK_AGENT)) warnings.push("MasterConfig.pump.buybackAgent != BUYBACK_AGENT");
  if (!sameAddr(pump[1], lmAddr)) warnings.push("MasterConfig.pump.dripLM != DRIP_LM");
  if (!sameAddr(pump[2], ddAddr)) warnings.push("MasterConfig.pump.dripDistributor != DRIP_DISTRIBUTOR");
  if (ddBalance.gt(avail)) warnings.push(`DripDistributor has ${fmt(ddBalance.sub(avail))} BIGGI above availableTokens (needs syncAvailableToBalance or treasury top-up via depositTokens).`);
  if (trPol.gt(0) && trPolFromDistributor.eq(0)) warnings.push("Treasury holds POL but totalPolReceivedFromDistributor is 0 (Distributor forwards via fallback/receiveMintShare path, not depositPolFromDistributor accounting).");
  if (collection1 && !coll1Allowed) warnings.push("COLLECTION is not whitelisted in DripDistributor.");
  if (collection2 && !coll2Allowed) warnings.push("COLLECTION2 is not whitelisted in DripDistributor.");
  if (warnings.length) {
    console.log("Warnings:");
    for (const warning of warnings) console.log("  -", warning);
  } else {
    console.log("Warnings: none");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
