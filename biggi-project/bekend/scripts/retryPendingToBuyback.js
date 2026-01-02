// Retries pending buyback share from MultiCollectionDistributor to BuybackAgent
// Usage: `node scripts/retryPendingToBuyback.js`
// Requires PRIVATE_KEY (owner of distributor) and AMOY_RPC_URL in scripts/.env

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { ethers } = require("ethers");

const DISTRIBUTOR = process.env.DISTRIBUTOR || "0x2564b32eE85d2DFe3c234f79BBCaA94704e91FAE";
const BUYBACK =
  process.env.BUYBACK_AGENT ||
  process.env.NEW_BUYBACK_AGENT ||
  "0x4c732aD900563e09360bdCea438089594C605E5B";

const ABI = [
  "function pending(address) view returns (uint256)",
  "function retryPending(address recipient) external",
];

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in .env");
  const rpc = process.env.AMOY_RPC_URL || "https://polygon-amoy-bor.publicnode.com";
  const provider = new ethers.providers.JsonRpcProvider(rpc, { name: "amoy", chainId: 80002 });
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const gasPrio = ethers.utils.parseUnits(process.env.GAS_PRIORITY_GWEI || "40", "gwei");
  const gasFee = ethers.utils.parseUnits(process.env.GAS_FEE_GWEI || "80", "gwei");

  const dist = new ethers.Contract(DISTRIBUTOR, ABI, signer);

  console.log("Signer:", await signer.getAddress());
  const before = await dist.pending(BUYBACK);
  console.log("Pending for buyback before:", before.toString());
  if (before.isZero()) {
    console.log("Nothing pending, exiting.");
    return;
  }

  const tx = await dist.retryPending(BUYBACK, {
    maxPriorityFeePerGas: gasPrio,
    maxFeePerGas: gasFee,
  });
  console.log("retryPending tx:", tx.hash);
  await tx.wait();

  const after = await dist.pending(BUYBACK);
  console.log("Pending for buyback after:", after.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
