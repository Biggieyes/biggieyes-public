// src/services/distributorService.js

import { fromWei, getDistributorRO } from "../utils/contract";

/**
 * ZÁKLADNÍ ADRESY / DRÁHY TOKŮ
 */

export async function getBuybackAgentAddress() {
  const c = await getDistributorRO();
  return await c.buybackAgent();
}

export async function getCollectionRewardsAddress() {
  const c = await getDistributorRO();
  return await c.collectionRewards();
}

export async function getCommunityCenterAddress() {
  const c = await getDistributorRO();
  return await c.communityCenter();
}

export async function getReserveAddress() {
  const c = await getDistributorRO();
  return await c.reserve();
}

export async function getTreasuryAddress() {
  const c = await getDistributorRO();
  return await c.treasury();
}

/**
 * MULTI-COLLECTION MAPOVÁNÍ
 */

export async function isCollectionRegistered(collectionAddr) {
  const c = await getDistributorRO();
  return await c.collections(collectionAddr);
}

/**
 * AGREGÁTY – TOTALS
 */

export async function getTotalReceivedRaw() {
  const c = await getDistributorRO();
  return await c.totalReceived(); // BigNumber
}

export async function getTotalReceivedEth() {
  const raw = await getTotalReceivedRaw();
  return fromWei(raw);
}

export async function getTotalPendingRaw() {
  const c = await getDistributorRO();
  return await c.totalPending();
}

export async function getTotalPendingEth() {
  const raw = await getTotalPendingRaw();
  return fromWei(raw);
}

/**
 * PER-COLLECTION / PER-RECIPIENT STAV
 */

export async function getReceivedByCollectionRaw(collectionAddr) {
  const c = await getDistributorRO();
  return await c.receivedByCollection(collectionAddr);
}

export async function getReceivedByCollectionEth(collectionAddr) {
  const raw = await getReceivedByCollectionRaw(collectionAddr);
  return fromWei(raw);
}

export async function getPendingMapRaw(addr) {
  const c = await getDistributorRO();
  return await c.pending(addr);
}

export async function getPendingMapEth(addr) {
  const raw = await getPendingMapRaw(addr);
  return fromWei(raw);
}

export async function getPendingOfRaw(recipient) {
  const c = await getDistributorRO();
  return await c.pendingOf(recipient);
}

export async function getPendingOfEth(recipient) {
  const raw = await getPendingOfRaw(recipient);
  return fromWei(raw);
}

/**
 * STATUS
 */

export async function isDistributorPaused() {
  const c = await getDistributorRO();
  return await c.paused();
}

export async function getDistributorOwner() {
  const c = await getDistributorRO();
  return await c.owner();
}

/**
 * Default export – můžeš importovat jako objekt
 */

const distributorService = {
  getBuybackAgentAddress,
  getCollectionRewardsAddress,
  getCommunityCenterAddress,
  getReserveAddress,
  getTreasuryAddress,
  isCollectionRegistered,
  getTotalReceivedRaw,
  getTotalReceivedEth,
  getTotalPendingRaw,
  getTotalPendingEth,
  getReceivedByCollectionRaw,
  getReceivedByCollectionEth,
  getPendingMapRaw,
  getPendingMapEth,
  getPendingOfRaw,
  getPendingOfEth,
  isDistributorPaused,
  getDistributorOwner,
};

export default distributorService;

