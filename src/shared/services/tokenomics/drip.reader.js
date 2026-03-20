import { Interface, JsonRpcProvider, isAddress } from "ethers";
import {
  ADDR,
  getDRIPDistributorRO,
  getDRIPKeeperRO,
  getDRIPLMRO,
  getROProvider,
  getTokenRO,
} from "@/shared/utils/contract";
import { getArchiveRpcUrls, getRpcUrls } from "@/shared/utils/rpcConfig";
import DRIPLM_ABI from "@/config/abi/BiggiDRIPLM.json";

const DRIP_EVENT_SCAN_CHUNK = 50_000;
const DRIP_EVENT_CACHE_PREFIX = "biggi:drip-event-totals:v1";
const DRIP_EVENT_DEPLOY_BLOCK = Number(ADDR.DEPLOY_BLOCK) || 0;
const DRIP_EVENT_PRUNED_RETRY_MS = 2 * 60 * 1000;
const dripEventIface = new Interface(DRIPLM_ABI);
const dripEventTopics = [
  dripEventIface.encodeFilterTopics("DripExecuted", [])[0],
  dripEventIface.encodeFilterTopics("DripPartial", [])[0],
];
const dripEventTotalsCache = new Map();
const dripEventTotalsInFlight = new Map();
const dripEventPrunedRetryUntil = new Map();
let dripEventPrunedWarned = false;

async function _callOptional(fn, fallback = null) {
  if (typeof fn !== "function") return fallback;
  try {
    const value = await fn();
    return value ?? fallback;
  } catch (error) {
    console.warn("DRIP snapshot call failed", fn?.name, error);
    return fallback;
  }
}

