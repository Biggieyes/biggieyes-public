// Wire MultiCollectionDistributor recipients + whitelist
// Env (req): DISTRIBUTOR
// Env (opt): COLLECTION_REWARDS, RESERVE, BUYBACK_AGENT, TREASURY, COMMUNITY_CENTER, COLLECTIONS=addr1,addr2,...
// Run: DISTRIBUTOR=<addr> npx hardhat run scripts/setupMultiCollectionDistributor.js --network <net>

const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const distAddr = requireEnv("DISTRIBUTOR");
  const collectionRewards = process.env.COLLECTION_REWARDS;
  const reserve = process.env.RESERVE;
  const buyback = process.env.BUYBACK_AGENT;
  const treasury = process.env.TREASURY;
  const community = process.env.COMMUNITY_CENTER;
  const collectionsRaw = process.env.COLLECTIONS;
  const collections = collectionsRaw ? collectionsRaw.split(",").map((x) => x.trim()).filter(Boolean) : [];

  const dist = await ethers.getContractAt("MultiCollectionDistributor", distAddr, signer);

  if (collectionRewards) await (await dist.setCollectionRewards(collectionRewards)).wait();
  if (reserve) await (await dist.setReserve(reserve)).wait();
  if (buyback) await (await dist.setBuybackAgent(buyback)).wait();
  if (treasury) await (await dist.setTreasury(treasury)).wait();
  if (community) await (await dist.setCommunityCenter(community)).wait();

  for (const coll of collections) {
    await (await dist.addCollection(coll)).wait();
    console.log("Collection whitelisted:", coll);
  }

  console.log("MultiCollectionDistributor wired.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
