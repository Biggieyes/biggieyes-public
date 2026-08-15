import { Contract, isAddress, ZeroAddress } from "ethers";
import { getProvider } from "@/web3/provider";
import { BiggiMultiCollectionDistributor } from "@/config/abi/index.js";
import { getMCDReaderV2RO } from "@/shared/utils/contract";
import { getAddresses } from "@/config/addresses/index.js";
import { multicallReadContract } from "@/shared/utils/multicall.js";
import {
  getDistributorGlobalSnapshot,
  getDistributorPendingCommunity,
  getDistributorPendingOf,
} from "./distributorReaderCompat.js";

const COMMUNITY_VIEW_ABI = ["function poolBalance() view returns (uint256)"];

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
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const raw = String(import.meta.env.VITE_ENABLE_MCD_READER || "")
        .trim()
        .toLowerCase();
      if (raw === "false" || raw === "0") return false;
    }
    return true;
  } catch {
    return true;
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

async function _multicallOptional(provider, contract, entries, label) {
  try {
    return await multicallReadContract(provider, contract, entries);
  } catch (error) {
    console.warn(`Distributor snapshot ${label} multicall failed`, error);
    return null;
  }
}

export async function fetchDistributorSnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const readProvider =
    signerOrProvider?.provider ||
    signerOrProvider?.runner?.provider ||
    signerOrProvider?.runner ||
    signerOrProvider;
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
  let snapshotSource = "Direct distributor";

  if (_ENABLE_READER && reader && !_skipReader) {
    globalSnap = await _callReader(
      () => getDistributorGlobalSnapshot(reader),
      null,
    );
    if (!_skipReader) {
      distributorAddr = await _callReader(() => reader.distributor?.(), null);
    }
    if (globalSnap) {
      readerOk = true;
      snapshotSource = "MCD Reader V2";
    }
  }
  if (!globalSnap && _skipReader) {
    reader = null;
    readerOk = false;
  }
  let snap = globalSnap;
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
      const directMulti = await _multicallOptional(
        readProvider,
        directDistributor,
        [
          { key: "collectionRewards", method: "collectionRewards" },
          { key: "reserve", method: "reserve" },
          { key: "buybackAgent", method: "buybackAgent" },
          { key: "treasury", method: "treasury" },
          { key: "communityCenter", method: "communityCenter" },
          { key: "totalPending", method: "totalPending" },
          { key: "totalReceived", method: "totalReceived" },
        ],
        "direct snapshot",
      );
      snap = {
        collectionRewards:
          directMulti?.collectionRewards ??
          (await _callOptional(
            () => directDistributor.collectionRewards?.(),
            null,
          )),
        reserve:
          directMulti?.reserve ??
          (await _callOptional(() => directDistributor.reserve?.(), null)),
        buybackAgent:
          directMulti?.buybackAgent ??
          (await _callOptional(() => directDistributor.buybackAgent?.(), null)),
        treasury:
          directMulti?.treasury ??
          (await _callOptional(() => directDistributor.treasury?.(), null)),
        communityCenter:
          directMulti?.communityCenter ??
          (await _callOptional(
            () => directDistributor.communityCenter?.(),
            null,
          )),
        totalPending:
          directMulti?.totalPending ??
          (await _callOptional(() => directDistributor.totalPending?.(), null)),
        totalReceived:
          directMulti?.totalReceived ??
          (await _callOptional(
            () => directDistributor.totalReceived?.(),
            null,
          )),
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

  if (pendingTargets.length && readerOk && typeof reader === "object") {
    const pendingValues = await _callReader(
      () => getDistributorPendingOf(reader, pendingTargets),
      [],
    );
    pendingTargets.forEach((addr, idx) => {
      pendingMap.set(addr.toLowerCase(), pendingValues?.[idx] ?? null);
    });
  } else if (pendingTargets.length && directDistributor) {
    const directPendingMulti = await _multicallOptional(
      readProvider,
      directDistributor,
      pendingTargets.map((addr, idx) => ({
        key: `pending_${idx}`,
        method: "pendingOf",
        params: [addr],
      })),
      "direct pendingOf",
    );
    const pendingValues = await Promise.all(
      pendingTargets.map(
        (addr, idx) =>
          directPendingMulti?.[`pending_${idx}`] ??
          _callOptional(() => directDistributor.pendingOf?.(addr), null),
      ),
    );
    pendingTargets.forEach((addr, idx) => {
      pendingMap.set(addr.toLowerCase(), pendingValues?.[idx] ?? null);
    });
  }

  const pendingCommunity = readerOk
    ? await _callReader(() => getDistributorPendingCommunity(reader), null)
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
  const fallbackCollection =
    normalizeAddress(addrs?.COLLECTION_REWARDS) || null;
  const fallbackCommunity = normalizeAddress(addrs?.COMMUNITY_CENTER) || null;
  const fallbackDRIP =
    normalizeAddress(addrs?.DRIPDistributor) ||
    normalizeAddress(addrs?.DRIP_DISTRIBUTOR) ||
    null;
  const resolvedCommunity =
    normalizeAddress(communityCenter) || fallbackCommunity;
  const communityView = resolvedCommunity
    ? new Contract(resolvedCommunity, COMMUNITY_VIEW_ABI, signerOrProvider)
    : null;
  let communityPoolBalance = null;
  if (resolvedCommunity) {
    communityPoolBalance = await _callOptional(
      () => communityView?.poolBalance?.(),
      null,
    );
    if (communityPoolBalance == null && readProvider?.getBalance) {
      communityPoolBalance = await _callOptional(
        () => readProvider.getBalance(resolvedCommunity),
        null,
      );
    }
  }

  const ts = Date.now();
  return {
    ts,
    tsLabel: new Date(ts).toLocaleString(),
    address: normalizeAddress(distributorAddr) || fallbackDistributor,
    reserve: normalizeAddress(reserve) || fallbackReserve,
    BUYBACKAgent: normalizeAddress(buybackAgent) || fallbackBuyback,
    treasury: normalizeAddress(treasury) || fallbackTreasury,
    COLLECTIONREWARDS:
      normalizeAddress(collectionRewards) || fallbackCollection,
    COMMUNITYCENTER: normalizeAddress(communityCenter) || fallbackCommunity,
    DRIPDistributor: fallbackDRIP,
    snapshotSource,
    readerAddress: normalizeAddress(readerAddr),
    readerOk,
    totalPending,
    totalReceived,
    pendingReserve: getPending(reserve),
    pendingBUYBACK: getPending(buybackAgent),
    pendingTreasury: getPending(treasury),
    pendingCOLLECTIONREWARDS: getPending(collectionRewards),
    pendingCOMMUNITYCENTER: getPending(communityCenter, pendingCommunity),
    pendingCommunity: getPending(communityCenter, pendingCommunity),
    communityPoolBalance,
  };
}
