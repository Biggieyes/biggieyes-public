// src/services/distributorService.js
import { formatEther } from "ethers";
import { ADDR } from "../utils/addresses";
import { getMCDReaderV2RO } from "@/shared/utils/contract";

const toEth = (v) => (v != null ? formatEther(v) : null);

export async function getGlobalSnapshot() {
  const reader = getMCDReaderV2RO();
  if (!reader) throw new Error("Distributor reader not available");
  const raw = await reader.globalSnapshot();
  const snap = raw?.s ?? raw?.[0] ?? raw;
  return {
    collectionRewards: snap?.collectionRewards ?? snap?.[0] ?? null,
    reserve: snap?.reserve ?? snap?.[1] ?? null,
    buybackAgent: snap?.buybackAgent ?? snap?.[2] ?? null,
    treasury: snap?.treasury ?? snap?.[3] ?? null,
    communityCenter:
      snap?.communityCenter ?? snap?.[4] ?? ADDR.COMMUNITY_CENTER ?? null,
    totalPending: toEth(snap?.totalPending ?? snap?.[5] ?? 0n),
    totalReceived: toEth(snap?.totalReceived ?? snap?.[6] ?? 0n),
  };
}

export async function getPendingCommunityEth() {
  const reader = getMCDReaderV2RO();
  if (!reader) return null;
  const v = await reader.pendingCommunity?.().catch?.(() => null);
  return v != null ? toEth(v) : null;
}

export async function getPendingOfEth(addresses = []) {
  if (!Array.isArray(addresses) || !addresses.length) return [];
  const reader = getMCDReaderV2RO();
  if (!reader) return [];
  const out = await reader.pendingOf(addresses);
  return Array.from(out || []).map((v) => toEth(v ?? 0n));
}

export async function getReceivedOfCollectionsEth(addresses = []) {
  if (!Array.isArray(addresses) || !addresses.length) return [];
  const reader = getMCDReaderV2RO();
  if (!reader) return [];
  const out = await reader.receivedOfCollections(addresses);
  return Array.from(out || []).map((v) => toEth(v ?? 0n));
}

export async function getWhitelistedCollections(addresses = []) {
  if (!Array.isArray(addresses) || !addresses.length) return [];
  const reader = getMCDReaderV2RO();
  if (!reader) return [];
  const out = await reader.whitelisted(addresses);
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
