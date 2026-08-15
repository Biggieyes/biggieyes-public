// scripts/readMasterConfig.js
// Spusť: npx hardhat run scripts/readMasterConfig.js --network polygon
// Vyčte bundly z BiggiMasterTokenomicsConfig a ukáže, co je už nastaveno.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI = [
  "function coreBundle() view returns (address,address,address,address)",
  "function rewardsBundle() view returns (address,address,address,address)",
  "function pumpBundle() view returns (address,address,address,address)",
  "function liquidityBundle() view returns (address,address,address,address,address)",
  "function collectionsBundle() view returns (address,address,address,address)",
];

async function main() {
  const addr = process.env.MASTER_CONFIG;
  if (!addr) throw new Error("Chybí MASTER_CONFIG v .env");

  const c = new ethers.Contract(addr, ABI, ethers.provider);

  const [core, rewards, pump, liq, colls] = await Promise.all([
    c.coreBundle(),
    c.rewardsBundle(),
    c.pumpBundle(),
    c.liquidityBundle(),
    c.collectionsBundle(),
  ]);

  const pretty = (arr) => arr.map((a) => a === ethers.constants.AddressZero ? "<zero>" : a);

  console.log("MasterConfig:", addr);
  console.log("core          (biggiToken, reserve, treasury, distributor):", pretty(core));
  console.log("rewards       (collectionRewards, tokenRewards, nftRewards, communityCenter):", pretty(rewards));
  console.log("pump          (buybackAgent, dripLM, dripDistributor, policy):", pretty(pump));
  console.log("liquidity     (liquidityManager, liquidityVault, router, factory, weth9):", pretty(liq));
  console.log("collections   (mainCollection, publicCollection, rewardsReader, collectionDistributor):", pretty(colls));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
