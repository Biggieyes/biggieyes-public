// Spustí buybackAllToTreasury na BuybackAgent pro aktuální native balance.
// Použití: `node scripts/forceBuybackAll.js`
// Vyžaduje PRIVATE_KEY (owner BA) a AMOY_RPC_URL v scripts/.env.

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { ethers } = require("ethers");

const BA =
  process.env.BUYBACK_AGENT ||
  process.env.NEW_BUYBACK_AGENT ||
  "0x4c732aD900563e09360bdCea438089594C605E5B";

const ABI = ["function buybackAllToTreasury(uint256 minOut) external"];

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing");
  const rpc = process.env.AMOY_RPC_URL || "https://polygon-amoy-bor.publicnode.com";
  const provider = new ethers.providers.JsonRpcProvider(rpc, { name: "amoy", chainId: 80002 });
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const gasPrio = ethers.utils.parseUnits(process.env.GAS_PRIORITY_GWEI || "40", "gwei");
  const gasFee = ethers.utils.parseUnits(process.env.GAS_FEE_GWEI || "80", "gwei");

  const ba = new ethers.Contract(BA, ABI, signer);
  console.log("Signer:", await signer.getAddress());
  console.log("Calling buybackAllToTreasury(minOut=0) ...");
  const tx = await ba.buybackAllToTreasury(0, {
    maxPriorityFeePerGas: gasPrio,
    maxFeePerGas: gasFee,
  });
  console.log("tx:", tx.hash);
  await tx.wait();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
