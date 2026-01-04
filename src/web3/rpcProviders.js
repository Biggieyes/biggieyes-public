import { ethers } from "ethers";
import { AMOY, PUBLIC_AMOY_RPCS } from "../utils/contract";

// Static provider avoids network autodetect calls that can fail due to CORS/rate limits.
const { StaticJsonRpcProvider, FallbackProvider } = ethers.providers;

function makeStaticProvider(url, chainId) {
  return new StaticJsonRpcProvider({ url, chainId, name: "polygon-amoy" }, chainId);
}
const BAD_RPC_SUBSTRINGS = ["tenderly", "drpc.org"]; // noisy / rate-limited endpoints
const BAD_CORS_RPCS = ["rpc-amoy.polygon.technology"]; // official Amoy RPC blocks browser CORS

function env(key) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) return import.meta.env[key];
  } catch {
    // ignore
  }
  try {
    if (typeof process !== "undefined" && process.env) return process.env[key];
  } catch {
    // ignore
  }
  return undefined;
}

function parseChainId() {
  const raw = env("VITE_DEFAULT_CHAIN_ID") ?? env("VITE_CHAIN_ID") ?? AMOY?.chainId ?? 80002;
  const num = typeof raw === "string" ? Number(raw) : raw;
  return Number.isFinite(num) ? num : 80002;
}

function parseRpcUrls() {
  const urls = [];
  const primary = env("VITE_JSON_RPC_URL") || env("VITE_MOD_CHAIN_RPC") || env("VITE_AMOY_RPC_URL");
  const extra = env("VITE_ADDITIONAL_RPC_URLS");
  if (primary && String(primary).trim()) urls.push(String(primary).trim());
  if (extra && String(extra).trim()) {
    String(extra)
      .split(",")
      .map((v) => (v || "").trim())
      .filter(Boolean)
      .forEach((v) => urls.push(v));
  }
  urls.push(...(Array.isArray(PUBLIC_AMOY_RPCS) ? PUBLIC_AMOY_RPCS : []));

  const seen = new Set();
  const isBrowser = typeof window !== "undefined";
  return urls.filter((u) => {
    const key = (u || "").trim();
    if (!key || seen.has(key)) return false;
    const lower = key.toLowerCase();
    if (BAD_RPC_SUBSTRINGS.some((x) => lower.includes(x))) return false;
    if (isBrowser && BAD_CORS_RPCS.some((x) => lower.includes(x))) return false;
    seen.add(key);
    return true;
  });
}

export function createJsonRpcProvider(rpcUrl, chainId = parseChainId()) {
  const url = rpcUrl || parseRpcUrls()[0];
  if (!url) throw new Error("No RPC URL configured (set VITE_JSON_RPC_URL or VITE_AMOY_RPC_URL)");
  return makeStaticProvider(url, chainId);
}

export function createFallbackProvider(urls, chainId = parseChainId()) {
  const list = Array.isArray(urls) && urls.length ? urls : parseRpcUrls();
  if (!list.length) throw new Error("No RPC URLs configured (set VITE_JSON_RPC_URL or VITE_AMOY_RPC_URL)");
  if (list.length === 1) return createJsonRpcProvider(list[0], chainId);

  const configs = list.map((url, index) => ({
    provider: makeStaticProvider(url, chainId),
    priority: index + 1,
    stallTimeout: 1500,
    weight: 1,
  }));

  try {
    return new FallbackProvider(configs, 1);
  } catch (err) {
    console.warn("FallbackProvider failed, using first RPC", err?.message || err);
    return createJsonRpcProvider(list[0], chainId);
  }
}

let _sharedFallback = null;

export function getSharedFallbackProvider({ forceRefresh = false } = {}) {
  if (!_sharedFallback || forceRefresh) {
    _sharedFallback = createFallbackProvider();
  }
  return _sharedFallback;
}

export function resetSharedFallbackProvider() {
  _sharedFallback = null;
}

export function getRpcUrls() {
  return parseRpcUrls();
}

export default getSharedFallbackProvider();
