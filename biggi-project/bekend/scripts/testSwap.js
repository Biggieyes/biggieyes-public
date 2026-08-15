// Quick swap test BIGGI/WPOL on new router.
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { ethers } = require("ethers");

const ROUTER = process.env.ROUTER || "0xB767E3Cd07fD0Dd96827895AB8b3801A3b141e8a";
const WETH = process.env.WETH || "0x3A433ffd460fC9aFE9cC53fc6E43f5EBFDF9D23A";
const BIGGI = process.env.BIGGI || "0xD4D0fa17f2955Eb3fF8D03ea0cD7A2f0a06E6d0E";

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing");
  const rpc = process.env.POLYGON_RPC_URL || "https://polygon.drpc.org";
  const provider = new ethers.providers.JsonRpcProvider(rpc, { name: "polygon", chainId: 137 });
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const router = new ethers.Contract(
    ROUTER,
    [
      "function swapExactETHForTokens(uint amountOutMin,address[] calldata path,address to,uint deadline) payable returns (uint[] memory amounts)",
    ],
    signer
  );

  const to = await signer.getAddress();
  const amountOutMin = ethers.utils.parseUnits("300", 18); // ~0.05 POL * 6k BIGGI/POL after slippage
  const path = [WETH, BIGGI];
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const value = ethers.utils.parseEther("0.05");

  const gasPrio = ethers.utils.parseUnits(process.env.GAS_PRIORITY_GWEI || "30", "gwei");
  const gasFee = ethers.utils.parseUnits(process.env.GAS_FEE_GWEI || "60", "gwei");

  console.log("Swapping 0.05 POL for BIGGI, minOut 300");
  const tx = await router.swapExactETHForTokens(amountOutMin, path, to, deadline, {
    value,
    gasLimit: 500_000,
    maxPriorityFeePerGas: gasPrio,
    maxFeePerGas: gasFee,
  });
  console.log("tx", tx.hash);
  const rc = await tx.wait();
  console.log("status", rc.status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
