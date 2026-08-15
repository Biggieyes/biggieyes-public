// src/services/distributorService.js
import { formatEther } from "ethers";
import { ADDR } from "@/shared/utils/addresses.js";
import { getMCDReaderV2RO } from "@/shared/utils/contract";
import {
  getDistributorGlobalSnapshot,
  getDistributorPendingCommunity,
  getDistributorPendingOf,
  getDistributorReceivedOfCollections,
  getDistributorWhitelisted,
} from "./tokenomics/distributorReaderCompat.js";

const toEth = (v) => (v != null ? formatEther(v) : null);

export async function getGlobalSnapshot() {
  const reader = getMCDReaderV2RO();
  if (!reader) throw new Error("Distributor reader not available");
  const snap = await getDistributorGlobalSnapshot(reader);
  return {
    collectionRewards: snap?.collectionRewards ?? null,
    reserve: snap?.reserve ?? null,
    buybackAgent: snap?.buybackAgent ?? null,
    treasury: snap?.treasury ?? null,
    communityCenter: snap?.communityCenter ?? ADDR.COMMUNITY_CENTER ?? null,
    totalPending: toEth(snap?.totalPending ?? 0n),
    totalReceived: toEth(snap?.totalReceived ?? 0n),
  };
}

export async function getPendingCommunityEth() {
  const reader = getMCDReaderV2RO();
  if (!reader) return null;
  const v = await getDistributorPendingCommunity(reader).catch(() => null);
  return v != null ? toEth(v) : null;
}

export async function getPendingOfEth(addresses = []) {
  if (!Array.isArray(addresses) || !addresses.length) return [];
  const reader = getMCDReaderV2RO();
  if (!reader) return [];
  const out = await getDistributorPendingOf(reader, addresses);
  return Array.from(out || []).map((v) => toEth(v ?? 0n));
}

export async function getReceivedOfCollectionsEth(addresses = []) {
  if (!Array.isArray(addresses) || !addresses.length) return [];
  const reader = getMCDReaderV2RO();
  if (!reader) return [];
  const out = await getDistributorReceivedOfCollections(reader, addresses);
  return Array.from(out || []).map((v) => toEth(v ?? 0n));
}

export async function getWhitelistedCollections(addresses = []) {
  if (!Array.isArray(addresses) || !addresses.length) return [];
  const reader = getMCDReaderV2RO();
  if (!reader) return [];
  const out = await getDistributorWhitelisted(reader, addresses);
  return Array.from(out || []);
}

const distributorService = {
  getGlobalSnapshot,
  getPendingCommunityEth,
  getPendingOfEth,
  getReceivedOfCollectionsEth,
  getWhitelistedCollections,
};

export default distributorService;
