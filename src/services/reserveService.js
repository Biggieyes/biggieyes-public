// src/services/reserveService.js

import { fromWei, getReserveRO } from "../utils/contract";

/**
 * ZÁKLADNÍ ADRESY
 */

export async function getBiggiTokenAddress() {
  const c = await getReserveRO();
  return await c.BIGGI();
}

export async function getLiquidityManagerAddress() {
  const c = await getReserveRO();
  return await c.liquidityManager();
}

/**
 * BALANCE / STATY – RAW + FORMÁTOVANÉ
 */

export async function getBiggiBalanceRaw() {
  const c = await getReserveRO();
  return await c.biggiBalance(); // BIGGI (1e18)
}

export async function getBiggiBalanceFormatted() {
  const raw = await getBiggiBalanceRaw();
  return fromWei(raw); // jako "BIGGI" jednotky
}

export async function getMaticBalanceRaw() {
  const c = await getReserveRO();
  return await c.maticBalance(); // POL (1e18)
}

export async function getMaticBalanceFormatted() {
  const raw = await getMaticBalanceRaw();
  return fromWei(raw); // POL
}

export async function getWaitingBiggiRaw() {
  const c = await getReserveRO();
  return await c.waitingBiggi();
}

export async function getWaitingBiggiFormatted() {
  const raw = await getWaitingBiggiRaw();
  return fromWei(raw);
}

export async function getDexRefillBiggiRaw() {
  const c = await getReserveRO();
  return await c.dexRefillBiggi();
}

export async function getDexRefillBiggiFormatted() {
  const raw = await getDexRefillBiggiRaw();
  return fromWei(raw);
}

export async function getTotalMaticReceivedRaw() {
  const c = await getReserveRO();
  return await c.totalMaticReceived();
}

export async function getTotalMaticReceivedFormatted() {
  const raw = await getTotalMaticReceivedRaw();
  return fromWei(raw);
}

/**
 * BUCKET KLÍČE (pro debug / advanced UI)
 */

export async function getWaitingBucketKey() {
  const c = await getReserveRO();
  return await c.WAITING(); // bytes32
}

export async function getDexRefillBucketKey() {
  const c = await getReserveRO();
  return await c.DEX_REFILL(); // bytes32
}

/**
 * STATUS / OWNERSHIP
 */

export async function isReservePaused() {
  const c = await getReserveRO();
  return await c.paused();
}

export async function getReserveOwner() {
  const c = await getReserveRO();
  return await c.owner();
}

export async function getReservePendingOwner() {
  const c = await getReserveRO();
  return await c.pendingOwner();
}

/**
 * Default export – můžeš importovat jako objekt
 */

const reserveService = {
  getBiggiTokenAddress,
  getLiquidityManagerAddress,
  getBiggiBalanceRaw,
  getBiggiBalanceFormatted,
  getMaticBalanceRaw,
  getMaticBalanceFormatted,
  getWaitingBiggiRaw,
  getWaitingBiggiFormatted,
  getDexRefillBiggiRaw,
  getDexRefillBiggiFormatted,
  getTotalMaticReceivedRaw,
  getTotalMaticReceivedFormatted,
  getWaitingBucketKey,
  getDexRefillBucketKey,
  isReservePaused,
  getReserveOwner,
  getReservePendingOwner,
};

export default reserveService;
