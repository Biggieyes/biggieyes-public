import { JsonRpcProvider } from "ethers";
import { getChainInfo } from "../../config/chains.js";
/**
 * Dynamicky vybere nejzdravější RPC endpoint z dostupných.
 * @returns {Promise<string|null>} Nejzdravější RPC URL nebo null
 */
export async function getHealthyRpcUrl() {
  const urls = getRpcUrls();
  const checks = await Promise.all(
    urls.map(async (url) => ({ url, ...(await checkRpcHealth(url)) })),
  );
  const healthy = checks.filter((c) => c.ok);
  if (!healthy.length) return null;

  // Prefer fresh endpoints first (close to highest known block), then low latency.
  const maxBlock = healthy.reduce((acc, cur) => {
    const n = Number(cur?.blockNumber ?? 0);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  const maxStaleBlocks =
    Number(env("VITE_RPC_MAX_STALE_BLOCKS")) > 0
      ? Number(env("VITE_RPC_MAX_STALE_BLOCKS"))
      : 16;

  const fresh = healthy.filter((c) => {
    const n = Number(c?.blockNumber ?? 0);
    if (!Number.isFinite(n)) return false;
    return maxBlock - n <= maxStaleBlocks;
  });

  const pool = fresh.length ? fresh : healthy;
  pool.sort((a, b) => {
    const byLatency = (a.latencyMs || 99999) - (b.latencyMs || 99999);
    if (byLatency !== 0) return byLatency;
    return Number(b.blockNumber || 0) - Number(a.blockNumber || 0);
  });
  return pool[0].url;
}
/**
 * Zdravotní kontrola RPC endpointu: ověří dostupnost, block height a latenci.
 * @param {string} url - RPC endpoint
 * @returns {Promise<{ok: boolean, blockNumber?: number, latencyMs?: number, error?: string}>}
 */
export async function checkRpcHealth(url, options = {}) {
  const withTimeout = async (promise, timeoutMs, label) => {
    const ms =
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.trunc(timeoutMs) : 6000;
    let timer = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} timed out after ${ms}ms`)),
            ms,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const start = Date.now();
  try {
    const timeoutMs =
      Number(options.timeoutMs) ||
      Number(env("VITE_RPC_HEALTH_TIMEOUT_MS")) ||
      6000;
    const provider = new JsonRpcProvider(url);
    const network = await withTimeout(
      provider.getNetwork(),
      timeoutMs,
      "eth_chainId",
    );
    const expectedChainId =
      typeof options.expectedChainId === "number"
        ? options.expectedChainId
        : ACTIVE_CHAIN.chainId;
    const chainIdRaw =
      typeof network?.chainId !== "undefined" ? network.chainId : null;
    const chainId =
      typeof chainIdRaw === "bigint" ? Number(chainIdRaw) : Number(chainIdRaw);
    if (!Number.isFinite(chainId)) {
      return { ok: false, error: "chainId unavailable" };
    }
    if (expectedChainId && chainId !== expectedChainId) {
      return {
        ok: false,
        error: `chainId mismatch: ${chainId} != ${expectedChainId}`,
      };
    }
    const blockNumber = await withTimeout(
      provider.getBlockNumber(),
      timeoutMs,
      "eth_blockNumber",
    );
    const latencyMs = Date.now() - start;
    return { ok: true, blockNumber, latencyMs };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}
export async function ensurePreferredRpc() {
  if (typeof window === "undefined") return null;
  const ignorePreferred = env("VITE_IGNORE_RPC_PREFERENCE") === "1";
  if (ignorePreferred) return null;
  const healthy = await getHealthyRpcUrl();
  if (healthy) setPreferredRpc(healthy);
  else clearPreferredRpc();
  return healthy;
}
const LOCAL_STORAGE_RPC_PREF_KEY = "biggi_last_polygon_rpc_v2";
const LEGACY_RPC_PREF_KEYS = [];
const RPC_RATE_LIMIT_MEMORY_MS = 10 * 60 * 1000;
const BAD_RPC_SUBSTRINGS = ["tenderly"];
const BAD_CORS_RPCS = [];
const BAD_CHAIN_RPCS = [];
const UNSTABLE_POLYGON_RPC_HOSTS = [];
const RATE_LIMITED_POLYGON_RPC_HOSTS = [
  // This public endpoint currently returns 401 in browser workloads.
  "polygon-rpc.com",
];
const rateLimitedRpcMarks = new Map();

function env(key) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env)
      return import.meta.env[key];
  } catch {
    // ignore env lookup errors
  }
  try {
    if (typeof process !== "undefined" && process.env) return process.env[key];
  } catch {
    // ignore process env lookup errors
  }
  return undefined;
}

const ACTIVE_CHAIN_ID = 137;

function getInfuraRpcUrl() {
  const projectId = env("VITE_INFURA_PROJECT_ID");
  if (!projectId) return null;
  return `https://polygon-mainnet.infura.io/v3/${projectId}`;
}

function splitCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniq(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const v = (value || "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function cleanupRateLimitedRpcMarks(now = Date.now()) {
  for (const [url, ts] of rateLimitedRpcMarks.entries()) {
    if (now - Number(ts || 0) > RPC_RATE_LIMIT_MEMORY_MS) {
      rateLimitedRpcMarks.delete(url);
    }
  }
}

function isRecentlyRateLimited(url, now = Date.now()) {
  if (!url) return false;
  cleanupRateLimitedRpcMarks(now);
  const ts = rateLimitedRpcMarks.get(String(url));
  if (!ts) return false;
  return now - Number(ts) <= RPC_RATE_LIMIT_MEMORY_MS;
}

function prioritizeHealthyRpcs(urls) {
  const now = Date.now();
  const healthy = [];
  const degraded = [];
  for (const url of Array.isArray(urls) ? urls : []) {
    if (isRecentlyRateLimited(url, now)) degraded.push(url);
    else healthy.push(url);
  }
  return [...healthy, ...degraded];
}

export const POLYGON_RPC = [
  "https://polygon.drpc.org",
  "https://polygon-bor-rpc.publicnode.com",
];

export const PUBLIC_POLYGON_RPCS = [...POLYGON_RPC];

const INFURA_RPC_URL = getInfuraRpcUrl();
const INFURA_RPC_CANDIDATES = uniq([INFURA_RPC_URL]);

const EXPLICIT_POLYGON_RPCS = uniq([
  env("VITE_JSON_RPC_URL"),
  env("VITE_MOD_CHAIN_RPC"),
  env("VITE_POLYGON_RPC_URL"),
  env("VITE_RPC_URL_POLYGON"),
  env("VITE_RPC_URL_ACTIVE_CHAIN"),
  env("VITE_MAINNET_RPC_URL"),
  ...splitCsv(env("VITE_ADDITIONAL_RPC_URLS")),
]);

const POLYGON_RPC_CANDIDATES = uniq([
  ...EXPLICIT_POLYGON_RPCS,
  ...PUBLIC_POLYGON_RPCS,
  ...INFURA_RPC_CANDIDATES,
]);

const ARCHIVE_RPC_CANDIDATES = uniq([
  env("VITE_ARCHIVE_RPC_URL"),
  ...splitCsv(env("VITE_ARCHIVE_RPC_URLS")),
]);

const ACTIVE_CHAIN_INFO = getChainInfo(ACTIVE_CHAIN_ID) || {
  chainId: ACTIVE_CHAIN_ID,
  hex: "0x89",
  name: "Polygon mainnet",
  explorer: "https://polygonscan.com",
  currency: { name: "POL", symbol: "POL", decimals: 18 },
};

export const ACTIVE_CHAIN = {
  ...ACTIVE_CHAIN_INFO,
  rpcUrls: POLYGON_RPC_CANDIDATES,
  rpcUrl: POLYGON_RPC_CANDIDATES[0] || PUBLIC_POLYGON_RPCS[0],
  currency: ACTIVE_CHAIN_INFO.currency || { name: "POL", symbol: "POL", decimals: 18 },
};

export function getPreferredRpc() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      for (const legacyKey of LEGACY_RPC_PREF_KEYS) {
        try {
          window.localStorage.removeItem(legacyKey);
        } catch {
          // ignore legacy key cleanup errors
        }
      }
      return window.localStorage.getItem(LOCAL_STORAGE_RPC_PREF_KEY) || null;
    }
  } catch {
    // ignore localStorage issues
  }
  return null;
}

