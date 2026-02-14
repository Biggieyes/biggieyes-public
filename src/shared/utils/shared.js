import { ADDR } from "./addresses";
import { getProviderForContract } from "./contract.js";
import { getArchiveProvider, getProvider } from "../../web3/provider";

export const BACKGROUND_NAMES = [
  "ORANGE",
  "BLACK",
  "WHITE",
  "BROWN",
  "BLUE",
  "GREEN",
  "VIOLET",
  "RED",
  "PINK",
  "RAINBOW",
];
export const BACKGROUND_CODES = [
  "O",
  "B",
  "W",
  "BR",
  "BL",
  "G",
  "V",
  "R",
  "P",
  "RB",
];
export const BACKGROUND_BONUSES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

// Smaller batches reduce RPC 400/429s on public endpoints
const LOGS_BATCH = 300;
const ARCHIVE_THROTTLE_MS = 180;
const MAX_RATE_LIMIT_RETRIES = 5;

function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((res) => setTimeout(res, ms));
}
const PRUNED_LOOKBACK_DEFAULT = 10_000;
const HAS_ARCHIVE_ENV = (() => {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const env = import.meta.env;
      return Boolean(
        env.VITE_ARCHIVE_RPC_URL ||
          env.VITE_AMOY_ARCHIVE_RPC_URL ||
          env.VITE_ARCHIVE_RPC_URLS,
      );
    }
  } catch {
    // ignore env lookup errors
  }
  return false;
})();

let forceRecentOnly = false;
const FULL_HISTORY = (() => {
  let requested = false;
  try {
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_LOG_FULL_HISTORY != null
    ) {
      const raw = String(import.meta.env.VITE_LOG_FULL_HISTORY).toLowerCase();
      if (raw === "true" || raw === "1") requested = true;
    }
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_LOG_LOOKBACK != null
    ) {
      const raw = String(import.meta.env.VITE_LOG_LOOKBACK).trim().toLowerCase();
      if (raw === "full") requested = true;
      const v = Number(raw);
      if (Number.isFinite(v) && v === 0) requested = true;
    }
  } catch {
    // ignore env lookup errors
  }
  if (!requested) return false;
  // Disable full-history if no archive RPC is configured.
  if (!HAS_ARCHIVE_ENV) return false;
  return true;
})();
export const isFullHistoryEnabled = () => FULL_HISTORY && !forceRecentOnly;
const PRUNED_LOOKBACK = (() => {
  try {
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_LOG_LOOKBACK
    ) {
      const v = Number(import.meta.env.VITE_LOG_LOOKBACK);
      if (Number.isFinite(v) && v > 0) return v;
    }
  } catch {
    // ignore env lookup errors
  }
  return PRUNED_LOOKBACK_DEFAULT;
})();
let prunedWarned = false;
const WALLET_CACHE_VERSION = "v2";
export const WALLET_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export function walletCacheKey(addr, contractAddr) {
  const wallet = String(addr || "").toLowerCase();
  const contract = String(contractAddr || "").toLowerCase();
  const suffix = contract ? `_c_${contract}` : "";
  return `biggi_wallet_${WALLET_CACHE_VERSION}_${wallet}${suffix}`;
}

export function loadWalletCache(addr, options = {}, contractAddr) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(walletCacheKey(addr, contractAddr));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const isExpired =
      parsed.ts && Date.now() - Number(parsed.ts) > WALLET_CACHE_TTL;
    if (isExpired && !options.allowExpired) return null;
    return Array.isArray(parsed.items) ? parsed.items : null;
  } catch {
    return null;
  }
}

export function saveWalletCache(addr, items, contractAddr) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const payload = JSON.stringify({ ts: Date.now(), items });
    window.localStorage.setItem(walletCacheKey(addr, contractAddr), payload);
  } catch {
    // ignore
  }
}

export async function getSafeDeployBlock(provider) {
  const raw = ADDR?.DEPLOY_BLOCK ?? null;
  const deployBlock = Number(raw);
  const latest = await provider.getBlockNumber();

  // If DEPLOY_BLOCK is set but higher than the current tip, treat it as invalid.
  // This avoids scanning from `latest - 1` (which makes wallets appear empty).
  if (Number.isFinite(deployBlock) && deployBlock > 0) {
    if (deployBlock <= latest) return deployBlock;
  }

  if (FULL_HISTORY) return 0;
  return Math.max(0, latest - 49_999);
}

