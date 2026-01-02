// Prints MultiCollectionDistributor state: recipients, totalReceived, pending amounts.
// Usage: node scripts/checkDistributor.js
// Env: PRIVATE_KEY (for provider), AMOY_RPC_URL, DISTRIBUTOR address.

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { ethers } = require("ethers");

const DISTRIBUTOR = process.env.DISTRIBUTOR || "0x2564b32eE85d2DFe3c234f79BBCaA94704e91FAE";
const BUYBACK =
  process.env.BUYBACK_AGENT ||
  process.env.NEW_BUYBACK_AGENT ||
  "0x4c732aD900563e09360bdCea438089594C605E5B";

const ABI = [
  "function collectionRewards() view returns (address)",
  "function reserve() view returns (address)",
  "function buybackAgent() view returns (address)",
  "function treasury() view returns (address)",
  "function communityCenter() view returns (address)",
  "function collections(address) view returns (bool)",
  "function totalReceived() view returns (uint256)",
  "function pending(address) view returns (uint256)",
];

async function main() {
  const rpc = process.env.AMOY_RPC_URL || "https://polygon-amoy-bor.publicnode.com";
  const provider = new ethers.providers.JsonRpcProvider(rpc, { name: "amoy", chainId: 80002 });

  const dist = new ethers.Contract(DISTRIBUTOR, ABI, provider);

  const recips = await Promise.all([
    dist.collectionRewards(),
    dist.reserve(),
    dist.buybackAgent(),
    dist.treasury(),
    dist.communityCenter(),
  ]);
  const [collR, reserve, buyback, treasury, community] = recips;

  console.log("Distributor:", DISTRIBUTOR);
  console.log("Recipients:");
  console.log("  collectionRewards:", collR);
  console.log("  reserve           :", reserve);
  console.log("  buybackAgent      :", buyback);
  console.log("  treasury          :", treasury);
  console.log("  communityCenter   :", community);

  const totalReceived = await dist.totalReceived();
  const pendingBuyback = await dist.pending(buyback);
  console.log("totalReceived:", totalReceived.toString());
  console.log("pending[buyback]:", pendingBuyback.toString());

  if (process.env.COLLECTION_TO_CHECK) {
    const wh = await dist.collections(process.env.COLLECTION_TO_CHECK);
    console.log(`Whitelisted(${process.env.COLLECTION_TO_CHECK}):`, wh);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
