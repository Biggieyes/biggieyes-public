const LOCAL_STORAGE_RPC_PREF_KEY = "biggi_last_amoy_rpc_v1";
const BAD_RPC_SUBSTRINGS = ["tenderly", "drpc.org"];
const BAD_CORS_RPCS = ["rpc-amoy.polygon.technology"];

function env(key) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) return import.meta.env[key];
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
  // Public endpoints that allow browser CORS; official RPC omitted because it blocks CORS.
  "https://polygon-amoy-bor.publicnode.com",
];

const AMOY_RPC_CANDIDATES = uniq([
  env("VITE_JSON_RPC_URL"),
  env("VITE_MOD_CHAIN_RPC"),
  env("VITE_AMOY_RPC_URL"),
  ...splitCsv(env("VITE_ADDITIONAL_RPC_URLS")),
  ...PUBLIC_AMOY_RPCS,
]);

export const AMOY = {
  chainId: 80002,
  hex: "0x13882",
  name: "Polygon Amoy",
  rpcUrls: AMOY_RPC_CANDIDATES,
  rpcUrl: AMOY_RPC_CANDIDATES[0] || PUBLIC_AMOY_RPCS[0],
  currency: { name: "POL", symbol: "POL", decimals: 18 },
  explorer: "https://amoy.polygonscan.com",
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
  const ignorePreferred = env("VITE_FORCE_RPC") === "1" || env("VITE_IGNORE_RPC_PREFERENCE") === "1";
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
    const lower = String(u).toLowerCase();
    const isBad = BAD_RPC_SUBSTRINGS.some((x) => lower.includes(x));
    if (isBad) {
      const isTenderly = lower.includes("tenderly");
      if (!(allowTenderly && isTenderly)) return false;
    }
    if (isBrowser && BAD_CORS_RPCS.some((x) => lower.includes(x))) return false;
    return true;
  });
}

export function getRpcUrls() {
  const primaryList = Array.isArray(AMOY.rpcUrls) && AMOY.rpcUrls.length ? AMOY.rpcUrls : [];
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
