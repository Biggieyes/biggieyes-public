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
        : AMOY.chainId;
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
  const ignorePreferred =
    env("VITE_FORCE_RPC") === "1" || env("VITE_IGNORE_RPC_PREFERENCE") === "1";
  if (ignorePreferred) return null;
  const healthy = await getHealthyRpcUrl();
  if (healthy) setPreferredRpc(healthy);
  else clearPreferredRpc();
  return healthy;
}
const LOCAL_STORAGE_RPC_PREF_KEY = "biggi_last_amoy_rpc_v1";
const BAD_RPC_SUBSTRINGS = ["tenderly"];
const BAD_CORS_RPCS = ["rpc-amoy.polygon.technology"];

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

function normalizeInfuraNetwork(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "polygon-amoy";
  if (raw.includes("amoy")) return "polygon-amoy";
  if (raw.includes("polygon")) return "polygon-mainnet";
  return raw.replace(/\s+/g, "-");
}

function getInfuraRpcUrl() {
  const projectId = env("VITE_INFURA_PROJECT_ID");
  if (!projectId) return null;
  const network = normalizeInfuraNetwork(env("VITE_INFURA_NETWORK"));
  return `https://${network}.infura.io/v3/${projectId}`;
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

export const PUBLIC_AMOY_RPCS = [
  // Public endpoints that are generally browser-CORS friendly.
  "https://polygon-amoy.api.onfinality.io/public",
  "https://polygon-amoy.drpc.org",
  "https://polygon-amoy-bor.publicnode.com",
  "https://polygon-amoy.publicnode.com",
];

const INFURA_RPC_URL = getInfuraRpcUrl();

const AMOY_RPC_CANDIDATES = uniq([
  env("VITE_JSON_RPC_URL"),
  env("VITE_MOD_CHAIN_RPC"),
  env("VITE_AMOY_RPC_URL"),
  env("VITE_RPC_URL_AMOY"),
  ...splitCsv(env("VITE_ADDITIONAL_RPC_URLS")),
  ...PUBLIC_AMOY_RPCS,
  INFURA_RPC_URL,
]);

const ARCHIVE_RPC_CANDIDATES = uniq([
  env("VITE_ARCHIVE_RPC_URL"),
  env("VITE_AMOY_ARCHIVE_RPC_URL"),
  ...splitCsv(env("VITE_ARCHIVE_RPC_URLS")),
]);

const AMOY_INFO = getChainInfo(80002) || {
  chainId: 80002,
  hex: "0x13882",
  name: "Polygon Amoy",
  explorer: "https://amoy.polygonscan.com",
  currency: { name: "POL", symbol: "POL", decimals: 18 },
};

export const AMOY = {
  ...AMOY_INFO,
  rpcUrls: AMOY_RPC_CANDIDATES,
  rpcUrl: AMOY_RPC_CANDIDATES[0] || PUBLIC_AMOY_RPCS[0],
  currency: AMOY_INFO.currency || { name: "POL", symbol: "POL", decimals: 18 },
};

export function getPreferredRpc() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
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

function rankRpcUrls(urls) {
  const deduped = uniq((urls || []).filter(Boolean));
  if (!deduped.length) return deduped;
  const ignorePreferred =
    env("VITE_FORCE_RPC") === "1" || env("VITE_IGNORE_RPC_PREFERENCE") === "1";
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
  const isBrowser = typeof window !== "undefined";
  return (urls || []).filter((u) => {
    if (!u) return false;
    const raw = String(u).trim();
    // A surprising number of "Failed to fetch" reports are caused by copied URLs
    // that include whitespace inside the string (e.g. ".../v2/<key> extra").
    if (/\s/.test(raw)) return false;
    if (!/^https?:\/\//i.test(raw)) return false;
    const lower = raw.toLowerCase();
    const isBad = BAD_RPC_SUBSTRINGS.some((x) => lower.includes(x));
    if (isBad) {
      const isTenderly = lower.includes("tenderly");
      if (!(allowTenderly && isTenderly)) return false;
    }
    if (isBrowser && BAD_CORS_RPCS.some((x) => lower.includes(x))) return false;
    return true;
  });
}

export function getArchiveRpcUrls() {
  if (!ARCHIVE_RPC_CANDIDATES.length) return [];
  return rankRpcUrls(filterOutBadRpcs(ARCHIVE_RPC_CANDIDATES));
}

export function getRpcUrls() {
  const primaryList =
    Array.isArray(AMOY.rpcUrls) && AMOY.rpcUrls.length ? AMOY.rpcUrls : [];
  const filtered = filterOutBadRpcs(primaryList);
  if (!filtered.length && primaryList.length) {
    // preferred RPC was filtered out; clear stored preference to avoid stale picks
    clearPreferredRpc();
  }

  const rankedFiltered = rankRpcUrls(filtered);
  if (rankedFiltered.length) return rankedFiltered;

  const fallback = [];
  if (AMOY.rpcUrl) fallback.push(AMOY.rpcUrl);
  fallback.push(...PUBLIC_AMOY_RPCS);
  return rankRpcUrls(filterOutBadRpcs(fallback));
}

