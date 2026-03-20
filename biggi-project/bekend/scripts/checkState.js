// Quick state check for DripDistributor, BuybackAgent, Reserve, Treasury
// Usage: `node scripts/checkState.js`
// Reads RPC URL from .env (AMOY_RPC_URL) or falls back to public Amoy endpoint.

require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  const rpc =
    process.env.AMOY_RPC_URL ||
    "https://polygon-amoy-bor.publicnode.com";
  const provider = new ethers.providers.JsonRpcProvider(rpc, { name: "amoy", chainId: 80002 });

  const ddAddr = process.env.DRIP_DISTRIBUTOR || "0x2564b32eE85d2DFe3c234f79BBCaA94704e91FAE";
  const baAddr =
    process.env.BUYBACK_AGENT ||
    process.env.NEW_BUYBACK_AGENT ||
    "0x4c732aD900563e09360bdCea438089594C605E5B";
  const resAddr = process.env.RESERVE || "0xbF694e346D69acCEb578eA7C52642C521178e385";
  const biggiAddr = process.env.BIGGI || "0x45C6cC46dcBf54E97bDf89e9F739F29Ce4ED0dB7";

  const ddAbi = [
    "function availableTokens() view returns (uint256)",
    "function effectiveAvailable() view returns (uint256)",
    "function biggiBalance() view returns (uint256)",
    "function totalNotified() view returns (uint256)",
    "function totalReceived() view returns (uint256)",
    "function totalClaimed() view returns (uint256)",
  ];
  const baAbi = [
    "function nativeBalance() view returns (uint256)",
    "function biggiBalance() view returns (uint256)",
    "function totalNativeReceived() view returns (uint256)",
    "function totalNativeSpent() view returns (uint256)",
    "function totalBiggiAcquired() view returns (uint256)",
  ];
  const resAbi = [
    "function polBalance() view returns (uint256)",
    "function dexRefillBiggi() view returns (uint256)",
    "function waitingBiggi() view returns (uint256)",
  ];
  const treasuryAbi = [
    "function polBalance() view returns (uint256)",
    "function biggiBalance() view returns (uint256)",
    "function totalBiggiReceivedFromBuyback() view returns (uint256)",
    "function totalPolReceivedFromDistributor() view returns (uint256)",
  ];
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
  ];

  const dd = new ethers.Contract(ddAddr, ddAbi, provider);
  const ba = new ethers.Contract(baAddr, baAbi, provider);
  const res = new ethers.Contract(resAddr, resAbi, provider);
  const treasuryAddr = process.env.TREASURY || "0xE2fa9DFFc69f53b42dC41681bfFd22dA74c64461";
  const treasury = new ethers.Contract(treasuryAddr, treasuryAbi, provider);
  const biggi = new ethers.Contract(biggiAddr, erc20Abi, provider);

  const [av, effAv, ddBiggi, notif, totalReceived, totalClaimed] = await Promise.all([
    dd.availableTokens(),
    dd.effectiveAvailable(),
    dd.biggiBalance(),
    dd.totalNotified(),
    dd.totalReceived(),
    dd.totalClaimed(),
  ]);
  const [bbNative, bbBiggi, bbNativeIn, bbNativeSpent, bbBiggiAcquired] = await Promise.all([
    ba.nativeBalance(),
    ba.biggiBalance(),
    ba.totalNativeReceived(),
    ba.totalNativeSpent(),
    ba.totalBiggiAcquired(),
  ]);
  const [resPol, resBiggi, resWaiting] = await Promise.all([
    res.polBalance(),
    res.dexRefillBiggi(),
    res.waitingBiggi(),
  ]);
  const [trPol, trBiggi, trBiggiIn, trPolIn] = await Promise.all([
    treasury.polBalance(),
    treasury.biggiBalance(),
    treasury.totalBiggiReceivedFromBuyback(),
    treasury.totalPolReceivedFromDistributor(),
  ]);
  const [balDd, balRes, balBa] = await Promise.all([
    biggi.balanceOf(ddAddr),
    biggi.balanceOf(resAddr),
    biggi.balanceOf(baAddr),
  ]);

  const fmt = (bn) => ethers.utils.commify(bn.toString());
  const fmtEth = (bn) => ethers.utils.formatEther(bn);

  console.log("DripDistributor");
  console.log("  available     :", fmt(av));
  console.log("  effectiveAvail:", fmt(effAv));
  console.log("  biggiBalance  :", fmt(ddBiggi));
  console.log("  totalNotified :", fmt(notif));
  console.log("  totalReceived :", fmt(totalReceived));
  console.log("  totalClaimed  :", fmt(totalClaimed));
  console.log("  BIGGI balance :", fmt(balDd));

  console.log("BuybackAgent");
  console.log("  nativeBalance :", fmtEth(bbNative), "POL");
  console.log("  biggiBalance  :", fmt(bbBiggi));
  console.log("  nativeIn      :", fmtEth(bbNativeIn), "POL");
  console.log("  nativeSpent   :", fmtEth(bbNativeSpent), "POL");
  console.log("  biggiAcquired :", fmt(bbBiggiAcquired));
  console.log("  BIGGI balance :", fmt(balBa));

  console.log("Reserve");
  console.log("  polBalance    :", fmtEth(resPol), "POL");
  console.log("  waitingBiggi  :", fmt(resWaiting));
  console.log("  dexRefillBiggi:", fmt(resBiggi));
  console.log("  BIGGI balance :", fmt(balRes));

  console.log("Treasury");
  console.log("  polBalance    :", fmtEth(trPol), "POL");
  console.log("  biggiBalance  :", fmt(trBiggi));
  console.log("  biggiFromBB   :", fmt(trBiggiIn));
  console.log("  polFromDist   :", fmtEth(trPolIn), "POL");

  const strandedDrip = ddBiggi.sub(av);
  if (strandedDrip.gt(0)) {
    console.log("Warning");
    console.log("  DripDistributor has unaccounted BIGGI:", fmt(strandedDrip));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
