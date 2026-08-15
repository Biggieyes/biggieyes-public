// Syncs DripDistributor accounting to its on-chain BIGGI balance (syncAvailableToBalance)
// Usage: `node scripts/syncDrip.js`
// Requires PRIVATE_KEY and POLYGON_RPC_URL (or uses public Polygon mainnet RPC as fallback).

require("dotenv").config();
const { ethers } = require("ethers");

const DD_ADDRESS = process.env.DRIP_DISTRIBUTOR || "0x2564b32eE85d2DFe3c234f79BBCaA94704e91FAE";

const ddAbi = [
  "function syncAvailableToBalance() external",
  "function getAvailable() view returns (uint256)",
  "function totalTopUp() view returns (uint256)",
];

// default gas settings (can be overridden via env)
const DEFAULT_MAX_PRIORITY_GWEI = process.env.MAX_PRIORITY_GWEI || "30";
const DEFAULT_MAX_FEE_GWEI = process.env.MAX_FEE_GWEI || "60";

async function main() {
  const rpc =
    process.env.POLYGON_RPC_URL ||
    "https://polygon.drpc.org";
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY missing in .env");
  }
  const provider = new ethers.providers.JsonRpcProvider(rpc, { name: "polygon", chainId: 137 });
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const dd = new ethers.Contract(DD_ADDRESS, ddAbi, signer);

  console.log("Signer:", await signer.getAddress());

  console.log("Calling syncAvailableToBalance...");
  const tx = await dd.syncAvailableToBalance({
    maxPriorityFeePerGas: ethers.utils.parseUnits(DEFAULT_MAX_PRIORITY_GWEI, "gwei"),
    maxFeePerGas: ethers.utils.parseUnits(DEFAULT_MAX_FEE_GWEI, "gwei"),
  });
  console.log("tx hash:", tx.hash);
  await tx.wait();
  console.log("confirmed.");

  const [av, topup] = await Promise.all([
    dd.getAvailable(),
    dd.totalTopUp(),
  ]);
  console.log("available:", av.toString());
  console.log("totalTopUp:", topup.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
