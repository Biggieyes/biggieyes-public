// Checks WETH-BIGGI liquidity on the router/factory and prints reserves and quotes
// Usage: node scripts/checkLiquidity.js
// Requires PRIVATE_KEY (for provider access only), POLYGON_RPC_URL in scripts/.env

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { ethers } = require("ethers");

// Defaults from deployment; override via env if needed
const ROUTER = process.env.ROUTER || "0x52141c1c00AdD7dF95031c684186b10b5fDf448b";
const FACTORY = process.env.FACTORY || "0x48D4D4BD5336Cc51209603AB4fA11A2dEF0Ba30F";
const WETH = process.env.WETH || "0x9984a18ee1f243992aF8d6a5E40c0373F88D99Ef";
const BIGGI = process.env.BIGGI || "0x45C6cC46dcBf54E97bDf89e9F739F29Ce4ED0dB7";

async function main() {
  const rpc = process.env.POLYGON_RPC_URL || "https://polygon.drpc.org";
  const provider = new ethers.providers.JsonRpcProvider(rpc, { name: "polygon", chainId: 137 });
  if (!process.env.PRIVATE_KEY) {
    console.warn("Warning: PRIVATE_KEY missing in scripts/.env (only read calls used).");
  }

  const factoryAbi = ["function getPair(address,address) view returns (address)"];
  const pairAbi = [
    "function getReserves() view returns (uint112,uint112,uint32)",
    "function token0() view returns (address)",
  ];
  const routerAbi = ["function getAmountsOut(uint256,address[]) view returns (uint256[])"];

  const factory = new ethers.Contract(FACTORY, factoryAbi, provider);
  const router = new ethers.Contract(ROUTER, routerAbi, provider);

  const pair = await factory.getPair(WETH, BIGGI);
  console.log("Pair address:", pair);
  if (pair === ethers.constants.AddressZero) {
    console.log("No pair found. Add liquidity first.");
    return;
  }

  const pairC = new ethers.Contract(pair, pairAbi, provider);
  const [r0, r1] = await pairC.getReserves();
  const t0 = (await pairC.token0()).toLowerCase();
  const reserves =
    t0 === WETH.toLowerCase()
      ? { weth: r0, biggi: r1 }
      : { weth: r1, biggi: r0 };

  console.log("Reserves:");
  console.log("  WETH :", reserves.weth.toString());
  console.log("  BIGGI:", reserves.biggi.toString());

  try {
    const out = await router.getAmountsOut(ethers.utils.parseEther("0.01"), [WETH, BIGGI]);
    console.log("Quote 0.01 WETH -> BIGGI:", out[1].toString());
  } catch (err) {
    console.log("Quote failed (likely no liquidity):", err.reason || err.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