function _sameAddress(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function _dripEventCacheKey(address) {
  return `${DRIP_EVENT_CACHE_PREFIX}:${String(address || "").toLowerCase()}`;
}

function _normalizeDripEventTotals(address, value) {
  if (!address || !value) return null;
  try {
    return {
      address,
      totalNativeForwarded: BigInt(value.totalNativeForwarded ?? 0n),
      totalSoldTokens: BigInt(value.totalSoldTokens ?? 0n),
      lastScannedBlock: Number(value.lastScannedBlock) || DRIP_EVENT_DEPLOY_BLOCK,
      updatedAt: Number(value.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

function _readStoredDripEventTotals(address) {
  if (typeof window === "undefined" || !window.localStorage || !address) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(_dripEventCacheKey(address));
    if (!raw) return null;
    return _normalizeDripEventTotals(address, JSON.parse(raw));
  } catch {
    return null;
  }
}

function _getCachedDripEventTotals(address) {
  if (!address) return null;
  const key = String(address).toLowerCase();
  if (dripEventTotalsCache.has(key)) {
    return dripEventTotalsCache.get(key) || null;
  }
  const stored = _readStoredDripEventTotals(address);
  if (stored) dripEventTotalsCache.set(key, stored);
  return stored;
}

function _persistDripEventTotals(address, totals) {
  if (!address || !totals) return;
  const key = String(address).toLowerCase();
  dripEventTotalsCache.set(key, totals);
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      _dripEventCacheKey(address),
      JSON.stringify({
        totalNativeForwarded: totals.totalNativeForwarded.toString(),
        totalSoldTokens: totals.totalSoldTokens.toString(),
        lastScannedBlock: totals.lastScannedBlock,
        updatedAt: totals.updatedAt || Date.now(),
      }),
    );
  } catch {
    // ignore local cache write failures
  }
}

function _looksLikeLogProvider(provider) {
  return Boolean(
    provider &&
      typeof provider.getBlockNumber === "function" &&
      typeof provider.getLogs === "function",
  );
}

function _extractRpcErrorInfo(error) {
  const rawCodes = [
    error?.code,
    error?.error?.code,
    error?.info?.error?.code,
    error?.info?.code,
  ];
  let code = null;
  for (const raw of rawCodes) {
    const numeric = typeof raw === "string" ? Number(raw) : raw;
    if (Number.isFinite(numeric)) {
      code = Number(numeric);
      break;
    }
  }

  const message = [
    error?.shortMessage,
    error?.message,
    error?.error?.message,
    error?.info?.error?.message,
    error?.info?.message,
    error?.info?.responseBody,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return { code, message };
}

function _isPrunedHistoryError(error) {
  const { code, message } = _extractRpcErrorInfo(error);
  const isPruned = code === -32701 || /history has been pruned/i.test(message);
  const isInvalidRange =
    (code === -32000 && /invalid block range/i.test(message)) ||
    (code === 35 && /ranges over\s*10000 blocks/i.test(message));
  const isUnknownBlock = code === 26 || /unknown block/i.test(message);
  return isPruned || isInvalidRange || isUnknownBlock;
}

function _isPrunedRetryActive(address, now = Date.now()) {
  const key = String(address || "").toLowerCase();
  if (!key) return false;
  const retryUntil = Number(dripEventPrunedRetryUntil.get(key) || 0);
  if (!retryUntil) return false;
  if (retryUntil <= now) {
    dripEventPrunedRetryUntil.delete(key);
    return false;
  }
  return true;
}

function _setPrunedRetry(address, now = Date.now()) {
  const key = String(address || "").toLowerCase();
  if (!key) return;
  dripEventPrunedRetryUntil.set(key, now + DRIP_EVENT_PRUNED_RETRY_MS);
}

function _clearPrunedRetry(address) {
  const key = String(address || "").toLowerCase();
  if (!key) return;
  dripEventPrunedRetryUntil.delete(key);
}

function _buildLogProviderCandidates(baseProvider) {
  const out = [];
  if (_looksLikeLogProvider(baseProvider)) out.push(baseProvider);

  const seenUrls = new Set();
  const urls = [...getArchiveRpcUrls(), ...getRpcUrls()];
  for (const url of urls) {
    const normalized = String(url || "").trim();
    if (!normalized || seenUrls.has(normalized)) continue;
    seenUrls.add(normalized);
    try {
      out.push(new JsonRpcProvider(normalized));
    } catch {
      // ignore invalid fallback RPC
    }
  }

  return out;
}

async function _scanDripEventTotals(address, provider) {
  if (!address) return null;

  const cachedPersisted = _getCachedDripEventTotals(address);
  const cached =
    cachedPersisted || {
      address,
      totalNativeForwarded: 0n,
      totalSoldTokens: 0n,
      lastScannedBlock: DRIP_EVENT_DEPLOY_BLOCK - 1,
      updatedAt: 0,
    };

  if (_isPrunedRetryActive(address)) {
    return cachedPersisted;
  }

  let lastError = null;
  let prunedErrorDetected = false;

  for (const candidate of _buildLogProviderCandidates(provider)) {
    try {
      const latestBlock = await candidate.getBlockNumber();
      const nextFromBlock = Math.max(
        DRIP_EVENT_DEPLOY_BLOCK,
        Number(cached.lastScannedBlock || 0) + 1,
      );

      if (nextFromBlock > latestBlock) {
        const ready = {
          ...cached,
          updatedAt: Date.now(),
        };
        _clearPrunedRetry(address);
        _persistDripEventTotals(address, ready);
        return ready;
      }

      const running = {
        ...cached,
        lastScannedBlock: Number(cached.lastScannedBlock || 0),
      };

      for (
        let fromBlock = nextFromBlock;
        fromBlock <= latestBlock;
        fromBlock += DRIP_EVENT_SCAN_CHUNK
      ) {
        const toBlock = Math.min(
          fromBlock + DRIP_EVENT_SCAN_CHUNK - 1,
          latestBlock,
        );
        const logs = await candidate.getLogs({
          address,
          topics: [dripEventTopics],
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          const parsed = dripEventIface.parseLog(log);
          if (!parsed) continue;
          if (parsed.name === "DripExecuted") {
            running.totalSoldTokens += BigInt(parsed.args?.soldTokens ?? 0n);
            running.totalNativeForwarded += BigInt(
              parsed.args?.nativeForwarded ?? 0n,
            );
          } else if (parsed.name === "DripPartial") {
            running.totalSoldTokens += BigInt(parsed.args?.sold ?? 0n);
            running.totalNativeForwarded += BigInt(
              parsed.args?.nativeForwarded ?? 0n,
            );
          }
        }

        running.lastScannedBlock = toBlock;
        running.updatedAt = Date.now();
        _persistDripEventTotals(address, running);
      }

      _clearPrunedRetry(address);
      return running;
    } catch (error) {
      lastError = error;
      if (_isPrunedHistoryError(error)) {
        prunedErrorDetected = true;
      }
    }
  }

  if (prunedErrorDetected) {
    _setPrunedRetry(address);
    if (!dripEventPrunedWarned) {
      dripEventPrunedWarned = true;
      console.warn(
        "DRIP event totals need archive log history; using cached values until an archive RPC is available.",
      );
    }
  }

  if (cached?.lastScannedBlock >= DRIP_EVENT_DEPLOY_BLOCK) {
    return cached;
  }
  if (lastError && !prunedErrorDetected) {
    console.warn("DRIP event totals scan failed", lastError);
  }
  return null;
}

function _ensureDripEventTotals(address, provider) {
  if (!address) return Promise.resolve(null);
  const key = String(address).toLowerCase();
  if (dripEventTotalsInFlight.has(key)) {
    return dripEventTotalsInFlight.get(key);
  }
  const promise = _scanDripEventTotals(address, provider).finally(() => {
    dripEventTotalsInFlight.delete(key);
  });
  dripEventTotalsInFlight.set(key, promise);
  return promise;
}

async function _withTimeout(promise, timeoutMs, fallback = null) {
  const waitMs = Number(timeoutMs) || 0;
  if (waitMs <= 0) return promise;
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallback), waitMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchDRIPSnapshot({ chainId, provider } = {}) {
  void chainId;
  const signerOrProvider = provider || getROProvider();
  const DRIPDistributor = getDRIPDistributorRO(signerOrProvider);
  const DRIPLM = getDRIPLMRO(signerOrProvider);
  const DRIPKeeper = getDRIPKeeperRO(signerOrProvider);
  const token = getTokenRO(signerOrProvider);

  const distributorAddr = isAddress(DRIPDistributor?.address)
    ? DRIPDistributor.address
    : ADDR.DRIP_DISTRIBUTOR ?? null;
  const lmAddr = isAddress(DRIPLM?.address) ? DRIPLM.address : ADDR.DRIP_LM ?? null;
  const keeperAddr = isAddress(DRIPKeeper?.address)
    ? DRIPKeeper.address
    : ADDR.DRIP_KEEPER_PROXY ?? null;

  const distributorSnapshot = await _callOptional(
    () => DRIPDistributor?.snapshot?.(),
    null,
  );

  const snapshotTargetLM =
    distributorSnapshot?.dripLM ?? distributorSnapshot?.DRIPLM ?? null;
  const snapshotTreasury =
    distributorSnapshot?.treasury ?? distributorSnapshot?.TREASURY ?? null;
  const snapshotOperator =
    distributorSnapshot?.operator ?? distributorSnapshot?.OPERATOR ?? null;
  const cachedDripEventTotals = _getCachedDripEventTotals(lmAddr);
  const dripEventTotalsPromise = lmAddr
    ? _ensureDripEventTotals(lmAddr, signerOrProvider)
    : Promise.resolve(null);

  const [
    cap,
    availableTokens,
    capRemaining,
    tokensPerMint,
    getAvailable,
    totalClaimed,
    totalNotified,
    paused,
    sellPct,
    reserveShareBps,
    moderatorShareBps,
    slippageBps,
    txDeadlineSec,
    reserveAddress,
    moderatorCenterAddress,
    buybackAgentAddress,
    routerAddress,
    lmDistributor,
    biggiDistributor,
    biggiLm,
    nativeBalance,
    keeperDripLM,
    keeperPaused,
    keeperOwner,
    keeperCheck,
  ] = await Promise.all([
    Promise.resolve(distributorSnapshot?.cap ?? DRIPDistributor?.CAP?.() ?? 0n),
    Promise.resolve(
      distributorSnapshot?.available ??
        distributorSnapshot?.availableTokens ??
        DRIPDistributor?.availableTokens?.() ??
        0n,
    ),
    Promise.resolve(
      distributorSnapshot?.capRemaining ?? DRIPDistributor?.capRemaining?.() ?? 0n,
    ),
    Promise.resolve(
      distributorSnapshot?.tokensPerMint ?? DRIPDistributor?.tokensPerMint?.() ?? 0n,
    ),
    Promise.resolve(
      distributorSnapshot?.effectiveAvailable ??
        DRIPDistributor?.getAvailable?.() ??
        distributorSnapshot?.available ??
        0n,
    ),
    Promise.resolve(
      distributorSnapshot?.totalClaimed ?? DRIPDistributor?.getTotalClaimed?.() ?? 0n,
    ),
    Promise.resolve(
      distributorSnapshot?.totalNotified ??
        DRIPDistributor?.getTotalNotified?.() ??
        0n,
    ),
    Promise.resolve(distributorSnapshot?.paused ?? DRIPDistributor?.paused?.() ?? false),
    _callOptional(() => DRIPLM?.sellPct?.(), 0),
    _callOptional(() => DRIPLM.reserveShareBps?.(), 0),
    _callOptional(() => DRIPLM.moderatorShareBps?.(), 0),
    _callOptional(() => DRIPLM?.slippageBps?.(), 0n),
    _callOptional(() => DRIPLM?.txDeadlineSec?.(), 0n),
    _callOptional(() => DRIPLM?.reserve?.(), ADDR.RESERVE ?? null),
    _callOptional(
      () => DRIPLM?.moderatorCenter?.(),
      ADDR.BIGGI_MODERATOR_CENTER ?? null,
    ),
    _callOptional(() => DRIPLM?.buybackAgent?.(), ADDR.BUYBACK_AGENT ?? null),
    _callOptional(() => DRIPLM?.router?.(), ADDR.ROUTER ?? null),
    _callOptional(() => DRIPLM?.dripDistributor?.(), distributorAddr),
    _callOptional(
      () => (distributorAddr ? token.balanceOf(distributorAddr) : 0n),
      0n,
    ),
    _callOptional(() => (lmAddr ? token.balanceOf(lmAddr) : 0n), 0n),
    _callOptional(
      () => (lmAddr ? signerOrProvider.getBalance(lmAddr) : 0n),
      0n,
    ),
    _callOptional(() => DRIPKeeper?.dripLM?.(), lmAddr),
    _callOptional(() => DRIPKeeper?.paused?.(), null),
    _callOptional(() => DRIPKeeper?.owner?.(), null),
    _callOptional(() => DRIPKeeper?.checkUpkeep?.("0x"), null),
  ]);
  const dripEventTotals =
    cachedDripEventTotals ??
    (await _withTimeout(dripEventTotalsPromise, 6500, null));

  const totalReceived =
    distributorSnapshot?.totalReceived ??
    (await _callOptional(
      () => DRIPDistributor?.totalReceived?.(),
      await _callOptional(() => DRIPDistributor?.getTotalReceived?.(), null),
    ));
  const totalTopUp = totalReceived;
  const distributorBalance =
    distributorSnapshot?.balance ??
    (await _callOptional(() => DRIPDistributor?.biggiBalance?.(), biggiDistributor));

  const distributorTarget = snapshotTargetLM ?? (await _callOptional(() => DRIPDistributor?.dripLM?.(), lmAddr));
  const treasuryAddress =
    snapshotTreasury ?? (await _callOptional(() => DRIPDistributor?.treasury?.(), ADDR.TREASURY ?? null));
  const operatorAddress =
    snapshotOperator ??
    (await _callOptional(() => DRIPDistributor?.tokensPerMintOperator?.(), null));
  const keeperUpkeepNeeded = keeperCheck?.upkeepNeeded ?? keeperCheck?.[0] ?? null;
  const keeperPerformData = keeperCheck?.performData ?? keeperCheck?.[1] ?? null;
  const distributorTargetMatches =
    distributorTarget && lmAddr ? _sameAddress(distributorTarget, lmAddr) : null;
  const keeperTargetMatches =
    keeperDripLM && lmAddr ? _sameAddress(keeperDripLM, lmAddr) : null;
  const lmDistributorMatches =
    lmDistributor && distributorAddr ? _sameAddress(lmDistributor, distributorAddr) : null;

  return {
    ts: Date.now(),
    distributor: {
      address: distributorAddr,
      cap,
      availableTokens,
      capRemaining,
      tokensPerMint,
      paused,
      totalClaimed,
      totalNotified,
      totalTopUp,
      getAvailable,
      effectiveAvailable: getAvailable,
      totalReceived,
      balance: distributorBalance,
      tokenBalance: biggiDistributor,
      DRIPLM: distributorTarget,
      treasury: treasuryAddress,
      operator: operatorAddress,
      targetMatches: distributorTargetMatches,
    },
    DRIPLM: {
      address: lmAddr,
      sellPct,
      reserveShareBps,
      moderatorShareBps,
      slippageBps,
      txDeadlineSec,
      router: routerAddress,
      reserve: reserveAddress,
      moderatorCenter: moderatorCenterAddress,
      buybackAgent: buybackAgentAddress,
      biggiBalance: biggiLm,
      nativeBalance,
      totalNativeForwarded: dripEventTotals?.totalNativeForwarded ?? null,
      totalSoldTokens: dripEventTotals?.totalSoldTokens ?? null,
      lastEventScanBlock: dripEventTotals?.lastScannedBlock ?? null,
      distributor: lmDistributor,
      distributorMatches: lmDistributorMatches,
    },
    keeper: {
      address: keeperAddr,
      dripLM: keeperDripLM,
      paused: keeperPaused,
      owner: keeperOwner,
      upkeepNeeded: keeperUpkeepNeeded,
      performData: keeperPerformData,
      targetMatches: keeperTargetMatches,
    },
  };
}
