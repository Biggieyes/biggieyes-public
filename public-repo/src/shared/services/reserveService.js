// src/services/reserveService.js

import { fromWei, getReserveTreasurySnapshotRO, ADDR } from "@/shared/utils/contract";

async function getReserveSnapshot() {
  const reader = getReserveTreasurySnapshotRO();
  if (!reader) throw new Error("Reserve reader not available");
  return reader.reserveSnapshot();
}

/**
 * ZÁKLADNÍ ADRESY
 */

export async function getBiggiTokenAddress() {
  return ADDR.BIGGI;
}

export async function getLiquidityManagerAddress() {
  return ADDR.LM || ADDR.LIQUIDITY_MANAGER;
}

/**
 * BALANCE / STATY – RAW + FORMÁTOVANÉ
 */

export async function getBiggiBalanceRaw() {
  const snap = await getReserveSnapshot();
  return snap.reserveBiggi; // BIGGI (1e18)
}

export async function getBiggiBalanceFormatted() {
  const raw = await getBiggiBalanceRaw();
  return fromWei(raw); // jako "BIGGI" jednotky
}

export async function getMaticBalanceRaw() {
  const snap = await getReserveSnapshot();
  return snap.reservePol; // POL (1e18)
}

export async function getMaticBalanceFormatted() {
  const raw = await getMaticBalanceRaw();
  return fromWei(raw); // POL
}

export async function getWaitingBiggiRaw() {
  const snap = await getReserveSnapshot();
  return snap.waiting;
}

export async function getWaitingBiggiFormatted() {
  const raw = await getWaitingBiggiRaw();
  return fromWei(raw);
}

export async function getDexRefillBiggiRaw() {
  const snap = await getReserveSnapshot();
  return snap.dexRefill;
}

export async function getDexRefillBiggiFormatted() {
  const raw = await getDexRefillBiggiRaw();
  return fromWei(raw);
}

export async function getTotalMaticReceivedRaw() {
  const snap = await getReserveSnapshot();
  return snap.totalReceivedPol;
}

export async function getTotalMaticReceivedFormatted() {
  const raw = await getTotalMaticReceivedRaw();
  return fromWei(raw);
}

/**
 * BUCKET KLÍČE (pro debug / advanced UI)
 */

export async function getWaitingBucketKey() {
  return null; // not exposed in snapshot reader
}

export async function getDexRefillBucketKey() {
  return null; // not exposed in snapshot reader
}

/**
 * STATUS / OWNERSHIP
 */

export async function isReservePaused() {
  return false;
}

export async function getReserveOwner() {
  return null;
}

export async function getReservePendingOwner() {
  return null;
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

