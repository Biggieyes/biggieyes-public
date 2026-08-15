// Sends a test amount of native to BuybackAgent, then forces buybackAllToTreasury(0)
// Usage: AMOUNT_MATIC=0.02 node scripts/fundAndBuyback.js
// Env: PRIVATE_KEY, POLYGON_RPC_URL, BUYBACK_AGENT

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { ethers } = require("ethers");

const BUYBACK =
  process.env.BUYBACK_AGENT ||
  process.env.NEW_BUYBACK_AGENT ||
  "0x4c732aD900563e09360bdCea438089594C605E5B";
const AMOUNT = process.env.AMOUNT_MATIC || "0.02";

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in scripts/.env");
  const rpc = process.env.POLYGON_RPC_URL || "https://polygon.drpc.org";
  const provider = new ethers.providers.JsonRpcProvider(rpc, { name: "polygon", chainId: 137 });
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const gasPrio = ethers.utils.parseUnits(process.env.GAS_PRIORITY_GWEI || "40", "gwei");
  const gasFee = ethers.utils.parseUnits(process.env.GAS_FEE_GWEI || "80", "gwei");

  console.log("Signer:", await signer.getAddress());
  console.log("Sending", AMOUNT, "MATIC to BA", BUYBACK);
  const tx1 = await signer.sendTransaction({
    to: BUYBACK,
    value: ethers.utils.parseEther(AMOUNT),
    maxPriorityFeePerGas: gasPrio,
    maxFeePerGas: gasFee,
  });
  console.log("fund tx:", tx1.hash);
  await tx1.wait();

  const ba = new ethers.Contract(
    BUYBACK,
    ["function buybackAllToTreasury(uint256 minOut) external"],
    signer
  );
  console.log("Calling buybackAllToTreasury(0) ...");
  const tx2 = await ba.buybackAllToTreasury(0, {
    maxPriorityFeePerGas: gasPrio,
    maxFeePerGas: gasFee,
  });
  console.log("buyback tx:", tx2.hash);
  await tx2.wait();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
