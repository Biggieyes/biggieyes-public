// Spusť: npx hardhat run scripts/checkDripBranch.js --network amoy
// Čte stav DripLM, DripDistributor a pump bundle v MasterConfig.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_LM = [
  "function router() view returns (address)",
  "function reserve() view returns (address)",
  "function dripDistributor() view returns (address)",
  "function buybackAgent() view returns (address)",
  "function sellPct() view returns (uint8)",
  "function slippageBps() view returns (uint256)",
  "function txDeadlineSec() view returns (uint256)",
];

const ABI_DD = [
  "function dripLM() view returns (address)",
  "function treasury() view returns (address)",
  "function tokensPerMint() view returns (uint256)",
  "function availableTokens() view returns (uint256)",
  "function totalTopUp() view returns (uint256)",
];

const ABI_MC = ["function pumpBundle() view returns (address,address,address,address)"];

function fmt(wei) {
  return Number(ethers.utils.formatUnits(wei, 18)).toLocaleString("en-US", { maximumFractionDigits: 6 });
}

async function main() {
  const env = process.env;
  const lmAddr = env.DRIP_LM;
  const ddAddr = env.DRIP_DISTRIBUTOR;
  const mcAddr = env.MASTER_CONFIG;
  if (!lmAddr || !ddAddr || !mcAddr) throw new Error("Chybí DRIP_LM / DRIP_DISTRIBUTOR / MASTER_CONFIG v .env");

  const lm = new ethers.Contract(lmAddr, ABI_LM, ethers.provider);
  const dd = new ethers.Contract(ddAddr, ABI_DD, ethers.provider);
  const mc = new ethers.Contract(mcAddr, ABI_MC, ethers.provider);

  const [router, reserve, ddSet, buybackAgent, sellPct, slippage, deadline, ddLm, ddTreasury, tokensPerMint, avail, topup, pump] = await Promise.all([
    lm.router(),
    lm.reserve(),
    lm.dripDistributor(),
    lm.buybackAgent(),
    lm.sellPct(),
    lm.slippageBps(),
    lm.txDeadlineSec(),
    dd.dripLM(),
    dd.treasury(),
    dd.tokensPerMint(),
    dd.availableTokens(),
    dd.totalTopUp(),
    mc.pumpBundle(),
  ]);

  console.log("Drip LM:", lmAddr);
  console.log("  router           ", router);
  console.log("  reserve          ", reserve);
  console.log("  dripDistributor  ", ddSet);
  console.log("  buybackAgent     ", buybackAgent);
  console.log("  sellPct          ", sellPct.toString());
  console.log("  slippageBps      ", slippage.toString());
  console.log("  txDeadlineSec    ", deadline.toString());

  console.log("Drip Distributor:", ddAddr);
  console.log("  dripLM           ", ddLm);
  console.log("  treasury         ", ddTreasury);
  console.log("  tokensPerMint    ", tokensPerMint.toString());
  console.log("  availableTokens  ", avail.toString(), " (", fmt(avail), ")");
  console.log("  totalTopUp       ", topup.toString(), " (", fmt(topup), ")");

  console.log("MasterConfig pump bundle (buybackAgent, dripLM, dripDistributor, policy):", pump);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
