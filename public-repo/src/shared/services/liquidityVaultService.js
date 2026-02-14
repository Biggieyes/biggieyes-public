// src/services/liquidityVaultService.js

import { getROProvider, ADDR, getReadOnlyContract } from "@/shared/utils/contract";
// Import ABI from central index to avoid case/extension issues
import { LiquidityVault as ABI_LIQUIDITY_VAULT } from "@/config/abi/index.js";

/**
 * Interní helper – vezme RO provider a vrátí instance LiquidityVault kontraktu
 */
async function getLiquidityVaultRO() {
  const provider = await getROProvider();
  return getReadOnlyContract(
    ADDR.LIQUIDITY_VAULT,
    ABI_LIQUIDITY_VAULT,
    provider,
  );
}

/**
 * ZÁKLADNÍ ADRESY
 */

export async function getVaultLiquidityManager() {
  const c = await getLiquidityVaultRO();
  return await c.liquidityManager();
}

export async function getVaultOwner() {
  const c = await getLiquidityVaultRO();
  return await c.owner();
}

/**
 * LP BALANCE & WHITELIST
 */

export async function getVaultLpBalanceRaw(lpPair) {
  const c = await getLiquidityVaultRO();
  return await c.lpBalanceOf(lpPair); // BigNumber
}

export async function getVaultLpBalance(lpPair) {
  const raw = await getVaultLpBalanceRaw(lpPair);
  return raw.toString(); // nechávám jako string, ať si to ve FE převedeš jak chceš
}

export async function isLpPairWhitelisted(lpPair) {
  const c = await getLiquidityVaultRO();
  return await c.whitelistedPairs(lpPair);
}

/**
 * Default export pro pohodlný import objektu
 */

const liquidityVaultService = {
  getVaultLiquidityManager,
  getVaultOwner,
  getVaultLpBalanceRaw,
  getVaultLpBalance,
  isLpPairWhitelisted,
};

export default liquidityVaultService;