export function setPreferredRpc(url) {
  if (!url) return;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_RPC_PREF_KEY, url);
    }
  } catch {
    // ignore store failures
  }
}

export function clearPreferredRpc() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(LOCAL_STORAGE_RPC_PREF_KEY);
    }
  } catch {
    // ignore clear failures
  }
}

export function markRpcRateLimited(url) {
  const normalized = String(url || "").trim();
  if (!normalized) return;
  rateLimitedRpcMarks.set(normalized, Date.now());
}

function rankRpcUrls(urls) {
  const deduped = uniq((urls || []).filter(Boolean));
  if (!deduped.length) return deduped;
  const ignorePreferred = env("VITE_IGNORE_RPC_PREFERENCE") === "1";
  const preferred = ignorePreferred ? null : getPreferredRpc();
  if (ignorePreferred) clearPreferredRpc();
  if (preferred && deduped.includes(preferred)) {
    return [preferred, ...deduped.filter((u) => u !== preferred)];
  }
  // Preserve declared order to avoid bouncing into rate-limited endpoints unexpectedly.
  return deduped;
}

function filterOutBadRpcs(urls) {
  const allowTenderly = env("VITE_ALLOW_TENDERLY_RPC") === "1";
  const allowUnstablePublicRpcs =
    env("VITE_ALLOW_UNSTABLE_PUBLIC_RPCS") !== "0";
  const allowRateLimitedPublicRpcs =
    env("VITE_ALLOW_RATE_LIMITED_PUBLIC_RPCS") === "1";
  const isBrowser = typeof window !== "undefined";
  return (urls || []).filter((u) => {
    if (!u) return false;
    const raw = String(u).trim();
    // A surprising number of "Failed to fetch" reports are caused by copied URLs
    // that include whitespace inside the string (e.g. ".../v2/<key> extra").
    if (/\s/.test(raw)) return false;
    if (!/^https?:\/\//i.test(raw)) return false;
    let parsed = null;
    try {
      parsed = new URL(raw);
    } catch {
      return false;
    }
    const host = String(parsed.hostname || "").toLowerCase();
    const path = String(parsed.pathname || "").toLowerCase();
    const lower = raw.toLowerCase();
    const isBad = BAD_RPC_SUBSTRINGS.some((x) => lower.includes(x));
    if (isBad) {
      const isTenderly = lower.includes("tenderly");
      if (!(allowTenderly && isTenderly)) return false;
    }
    if (
      !allowUnstablePublicRpcs &&
      UNSTABLE_POLYGON_RPC_HOSTS.some((x) => host === x)
    ) {
      return false;
    }
    if (
      !allowRateLimitedPublicRpcs &&
      RATE_LIMITED_POLYGON_RPC_HOSTS.some((x) => host === x)
    ) {
      return false;
    }
    if (BAD_CHAIN_RPCS.some((x) => host === x)) return false;
    // Ankr requires an API key for stable access; plain /polygon endpoint
    // returns Unauthorized and causes noisy fallback churn.
    if (host === "rpc.ankr.com" && path === "/polygon") return false;
    if (isBrowser && BAD_CORS_RPCS.some((x) => lower.includes(x))) return false;
    return true;
  });
}

export function getArchiveRpcUrls() {
  if (!ARCHIVE_RPC_CANDIDATES.length) return [];
  return rankRpcUrls(filterOutBadRpcs(ARCHIVE_RPC_CANDIDATES));
}

export function getRpcUrls() {
  const explicit = filterOutBadRpcs(EXPLICIT_POLYGON_RPCS);
  const infura = filterOutBadRpcs(INFURA_RPC_CANDIDATES);
  const preferInfura = env("VITE_PREFER_INFURA_RPC") === "1";
  const allowPublic = env("VITE_ALLOW_PUBLIC_RPCS") !== "0";
  const preferPublicFirst = env("VITE_PREFER_PUBLIC_RPC_FIRST") !== "0";
  const primaryList = preferInfura
    ? allowPublic
      ? uniq([...infura, ...explicit, ...PUBLIC_POLYGON_RPCS])
      : uniq([...infura, ...explicit])
    : allowPublic
      ? preferPublicFirst
        ? uniq([...PUBLIC_POLYGON_RPCS, ...explicit, ...infura])
        : uniq([...explicit, ...PUBLIC_POLYGON_RPCS, ...infura])
      : uniq([...explicit, ...infura]);
  const filtered = filterOutBadRpcs(primaryList);
  if (!filtered.length && primaryList.length) {
    // preferred RPC was filtered out; clear stored preference to avoid stale picks
    clearPreferredRpc();
  }

  const rankedFiltered = rankRpcUrls(filtered);
  const prioritized = prioritizeHealthyRpcs(rankedFiltered);
  if (prioritized.length) return prioritized;

  const fallback = [];
  if (ACTIVE_CHAIN.rpcUrl) fallback.push(ACTIVE_CHAIN.rpcUrl);
  if (allowPublic) fallback.push(...PUBLIC_POLYGON_RPCS);
  fallback.push(...infura);
  return prioritizeHealthyRpcs(rankRpcUrls(filterOutBadRpcs(fallback)));
}

export function getWalletRpcUrls({ preferPublicFirst = null } = {}) {
  const explicit = filterOutBadRpcs(EXPLICIT_POLYGON_RPCS);
  const infura = filterOutBadRpcs(INFURA_RPC_CANDIDATES);
  const allowPublicFallback = env("VITE_WALLET_PUBLIC_RPC_FALLBACK") !== "0";
  const preferPublicByDefault =
    env("VITE_WALLET_PREFER_PUBLIC_RPC_FIRST") !== "0";
  const usePublicFirst =
    typeof preferPublicFirst === "boolean"
      ? preferPublicFirst
      : preferPublicByDefault;

  const ordered = usePublicFirst
    ? allowPublicFallback
      ? uniq([...PUBLIC_POLYGON_RPCS, ...explicit, ...infura])
      : uniq([...explicit, ...infura])
    : allowPublicFallback
      ? uniq([...explicit, ...PUBLIC_POLYGON_RPCS, ...infura])
      : uniq([...explicit, ...infura]);

  const filtered = filterOutBadRpcs(ordered);
  const ranked = rankRpcUrls(filtered);
  const prioritized = prioritizeHealthyRpcs(ranked);
  if (prioritized.length) return prioritized;

  const fallback = [];
  if (ACTIVE_CHAIN.rpcUrl) fallback.push(ACTIVE_CHAIN.rpcUrl);
  if (allowPublicFallback) fallback.push(...PUBLIC_POLYGON_RPCS);
  fallback.push(...infura);
  return prioritizeHealthyRpcs(rankRpcUrls(filterOutBadRpcs(fallback)));
}
