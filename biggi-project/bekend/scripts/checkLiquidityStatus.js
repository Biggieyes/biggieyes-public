// scripts/checkLiquidityStatus.js
// Spusť: npx hardhat run scripts/checkLiquidityStatus.js --network amoy
// Výstup: stav LM, Vault, Reserve a (volitelně) MasterConfig liquidity bundle.
// MasterConfig je nepovinný – pokud není v env, přeskočí se.

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const ABI_MC = [
  "function liquidityBundle() view returns (address,address,address,address,address)",
];

const ABI_LM = [
  "function router() view returns (address)",
  "function factory() view returns (address)",
  "function reserve() view returns (address)",
  "function liquidityVault() view returns (address)",
  "function keeper() view returns (address)",
  "function tokenPct() view returns (uint8)",
  "function slippageBps() view returns (uint256)",
  "function txDeadlineSec() view returns (uint256)",
];

const ABI_VAULT = [
  "function liquidityManager() view returns (address)",
  "function whitelistedPairs(address) view returns (bool)",
  "function lpBalanceOf(address) view returns (uint256)",
];

const ABI_ERC20 = ["function balanceOf(address) view returns (uint256)"];

const ABI_RESERVE = ["function liquidityManager() view returns (address)"];

const zero = ethers.constants.AddressZero.toLowerCase();

function maybe(addr) {
  return addr && addr.toLowerCase() !== zero ? addr : "<zero>";
}

async function main() {
  const env = process.env;
  const mcAddr = env.MASTER_CONFIG || "<unset>";
  const lmAddr = env.LIQUIDITY_MANAGER;
  const vaultAddr = env.LIQUIDITY_VAULT;
  const reserveAddr = env.RESERVE;
  const pair = env.PAIR;

  if (!lmAddr || !vaultAddr || !reserveAddr || !pair) {
    throw new Error("Chybí některá z env proměnných: LIQUIDITY_MANAGER, LIQUIDITY_VAULT, RESERVE, PAIR");
  }

  console.log("Adresa MasterConfig:", mcAddr);
  console.log("Adresa LM:", lmAddr);
  console.log("Adresa Vault:", vaultAddr);
  console.log("Adresa Reserve:", reserveAddr);
  console.log("LP Pair:", pair);

  const mc = mcAddr === "<unset>" ? null : new ethers.Contract(mcAddr, ABI_MC, ethers.provider);
  const lm = new ethers.Contract(lmAddr, ABI_LM, ethers.provider);
  const vault = new ethers.Contract(vaultAddr, ABI_VAULT, ethers.provider);
  const reserve = new ethers.Contract(reserveAddr, ABI_RESERVE, ethers.provider);
  const pairErc20 = new ethers.Contract(pair, ABI_ERC20, ethers.provider);

  // MasterConfig liquidity bundle (optional)
  let mcLm = zero, mcVault = zero, mcRouter = zero, mcFactory = zero, mcWeth = zero;
  if (mc) {
    [mcLm, mcVault, mcRouter, mcFactory, mcWeth] = await mc.liquidityBundle();
    console.log("MasterConfig.liquidityBundle (lm, vault, router, factory, weth):", [
      maybe(mcLm),
      maybe(mcVault),
      maybe(mcRouter),
      maybe(mcFactory),
      maybe(mcWeth),
    ]);
  } else {
    console.log("MasterConfig.liquidityBundle: <unset>");
  }

  // LM state
  const [lmRouter, lmFactory, lmReserve, lmVault, lmKeeper, lmPct, lmSlip, lmDeadline] = await Promise.all([
    lm.router(),
    lm.factory(),
    lm.reserve(),
    lm.liquidityVault(),
    lm.keeper(),
    lm.tokenPct(),
    lm.slippageBps(),
    lm.txDeadlineSec(),
  ]);
  console.log("LM.router:", maybe(lmRouter));
  console.log("LM.factory:", maybe(lmFactory));
  console.log("LM.reserve:", maybe(lmReserve));
  console.log("LM.liquidityVault:", maybe(lmVault));
  console.log("LM.keeper:", maybe(lmKeeper));
  console.log("LM.tokenPct%:", lmPct.toString());
  console.log("LM.slippageBps:", lmSlip.toString());
  console.log("LM.txDeadlineSec:", lmDeadline.toString());

  // Vault state
  const [vaultLm, whitelisted, lpBal] = await Promise.all([
    vault.liquidityManager(),
    vault.whitelistedPairs(pair),
    vault.lpBalanceOf(pair),
  ]);
  const lpOnToken = await pairErc20.balanceOf(vaultAddr);
  console.log("Vault.liquidityManager:", maybe(vaultLm));
  console.log("Vault.whitelisted(pair):", whitelisted);
  console.log("Vault.lpBalanceOf(pair):", lpBal.toString());
  console.log("LP ERC20 balance on vault:", lpOnToken.toString());

  // Reserve wiring
  let reserveLm = "n/a";
  try {
    reserveLm = await reserve.liquidityManager();
  } catch {
    reserveLm = "(reserve.liquidityManager() view neni k dispozici)";
  }
  console.log("Reserve.liquidityManager():", reserveLm === "n/a" ? "n/a" : maybe(reserveLm));

  // Shrnutí doporučení
  const issues = [];
  if (mc && (mcLm.toLowerCase() === zero || mcVault.toLowerCase() === zero || mcRouter.toLowerCase() === zero || mcFactory.toLowerCase() === zero || mcWeth.toLowerCase() === zero)) {
    issues.push("Doplnit MasterConfig.liquidityBranch (lm/vault/router/factory/weth)");
  }
  if (lmRouter.toLowerCase() === zero || lmFactory.toLowerCase() === zero || lmReserve.toLowerCase() === zero || lmVault.toLowerCase() === zero) {
    issues.push("Doplnit LM settery (router/factory/reserve/vault)");
  }
  if (lmKeeper.toLowerCase() === zero) {
    issues.push("Nastavit keeper v LM (setKeeper)");
  }
  if (!whitelisted) {
    issues.push("Whitelistnout pair ve Vaultu (addWhitelistedPair)");
  }
  if (lpBal.eq(0) && lpOnToken.eq(0)) {
    issues.push("Vault nemá LP – spusť executePairing nebo zkontroluj addLiquidity");
  }
  if (lpBal.eq(0) && lpOnToken.gt(0)) {
    issues.push("LP jsou ve vaultu (ERC20 balance), ale nejsou zapsané v evidenci – syncPairBalance neproběhl");
  }
  if (reserveLm !== "n/a" && reserveLm.toLowerCase() !== lmAddr.toLowerCase()) {
    issues.push("Reserve ukazuje na jiný LM – zavolej setLiquidityManager v Reserve");
  }

  console.log("\nDoporučení:");
  if (issues.length === 0) {
    console.log("OK: všechno vypadá nastavené.");
  } else {
    issues.forEach((i) => console.log("-", i));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
