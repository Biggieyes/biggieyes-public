// scripts/checkPairingReadiness.js
// Spusť: npx hardhat run scripts/checkPairingReadiness.js --network amoy
// Zkontroluje, proč executePairing nemintí LP: balancí na Reserve/LM, quote z routeru, callStatic executePairing.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_LM = [
  "function executePairing(uint256) external",
  "function router() view returns (address)",
  "function reserve() view returns (address)",
  "function liquidityVault() view returns (address)",
  "function tokenPct() view returns (uint8)",
  "function slippageBps() view returns (uint256)",
  "function txDeadlineSec() view returns (uint256)",
];

const ABI_RESERVE = [
  "function maticBalance() view returns (uint256)",
  "function dexRefillBiggi() view returns (uint256)",
  "function waitingBiggi() view returns (uint256)",
];

const ABI_ROUTER = [
  "function WETH() external view returns (address)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
];

const ABI_ERC20 = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];

function fmt(x, decimals = 18) {
  return Number(ethers.utils.formatUnits(x, decimals)).toLocaleString("en-US", { maximumFractionDigits: 6 });
}

async function main() {
  const env = process.env;
  if (!env.LIQUIDITY_MANAGER) throw new Error("Chybí LIQUIDITY_MANAGER v .env");
  if (!env.BIGGI) throw new Error("Chybí BIGGI v .env");
  const requested = env.REQUESTED_MATIC_WEI || "500000000000000000"; // default 0.5 MATIC

  const provider = hre.ethers.provider;
  const lm = new ethers.Contract(env.LIQUIDITY_MANAGER, ABI_LM, provider);
  const routerAddr = await lm.router();
  const reserveAddr = await lm.reserve();
  const vaultAddr = await lm.liquidityVault();
  const router = new ethers.Contract(routerAddr, ABI_ROUTER, provider);
  const biggi = new ethers.Contract(env.BIGGI, ABI_ERC20, provider);
  const reserve = new ethers.Contract(reserveAddr, ABI_RESERVE, provider);

  const weth = await router.WETH();
  const pathOut = [weth, env.BIGGI];

  const [balReserveNative, balReserveBiggi, lmNative, lmBiggi, dexRefill, waiting] = await Promise.all([
    provider.getBalance(reserveAddr),
    biggi.balanceOf(reserveAddr),
    provider.getBalance(env.LIQUIDITY_MANAGER),
    biggi.balanceOf(env.LIQUIDITY_MANAGER),
    reserve.dexRefillBiggi().catch(() => ethers.constants.Zero),
    reserve.waitingBiggi().catch(() => ethers.constants.Zero),
  ]);

  let quote = [];
  try {
    quote = await router.getAmountsOut(requested, pathOut);
  } catch (e) {
    quote = [];
  }

  console.log("LM:", env.LIQUIDITY_MANAGER);
  console.log("Router:", routerAddr, "Reserve:", reserveAddr, "Vault:", vaultAddr);
  console.log("Requested MATIC (wei):", requested);
  console.log("Reserve native:", balReserveNative.toString(), "(", fmt(balReserveNative), ")");
  console.log("Reserve BIGGI:", balReserveBiggi.toString(), "(", fmt(balReserveBiggi), ")");
  console.log("LM native:", lmNative.toString(), "(", fmt(lmNative), ")");
  console.log("LM BIGGI:", lmBiggi.toString(), "(", fmt(lmBiggi), ")");
  console.log("Reserve.dexRefillBiggi:", dexRefill.toString());
  console.log("Reserve.waitingBiggi:", waiting.toString());
  if (quote.length > 0) {
    console.log("Quote getAmountsOut(MATIC->BIGGI):", quote.map((x) => x.toString()));
  } else {
    console.log("Quote getAmountsOut failed");
  }

  // callStatic executePairing to catch revert / event
  try {
    const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);
    const lmWithSigner = lm.connect(wallet);
    await lmWithSigner.callStatic.executePairing(requested);
    console.log("callStatic executePairing: OK (no revert)");
  } catch (e) {
    console.log("callStatic executePairing reverted:", e.reason || e.errorName || e.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});