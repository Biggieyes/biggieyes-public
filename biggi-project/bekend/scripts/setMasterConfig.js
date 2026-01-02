// scripts/setMasterConfig.js
// Spusť: npx hardhat run scripts/setMasterConfig.js --network amoy
// Poplní BiggiMasterTokenomicsConfig podle adres v .env. Nenastavené hodnoty přeskočí.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI = [
  "function setCore(address,address,address,address) external",
  "function setRewards(address,address,address,address) external",
  "function setPumpBranch(address,address,address,address) external",
  "function setLiquidityBranch(address,address,address,address,address) external",
  "function setCollections(address,address,address,address) external",
  "function coreBundle() view returns (address,address,address,address)",
  "function rewardsBundle() view returns (address,address,address,address)",
  "function pumpBundle() view returns (address,address,address,address)",
  "function liquidityBundle() view returns (address,address,address,address,address)",
  "function collectionsBundle() view returns (address,address,address,address)",
  "function owner() view returns (address)",
];

function gasOverrides() {
  const prio = process.env.GAS_PRIORITY_GWEI || "30";
  const fee = process.env.GAS_FEE_GWEI || "60";
  return {
    maxPriorityFeePerGas: ethers.utils.parseUnits(prio, "gwei"),
    maxFeePerGas: ethers.utils.parseUnits(fee, "gwei"),
  };
}

function addrOrZero(v) {
  if (!v) return ethers.constants.AddressZero;
  return v;
}

async function maybeTx(label, fn) {
  const tx = await fn();
  console.log(`  ${label} tx:`, tx.hash);
  await tx.wait();
}

async function main() {
  const env = process.env;
  const mcAddr = env.MASTER_CONFIG;
  if (!mcAddr) throw new Error("Chybí MASTER_CONFIG v .env");
  if (!env.PRIVATE_KEY) throw new Error("Chybí PRIVATE_KEY v .env");

  const signer = new ethers.Wallet(env.PRIVATE_KEY, hre.ethers.provider);
  const mc = new ethers.Contract(mcAddr, ABI, signer);
  const gas = gasOverrides();

  const owner = await mc.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("POZOR: signer není owner MasterConfigu", { owner, signer: signer.address });
  }

  console.log("MasterConfig:", mcAddr);
  console.log("Signer:", signer.address);

  const core = [env.BIGGI, env.RESERVE, env.TREASURY, env.DISTRIBUTOR].map(addrOrZero);
  const rewards = [env.COLLECTION_REWARDS, env.TOKEN_REWARDS, env.NFT_REWARDS, env.COMMUNITY_CENTER].map(addrOrZero);
  const pump = [env.BUYBACK_AGENT, env.DRIP_LM, env.DRIP_DISTRIBUTOR, env.POLICY].map(addrOrZero);
  const liquidity = [env.LIQUIDITY_MANAGER, env.LIQUIDITY_VAULT, env.ROUTER, env.FACTORY, env.WETH].map(addrOrZero);
  const collections = [env.COLLECTION, env.COLLECTION2, env.REWARDS_READER || env.TOKENOMIK_READER, env.COLLECTION_DISTRIBUTOR].map(addrOrZero);

  console.log("Plánuji nastavit:");
  console.log(" core:", core);
  console.log(" rewards:", rewards);
  console.log(" pump:", pump);
  console.log(" liquidity:", liquidity);
  console.log(" collections:", collections);

  // Předchozí hodnoty
  const [corePrev, rewardsPrev, pumpPrev, liqPrev, collPrev] = await Promise.all([
    mc.coreBundle(),
    mc.rewardsBundle(),
    mc.pumpBundle(),
    mc.liquidityBundle(),
    mc.collectionsBundle(),
  ]);

  const differ = (prev, next) => prev.map((p, i) => (p.toLowerCase() === next[i].toLowerCase() ? null : { from: p, to: next[i] }));

  console.log("Diff core:", differ(corePrev, core));
  console.log("Diff rewards:", differ(rewardsPrev, rewards));
  console.log("Diff pump:", differ(pumpPrev, pump));
  console.log("Diff liquidity:", differ(liqPrev, liquidity));
  console.log("Diff collections:", differ(collPrev, collections));

  await maybeTx("setCore", () => mc.setCore(...core, gas));
  await maybeTx("setRewards", () => mc.setRewards(...rewards, gas));
  await maybeTx("setPumpBranch", () => mc.setPumpBranch(...pump, gas));
  await maybeTx("setLiquidityBranch", () => mc.setLiquidityBranch(...liquidity, gas));
  await maybeTx("setCollections", () => mc.setCollections(...collections, gas));

  console.log("Hotovo. Zkontroluj eventy CoreSet/RewardsSet/PumpSet/LiquiditySet/CollectionsSet.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});