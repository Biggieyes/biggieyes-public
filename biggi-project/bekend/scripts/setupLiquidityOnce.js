// scripts/setupLiquidityOnce.js
// Spustit: npx hardhat run scripts/setupLiquidityOnce.js --network amoy
// Před spuštěním nastav v .env (nebo env proměnnými):
// AMOY_RPC_URL, PRIVATE_KEY, FACTORY, ROUTER, BIGGI, WETH (pokud chceš předepsanou), LIQ_TOKEN_AMOUNT, LIQ_ETH_AMOUNT
// VOLITELNĚ: TRANSFER_FROM_RESERVE=true pokud chceš nejdříve volat BiggiToken.transferFromReserveTo
// VOLITELNĚ: GAS_PRIORITY_GWEI, GAS_FEE_GWEI pro nastavení EIP-1559 (default 30/60)

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  // volitelně (BiggiToken)
  "function transferFromReserveTo(address,uint256)"
];

const ROUTER_ABI = [
  "function addLiquidityETH(address token,uint amountTokenDesired,uint amountTokenMin,uint amountETHMin,address to,uint deadline) payable returns (uint amountToken,uint amountETH,uint liquidity)",
  "function WETH() view returns (address)"
];

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address)"
];

async function main() {
  const env = process.env;
  const required = ["ROUTER", "FACTORY", "BIGGI", "LIQ_TOKEN_AMOUNT", "LIQ_ETH_AMOUNT", "PRIVATE_KEY"];
  for (const r of required) {
    if (!env[r]) {
      throw new Error(`Chybí .env hodnota: ${r}`);
    }
  }

  // EIP-1559 gas nastavení (Amoy vyžaduje tip minimálně ~25 gwei)
  const GAS_PRIORITY_GWEI = env.GAS_PRIORITY_GWEI || "30";
  const GAS_FEE_GWEI = env.GAS_FEE_GWEI || "60";
  const maxPriorityFeePerGas = ethers.utils.parseUnits(GAS_PRIORITY_GWEI, "gwei");
  const maxFeePerGas = ethers.utils.parseUnits(GAS_FEE_GWEI, "gwei");
  const gasOverrides = { maxPriorityFeePerGas, maxFeePerGas };

  // Pokud pošleš WETH adresu, použije se; jinak fallback na router.WETH()
  const DEFAULT_WETH_FROM_USER = "0x9984a18ee1f243992aF8d6a5E40c0373F88D99Ef";
  const ROUTER_ADDR = env.ROUTER;
  const FACTORY_ADDR = env.FACTORY;
  const BIGGI_ADDR = env.BIGGI;
  const PAIR_GIVEN = env.PAIR || null;
  const WETH_ADDR = env.WETH || DEFAULT_WETH_FROM_USER;
  const LIQ_TOKEN_AMOUNT = env.LIQ_TOKEN_AMOUNT; // např. "1000.0"
  const LIQ_ETH_AMOUNT = env.LIQ_ETH_AMOUNT;     // např. "1.0"
  const TRANSFER_FROM_RESERVE = env.TRANSFER_FROM_RESERVE === "true";

  const provider = hre.ethers.provider;
  const wallet = new ethers.Wallet(env.PRIVATE_KEY, provider);

  console.log("Signer:", wallet.address);
  console.log("Token:", BIGGI_ADDR);
  console.log("Router:", ROUTER_ADDR);
  console.log("Factory:", FACTORY_ADDR);
  console.log("WETH (using):", WETH_ADDR);
  if (PAIR_GIVEN) console.log("Pair (given):", PAIR_GIVEN);
  console.log("Gas overrides:", {
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
    maxFeePerGas: maxFeePerGas.toString(),
  });

  // attach contracts
  const token = new ethers.Contract(BIGGI_ADDR, ERC20_ABI, wallet);
  const router = new ethers.Contract(ROUTER_ADDR, ROUTER_ABI, wallet);
  const factory = new ethers.Contract(FACTORY_ADDR, FACTORY_ABI, wallet);

  // 1) ověř pair (pokud existuje)
  try {
    const pairAddr = await factory.getPair(BIGGI_ADDR, WETH_ADDR);
    console.log("Factory.getPair(BIGGI,WETH) =", pairAddr);
    if (pairAddr === ethers.constants.AddressZero && !PAIR_GIVEN) {
      console.warn("POZOR: pair neexistuje (getPair === 0x0). Router/pair musí být UniswapV2-kompatibilní.");
    }
  } catch (err) {
    console.warn("Nepodařilo se zavolat factory.getPair – zkontroluj FACTORY ABI/kompatibilitu.", err.message || err);
  }

  // 2) načti decimals, amounts
  const decimals = await token.decimals();
  const amountTokenDesired = ethers.utils.parseUnits(LIQ_TOKEN_AMOUNT.toString(), decimals);
  const amountETHDesired = ethers.utils.parseEther(LIQ_ETH_AMOUNT.toString());

  console.log("Token decimals:", decimals);
  console.log("amountTokenDesired (wei):", amountTokenDesired.toString());
  console.log("amountETHDesired (wei):", amountETHDesired.toString());

  // 3) volitelně: transferFromReserveTo (owner-only na BiggiToken)
  if (TRANSFER_FROM_RESERVE) {
    console.log("TRANSFER_FROM_RESERVE=true – volám transferFromReserveTo(wallet.address, amountTokenDesired)");
    try {
      const tx = await token.transferFromReserveTo(wallet.address, amountTokenDesired, gasOverrides);
      console.log("transferFromReserveTo tx sent:", tx.hash);
      const rc = await tx.wait();
      console.log("transferFromReserveTo mined, status:", rc.status);
    } catch (err) {
      console.error("Chyba při transferFromReserveTo:", err.error?.message || err.message || err);
      throw new Error("transferFromReserveTo selhalo – zkontroluj práva / reserve balance / owner");
    }
  }

  // 4) kontrola balance / allowance
  const bal = await token.balanceOf(wallet.address);
  console.log("Balance:", ethers.utils.formatUnits(bal, decimals));
  if (bal.lt(amountTokenDesired)) {
    throw new Error(`Nedostatek tokenů na wallet. Potřebuješ >= ${LIQ_TOKEN_AMOUNT} tokenů.`);
  }

  const allowance = await token.allowance(wallet.address, ROUTER_ADDR);
  console.log("Allowance to router:", ethers.utils.formatUnits(allowance, decimals));
  if (allowance.lt(amountTokenDesired)) {
    console.log("Nezbytné approve -> volám token.approve(router, amountTokenDesired) ...");
    try {
      const tx = await token.approve(ROUTER_ADDR, amountTokenDesired, gasOverrides);
      console.log("approve tx sent:", tx.hash);
      await tx.wait();
      console.log("approve mined.");
    } catch (err) {
      console.error("approve selhalo:", err.error?.message || err.message || err);
      throw new Error("approve selhalo");
    }
  } else {
    console.log("Allowance OK, pokračuji.");
  }

  // 5) addLiquidityETH
  const minToken = amountTokenDesired.mul(995).div(1000); // 99.5%
  const minETH   = amountETHDesired.mul(995).div(1000);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 30; // 30 min

  console.log("Volám router.addLiquidityETH(...) s minToken/minETH = 99.5%");

  try {
    const tx = await router.addLiquidityETH(
      BIGGI_ADDR,
      amountTokenDesired,
      minToken,
      minETH,
      wallet.address,
      deadline,
      { value: amountETHDesired, gasLimit: 2_000_000, ...gasOverrides }
    );
    console.log("Tx sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Receipt status:", receipt.status, "blockNumber:", receipt.blockNumber);
    if (receipt.status === 1) {
      console.log("Add liquidity succeed. Logs:", receipt.logs.length);
    } else {
      console.error("Add liquidity failed. Receipt:", receipt);
    }
  } catch (err) {
    console.error("Error during addLiquidityETH:", err.error?.message || err.message || err);
    console.error("Doporučení: ověř kompatibilitu ROUTER/FACTORY (UniswapV2), existenci pairu a správné decimals tokenu.");
    throw err;
  }

  console.log("Hotovo.");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
