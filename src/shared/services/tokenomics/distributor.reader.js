import { Contract, isAddress, ZeroAddress } from "ethers";
import { getProvider } from "@/web3/provider";
import {
  BiggiMultiCollectionDistributor,
  BiggiMultiCollectionDistributorReader,
} from "@/config/abi/index.js";
import { getMCDReaderV2RO } from "@/shared/utils/contract";
import { getAddresses } from "@/config/addresses/index.js";

async function _callOptional(fn, fallback = null) {
  if (typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch (error) {
    console.warn("Distributor snapshot helper call failed", fn?.name, error);
    return fallback;
  }
}

let _skipReader = false;
const _ENABLE_READER = (() => {
  try {
    return (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_ENABLE_MCD_READER === "true"
    );
  } catch {
    return false;
  }
})();

async function _callReader(fn, fallback = null) {
  if (_skipReader || typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch (error) {
    const reason = String(error?.reason || error?.message || "");
    if (
      (error?.code === "CALL_EXCEPTION" && reason.includes("require(false)")) ||
      error?.code === "BAD_DATA"
    ) {
      _skipReader = true;
    }
    console.warn("Distributor snapshot helper call failed", fn?.name, error);
    return fallback;
  }
}
function normalizeAddress(value) {
  if (!value || typeof value !== "string") return null;
  if (!isAddress(value)) return null;
  if (value === ZeroAddress) return null;
  return value;
}

export async function fetchDistributorSnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  let reader = null;
  let readerAddr = null;
  try {
    reader = getMCDReaderV2RO(provider || undefined);
    readerAddr = reader?.address ?? null;
  } catch (error) {
    console.warn("Distributor reader not available", error);
  }

  let globalSnap = null;
  let distributorAddr = null;
  let readerOk = false;

  if (_ENABLE_READER && reader && !_skipReader) {
    globalSnap = await _callReader(() => reader.globalSnapshot?.(), null);
    if (!_skipReader) {
      distributorAddr = await _callReader(() => reader.distributor?.(), null);
    }
    if (globalSnap) readerOk = true;
  }
  if (!globalSnap && _skipReader) {
    reader = null;
    readerOk = false;
  }

  // Fallback to Reader V1 (core()) if V2 call failed or ABI mismatch.
  if (_ENABLE_READER && !globalSnap && readerAddr && !_skipReader) {
    try {
      const readerV1 = new Contract(
        readerAddr,
        BiggiMultiCollectionDistributorReader,
        signerOrProvider,
      );
      globalSnap = await _callReader(() => readerV1.core?.(), null);
      if (!distributorAddr) {
        distributorAddr = await _callReader(
          () => readerV1.distributor?.(),
          null,
        );
      }
      if (globalSnap) readerOk = true;
    } catch (error) {
      console.warn("Distributor reader V1 fallback failed", error);
    }
  }

  let snap = globalSnap?.s ?? globalSnap?.[0] ?? globalSnap;
  let directDistributor = null;

  // Fallback to direct distributor contract if reader snapshots fail.
  if (!snap) {
    const addrs = getAddresses(chainId);
    const distributorFallback =
      normalizeAddress(addrs?.DISTRIBUTOR) ||
      normalizeAddress(addrs?.distributor) ||
      null;
    if (!distributorFallback) return null;
    try {
      directDistributor = new Contract(
        distributorFallback,
        BiggiMultiCollectionDistributor,
        signerOrProvider,
      );
      snap = {
        collectionRewards: await _callOptional(
          () => directDistributor.collectionRewards?.(),
          null,
        ),
        reserve: await _callOptional(() => directDistributor.reserve?.(), null),
        buybackAgent: await _callOptional(
          () => directDistributor.buybackAgent?.(),
          null,
        ),
        treasury: await _callOptional(
          () => directDistributor.treasury?.(),
          null,
        ),
        communityCenter: await _callOptional(
          () => directDistributor.communityCenter?.(),
          null,
        ),
        totalPending: await _callOptional(
          () => directDistributor.totalPending?.(),
          null,
        ),
        totalReceived: await _callOptional(
          () => directDistributor.totalReceived?.(),
          null,
        ),
      };
      distributorAddr = distributorFallback;
    } catch (error) {
      console.warn("Distributor direct snapshot failed", error);
      return null;
    }
  }

  const collectionRewards = snap?.collectionRewards ?? snap?.[0] ?? null;
  const reserve = snap?.reserve ?? snap?.[1] ?? null;
  const buybackAgent = snap?.buybackAgent ?? snap?.[2] ?? null;
  const treasury = snap?.treasury ?? snap?.[3] ?? null;
  const communityCenter = snap?.communityCenter ?? snap?.[4] ?? null;
  const totalPending = snap?.totalPending ?? snap?.[5] ?? null;
  const totalReceived = snap?.totalReceived ?? snap?.[6] ?? null;

  const normalizedTargets = [
    normalizeAddress(reserve),
    normalizeAddress(buybackAgent),
    normalizeAddress(treasury),
    normalizeAddress(collectionRewards),
    normalizeAddress(communityCenter),
  ];
  const pendingTargets = normalizedTargets.filter(Boolean);
  const pendingMap = new Map();

  if (
    pendingTargets.length &&
    readerOk &&
    typeof reader?.pendingOf === "function"
  ) {
    const pendingValues = await _callReader(
      () => reader.pendingOf(pendingTargets),
      [],
    );
    pendingTargets.forEach((addr, idx) => {
      pendingMap.set(addr.toLowerCase(), pendingValues?.[idx] ?? null);
    });
  } else if (pendingTargets.length && directDistributor) {
    const pendingValues = await Promise.all(
      pendingTargets.map((addr) =>
        _callOptional(() => directDistributor.pending?.(addr), null),
      ),
    );
    pendingTargets.forEach((addr, idx) => {
      pendingMap.set(addr.toLowerCase(), pendingValues?.[idx] ?? null);
    });
  }

  const pendingCommunity =
    readerOk && typeof reader?.pendingCommunity === "function"
      ? await _callReader(() => reader.pendingCommunity?.(), null)
      : null;

  const getPending = (addr, fallback = null) => {
    const normalized = normalizeAddress(addr);
    if (!normalized) return fallback ?? null;
    return pendingMap.get(normalized.toLowerCase()) ?? fallback ?? null;
  };

  const addrs = getAddresses(chainId);
  const fallbackDistributor = normalizeAddress(addrs?.DISTRIBUTOR) || null;
  const fallbackReserve = normalizeAddress(addrs?.RESERVE) || null;
  const fallbackTreasury = normalizeAddress(addrs?.TREASURY) || null;
  const fallbackBuyback = normalizeAddress(addrs?.BUYBACK_AGENT) || null;
  const fallbackCollection = normalizeAddress(addrs?.COLLECTION_REWARDS) || null;
  const fallbackCommunity = normalizeAddress(addrs?.COMMUNITY_CENTER) || null;
  const fallbackDRIP =
    normalizeAddress(addrs?.DRIPDistributor) ||
    normalizeAddress(addrs?.DRIP_DISTRIBUTOR) ||
    null;

  const ts = Date.now();
  return {
    ts,
    tsLabel: new Date(ts).toLocaleString(),
    address: normalizeAddress(distributorAddr) || fallbackDistributor,
    reserve: normalizeAddress(reserve) || fallbackReserve,
    BUYBACKAgent: normalizeAddress(buybackAgent) || fallbackBuyback,
    treasury: normalizeAddress(treasury) || fallbackTreasury,
    COLLECTIONREWARDS: normalizeAddress(collectionRewards) || fallbackCollection,
    COMMUNITYCENTER: normalizeAddress(communityCenter) || fallbackCommunity,
    DRIPDistributor: fallbackDRIP,
    totalPending,
    totalReceived,
    pendingReserve: getPending(reserve),
    pendingBUYBACK: getPending(buybackAgent),
    pendingTreasury: getPending(treasury),
    pendingCOLLECTIONREWARDS: getPending(collectionRewards),
    pendingCOMMUNITYCENTER: getPending(communityCenter, pendingCommunity),
    pendingCommunity: getPending(communityCenter, pendingCommunity),
  };
}
