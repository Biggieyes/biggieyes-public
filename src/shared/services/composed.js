// src/services/composed.js
// Composite helpers that traverse contract relationships and return aggregated stats
// Example: reserve -> liquidity manager -> liquidity vault

import reserveService from "./reserveService";
import liquidityManagerService from "./liquidityManagerService";
import liquidityVaultService from "./liquidityVaultService";
import { ADDR } from "@/shared/utils/addresses.js";
import { getTokenRO, getROProvider, fromWei } from "@/shared/utils/contract";

/**
 * Get aggregated stats for Reserve → LM → LiquidityVault chain.
 * Returns an object { reserve, lm, liquidityVault } with friendly fields.
 */
export async function getReserveLmLvStats() {
  // Reserve
  const reserve = reserveService;
  const [liquidityManager, totalMaticReceived, biggiBalance] =
    await Promise.all([
      reserve.getLiquidityManagerAddress().catch(() => null),
      reserve.getTotalMaticReceivedFormatted().catch(() => "0"),
      reserve.getBiggiBalanceFormatted().catch(() => "0"),
    ]);

  const reserveStats = {
    address: ADDR.RESERVE,
    liquidityManager,
    totalMaticReceived,
    biggiBalance,
  };

  // Liquidity Manager
  const lm = liquidityManagerService;
  const [liquidityVault, tokenPctPercent, slippagePercent] = await Promise.all([
    lm.getLiquidityVaultAddress().catch(() => null),
    lm.getLmTokenPctPercent().catch(() => 0),
    lm.getLmSlippagePercent().catch(() => 0),
  ]);

  const lmStats = {
    address: ADDR.LM,
    liquidityVault,
    tokenPctPercent,
    slippagePercent,
  };

  // Liquidity Vault
  const lv = liquidityVaultService;
  const [owner, vaultLiquidityManager] = await Promise.all([
    lv.getVaultOwner().catch(() => null),
    lv.getVaultLiquidityManager().catch(() => null),
  ]);

  const liquidityVaultStats = {
    address:
      liquidityVault &&
      liquidityVault !== "0x0000000000000000000000000000000000000000"
        ? liquidityVault
        : ADDR.LIQUIDITY_VAULT,
    owner,
    liquidityManager: vaultLiquidityManager,
  };

  return {
    reserve: reserveStats,
    lm: lmStats,
    liquidityVault: liquidityVaultStats,
  };
}

export default { getReserveLmLvStats };

/**
 * Get BIGGI token balances for Reserve, LiquidityManager and LiquidityVault.
 * Returns formatted strings (ether units) suitable for charts.
 */
export async function getBiggiBalancesAcrossReserveLmLv(provider = null) {
  const prov = provider || getROProvider();
  const token = getTokenRO(prov);

  // Addresses: prefer runtime-discovered, fallback to static ADDR
  const reserveAddr = ADDR.RESERVE;
  let lmAddr = null;
  let lvAddr = null;
  try {
    lmAddr = await reserveService.getLiquidityManagerAddress();
  } catch {
    lmAddr = ADDR.LM;
  }
  try {
    lvAddr = await liquidityManagerService.getLiquidityVaultAddress();
  } catch {
    lvAddr = ADDR.LIQUIDITY_VAULT;
  }

  const [reserveRaw, lmRaw, lvRaw] = await Promise.all([
    token.balanceOf(reserveAddr).catch(() => 0n),
    token.balanceOf(lmAddr).catch(() => 0n),
    token.balanceOf(lvAddr).catch(() => 0n),
  ]);

  return {
    reserve: fromWei(reserveRaw),
    liquidityManager: fromWei(lmRaw),
    liquidityVault: fromWei(lvRaw),
    raw: {
      reserve: reserveRaw,
      liquidityManager: lmRaw,
      liquidityVault: lvRaw,
    },
  };
}
