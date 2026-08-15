// src/services/liquidityManagerService.js

import { getLMRO } from "@/shared/utils/contract";

/**
 * ZÁKLADNÍ ADRESY
 */

export async function getLmBiggiTokenAddress() {
  const c = await getLMRO();
  return await c.BIGGI();
}

export async function getLmFactoryAddress() {
  const c = await getLMRO();
  return await c.factory();
}

export async function getLmRouterAddress() {
  const c = await getLMRO();
  return await c.router();
}

export async function getLmReserveAddress() {
  const c = await getLMRO();
  return await c.reserve();
}

export async function getLiquidityVaultAddress() {
  const c = await getLMRO();
  return await c.liquidityVault();
}

export async function getLmKeeperAddress() {
  const c = await getLMRO();
  return await c.keeper();
}

/**
 * PARAMETRY – slippage / poměr / deadline
 */

export async function getLmSlippageBpsRaw() {
  const c = await getLMRO();
  return await c.slippageBps(); // BigNumber (např. 300 = 3%, 10000 = 100%)
}

export async function getLmSlippagePercent() {
  const raw = await getLmSlippageBpsRaw();
  return Number(raw) / 100; // 100 bps = 1 %
}

export async function getLmTokenPctRaw() {
  const c = await getLMRO();
  return await c.tokenPct(); // uint8
}

export async function getLmTokenPctPercent() {
  const raw = await getLmTokenPctRaw();
  return Number(raw); // už je to v %
}

export async function getLmTxDeadlineSecRaw() {
  const c = await getLMRO();
  return await c.txDeadlineSec(); // BigNumber (sekundy)
}

export async function getLmTxDeadlineSeconds() {
  const raw = await getLmTxDeadlineSecRaw();
  return Number(raw); // např. 1200 sec
}

/**
 * OWNER
 */

export async function getLmOwner() {
  const c = await getLMRO();
  return await c.owner();
}

/**
 * Default export – pro pohodlný import objektu
 */

const liquidityManagerService = {
  getLmBiggiTokenAddress,
  getLmFactoryAddress,
  getLmRouterAddress,
  getLmReserveAddress,
  getLiquidityVaultAddress,
  getLmKeeperAddress,
  getLmSlippageBpsRaw,
  getLmSlippagePercent,
  getLmTokenPctRaw,
  getLmTokenPctPercent,
  getLmTxDeadlineSecRaw,
  getLmTxDeadlineSeconds,
  getLmOwner,
};

export default liquidityManagerService;

