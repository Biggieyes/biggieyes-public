// Quick state check for DripDistributor, BuybackAgent, Reserve
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
    "function getAvailable() view returns (uint256)",
    "function totalNotified() view returns (uint256)",
    "function totalTopUp() view returns (uint256)",
  ];
  const baAbi = [
    "function nativeBalance() view returns (uint256)",
    "function biggiBalance() view returns (uint256)",
  ];
  const resAbi = [
    "function maticBalance() view returns (uint256)",
    "function dexRefillBiggi() view returns (uint256)",
  ];
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
  ];

  const dd = new ethers.Contract(ddAddr, ddAbi, provider);
  const ba = new ethers.Contract(baAddr, baAbi, provider);
  const res = new ethers.Contract(resAddr, resAbi, provider);
  const biggi = new ethers.Contract(biggiAddr, erc20Abi, provider);

  const [av, notif, topup] = await Promise.all([
    dd.getAvailable(),
    dd.totalNotified(),
    dd.totalTopUp(),
  ]);
  const [bbNative, bbBiggi] = await Promise.all([
    ba.nativeBalance(),
    ba.biggiBalance(),
  ]);
  const [resMatic, resBiggi] = await Promise.all([
    res.maticBalance(),
    res.dexRefillBiggi(),
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
  console.log("  totalNotified :", fmt(notif));
  console.log("  totalTopUp    :", fmt(topup));
  console.log("  BIGGI balance :", fmt(balDd));

  console.log("BuybackAgent");
  console.log("  nativeBalance :", fmtEth(bbNative), "MATIC");
  console.log("  biggiBalance  :", fmt(bbBiggi));
  console.log("  BIGGI balance :", fmt(balBa));

  console.log("Reserve");
  console.log("  maticBalance  :", fmtEth(resMatic), "MATIC");
  console.log("  dexRefillBiggi:", fmt(resBiggi));
  console.log("  BIGGI balance :", fmt(balRes));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
