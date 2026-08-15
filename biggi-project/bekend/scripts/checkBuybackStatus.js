// Spusť: npx hardhat run scripts/checkBuybackStatus.js --network polygon
const hre = require("hardhat");
const { ethers } = hre;

const ABI_AGENT = [
  "function policy() view returns (address)",
  "function lastBuybackAt() view returns (uint256)",
  "function nativeBalance() view returns (uint256)",
];
const ABI_POLICY = [
  "function buybacksPaused() view returns (bool)",
  "function minBuybackInterval() view returns (uint256)",
];

async function main() {
  const agentAddr = process.env.NEW_BUYBACK_AGENT || process.env.BUYBACK_AGENT;
  if (!agentAddr) throw new Error("Chybí BUYBACK_AGENT/NEW_BUYBACK_AGENT v .env");
  const agent = await ethers.getContractAt(ABI_AGENT, agentAddr);
  const [policyAddr, last, nativeBal] = await Promise.all([
    agent.policy(),
    agent.lastBuybackAt(),
    agent.nativeBalance(),
  ]);
  let paused = null;
  let interval = null;
  if (policyAddr && policyAddr !== ethers.constants.AddressZero) {
    const pol = await ethers.getContractAt(ABI_POLICY, policyAddr);
    [paused, interval] = await Promise.all([pol.buybacksPaused(), pol.minBuybackInterval()]);
  }
  console.log("BuybackAgent:", agentAddr);
  console.log("  policy         ", policyAddr);
  console.log("  nativeBalance  ", nativeBal.toString());
  console.log("  lastBuybackAt  ", last.toString());
  console.log("Policy:", { paused, minBuybackInterval: interval?.toString?.() });
}

main().catch((err) => { console.error(err); process.exit(1); });
