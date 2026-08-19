// Whitelist collection in MultiCollectionDistributor (addCollection)
// Usage: COLLECTION=0xYourCollection node scripts/whitelistCollection.js
// Env: PRIVATE_KEY, POLYGON_RPC_URL, DISTRIBUTOR

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { ethers } = require("ethers");

const DISTRIBUTOR = process.env.DISTRIBUTOR || "0xF29D65834e344bd229311686FccA4AAf451612e5";
const COLLECTION = process.env.COLLECTION;

if (!COLLECTION) throw new Error("Set COLLECTION env var to the collection address to whitelist");
if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in scripts/.env");

const ABI = ["function addCollection(address coll) external", "function collections(address) view returns (bool)"];

async function main() {
  const rpc = process.env.POLYGON_RPC_URL || "https://polygon.drpc.org";
  const provider = new ethers.providers.JsonRpcProvider(rpc, { name: "polygon", chainId: 137 });
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const gasPrio = ethers.utils.parseUnits(process.env.GAS_PRIORITY_GWEI || "40", "gwei");
  const gasFee = ethers.utils.parseUnits(process.env.GAS_FEE_GWEI || "80", "gwei");

  const dist = new ethers.Contract(DISTRIBUTOR, ABI, signer);

  const isWhitelisted = await dist.collections(COLLECTION);
  console.log("Distributor:", DISTRIBUTOR);
  console.log("Collection:", COLLECTION);
  console.log("Already whitelisted:", isWhitelisted);
  if (isWhitelisted) {
    console.log("Done (no change).");
    return;
  }

  const tx = await dist.addCollection(COLLECTION, {
    maxPriorityFeePerGas: gasPrio,
    maxFeePerGas: gasFee,
  });
  console.log("addCollection tx:", tx.hash);
  await tx.wait();
  console.log("Whitelisted.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