export async function queryLogsBatched(
  contract,
  filter,
  fromBlock,
  toBlock,
  step = LOGS_BATCH,
  options = {},
) {
  const out = [];
  let start = fromBlock;
  let batch = step;
  let rateLimitStreak = 0;
  let provider = getProviderForContract(contract);
  const preferArchive = options.preferArchive !== false;
  const requestFullHistory = Boolean(options.fullHistory);
  const archiveProvider = preferArchive ? getArchiveProvider() : null;
  const hasArchive = Boolean(archiveProvider);
  const fullHistoryActive =
    (FULL_HISTORY && !forceRecentOnly) ||
    (requestFullHistory && hasArchive);
  const useArchiveProvider = fullHistoryActive && hasArchive;
  let downgradedFromArchive = false;
  // Force RPC provider for log queries to avoid MetaMask -32603 errors.
  const isInjectedProvider = Boolean(
    provider &&
      provider.provider &&
      typeof provider.provider.request === "function",
  );
  if (useArchiveProvider) {
    provider = archiveProvider;
  } else if (!provider || isInjectedProvider) {
    provider = getProvider();
  }
  const baseFilter = {
    address: filter?.address || contract?.target || contract?.address,
    topics: filter?.topics,
  };
  const iface = contract?.interface;
  const decodeIfNeeded = (logs) => {
    if (!Array.isArray(logs) || !logs.length) return logs || [];
    if (!iface || typeof iface.parseLog !== "function") return logs;
    return logs.map((l) => {
      if (l?.args) return l;
      try {
        const parsed = iface.parseLog(l);
        return {
          ...l,
          args: parsed?.args,
          eventName: parsed?.name,
          fragment: parsed?.fragment,
        };
      } catch {
        return l;
      }
    });
  };

  // Pre-clamp to recent history to avoid pruned RPC errors on public endpoints
  // unless full-history mode is explicitly enabled.
  if (!fullHistoryActive) {
    const lookback =
      Number.isFinite(PRUNED_LOOKBACK) && PRUNED_LOOKBACK > 0
        ? PRUNED_LOOKBACK
        : PRUNED_LOOKBACK_DEFAULT;
    if (Number.isFinite(lookback) && lookback > 0) {
      try {
        const latest = await provider.getBlockNumber();
        const latestNum = Number(latest || 0);
        const minFrom = Math.max(0, latestNum - lookback);
        if (Number.isFinite(minFrom) && start < minFrom) {
          start = minFrom;
        }
      } catch {
        // ignore block number lookup failures
      }
    }
  }

  if (Number.isFinite(toBlock) && Number.isFinite(start) && start > toBlock) {
    return out;
  }
  while (start <= toBlock) {
    const end = Math.min(start + batch - 1, toBlock);
    try {
      let part = [];
      if (provider && typeof provider.getLogs === "function") {
        part = await provider.getLogs({
          ...baseFilter,
          fromBlock: start,
          toBlock: end,
        });
        part = decodeIfNeeded(part);
        if (archiveProvider && ARCHIVE_THROTTLE_MS > 0) {
          await sleep(ARCHIVE_THROTTLE_MS);
        }
      } else if (typeof contract?.queryFilter === "function") {
        part = await contract.queryFilter(filter, start, end);
      } else {
        throw new Error("Provider not available for log query");
      }
      if (part?.length) out.push(...part);
      start = end + 1;
      batch = step;
      // reset rate-limit backoff on success
      rateLimitStreak = 0;
    } catch (err) {
      const msg = String(err?.message || "");
      const code = err?.code ?? err?.error?.code ?? null;
      const isPruned = code === -32701 || /history has been pruned/i.test(msg);
      const isInvalidRange =
        code === -32000 && /invalid block range/i.test(msg);
      const isRateLimit =
        code === -32005 || /too many requests/i.test(msg);
      if (isPruned || isInvalidRange) {
        // If even archive hits pruning, disable full-history for this session.
        if (archiveProvider) forceRecentOnly = true;
        if (!prunedWarned) {
          prunedWarned = true;
          console.warn(
            isInvalidRange
              ? "RPC rejected log range: falling back to recent blocks. Use an archive RPC for full history."
              : "RPC history pruned: falling back to recent blocks. Use an archive RPC for full history.",
          );
          if (FULL_HISTORY && !archiveProvider) {
            console.warn(
              "Full-history mode is enabled but no archive RPC is configured (set VITE_ARCHIVE_RPC_URL).",
            );
          }
        }
        let latest = null;
        try {
          latest = await provider.getBlockNumber();
        } catch {
          latest = typeof toBlock === "number" ? toBlock : null;
        }
        const lookback =
          Number.isFinite(PRUNED_LOOKBACK) && PRUNED_LOOKBACK > 0
            ? PRUNED_LOOKBACK
            : PRUNED_LOOKBACK_DEFAULT;
        const latestNum = Number(latest || 0);
        const newFrom = Math.max(0, latestNum - lookback);
        if (Number.isFinite(newFrom) && newFrom > start) {
          out.length = 0;
          start = newFrom;
          batch = step;
          continue;
        }
        return out;
      }
      if (isRateLimit) {
        rateLimitStreak += 1;
        if (rateLimitStreak >= MAX_RATE_LIMIT_RETRIES) {
          if (archiveProvider) forceRecentOnly = true;
          console.warn(
            "RPC rate limit hit repeatedly; returning partial logs to avoid blocking UI.",
          );
          return out;
        }
        if (archiveProvider && !downgradedFromArchive) {
          downgradedFromArchive = true;
          forceRecentOnly = true;
          provider = getProvider();
          try {
            const latest = await provider.getBlockNumber();
            const lookback =
              Number.isFinite(PRUNED_LOOKBACK) && PRUNED_LOOKBACK > 0
                ? PRUNED_LOOKBACK
                : PRUNED_LOOKBACK_DEFAULT;
            const latestNum = Number(latest || 0);
            const newFrom = Math.max(0, latestNum - lookback);
            if (Number.isFinite(newFrom)) {
              out.length = 0;
              start = newFrom;
            }
          } catch {
            // ignore fallback failures
          }
        } else {
          await sleep(800 + rateLimitStreak * 400);
        }
        batch = Math.max(1, Math.floor(batch / 2));
        continue;
      }
      if (batch <= 1) throw err;
      batch = Math.max(1, Math.floor(batch / 2));
      continue;
    }
  }
  return out;
}

export const ERC20_MINI = [
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
];

export async function mapLimit(items, limit, mapper) {
  const ret = [];
  let i = 0;
  const workers = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (i < items.length) {
        const cur = i++;
        ret[cur] = await mapper(items[cur], cur);
      }
    });
  await Promise.all(workers);
  return ret;
}

