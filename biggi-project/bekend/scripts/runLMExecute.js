// Triggers LiquidityManager.executePairing(requestedMatic)
// Usage: REQUESTED_MATIC=0.5 node scripts/runLMExecute.js
// Env: PRIVATE_KEY, AMOY_RPC_URL, LIQUIDITY_MANAGER

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { ethers } = require("ethers");

const LM = process.env.LIQUIDITY_MANAGER || "0x1f60516dAb945297E7A12B729fE108e093b56e1e";
const REQUESTED = process.env.REQUESTED_MATIC || "0.5"; // in MATIC

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing in scripts/.env");
  const rpc = process.env.AMOY_RPC_URL || "https://polygon-amoy-bor.publicnode.com";
  const provider = new ethers.providers.JsonRpcProvider(rpc, { name: "amoy", chainId: 80002 });
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const gasPrio = ethers.utils.parseUnits(process.env.GAS_PRIORITY_GWEI || "40", "gwei");
  const gasFee = ethers.utils.parseUnits(process.env.GAS_FEE_GWEI || "80", "gwei");

  const lm = new ethers.Contract(LM, ["function executePairing(uint256) external"], signer);

  console.log("Signer:", await signer.getAddress());
  console.log("LiquidityManager:", LM);
  console.log("requestedMatic:", REQUESTED, "MATIC");

  const tx = await lm.executePairing(ethers.utils.parseEther(REQUESTED), {
    maxPriorityFeePerGas: gasPrio,
    maxFeePerGas: gasFee,
  });
  console.log("executePairing tx:", tx.hash);
  await tx.wait();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
