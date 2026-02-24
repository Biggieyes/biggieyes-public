// import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress } from "ethers";
import { FallbackProvider, JsonRpcProvider, Network } from "ethers";
import {
  AMOY,
  getRpcUrls as getConfiguredRpcUrls,
  getArchiveRpcUrls,
} from "../shared/utils/rpcConfig.js";

const BATCH_LIMITED_HOSTS = new Set([
  "polygon-amoy.drpc.org",
]);

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

function resolveBatchMaxCount(url) {
  const raw = env("VITE_RPC_BATCH_MAX_COUNT");
  const fromEnv = Number(raw);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.trunc(fromEnv);
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (BATCH_LIMITED_HOSTS.has(host)) return 3;
  } catch {
    // ignore URL parsing failures
  }
  return undefined;
}

function makeStaticProvider(url, chainId = AMOY.chainId) {
  const network = Network.from({ chainId, name: AMOY.name });
  // staticNetwork avoids repeated chainId detection on flaky/public RPCs
  // ethers v6 expects a Network object for staticNetwork (not boolean)
  const batchMaxCount = resolveBatchMaxCount(url);
  const options = { staticNetwork: network };
  if (batchMaxCount) options.batchMaxCount = batchMaxCount;
  return new JsonRpcProvider(url, network, options);
}

// Helper to create a provider with dynamic healthy endpoint selection
export function createJsonRpcProvider(rpcUrl, chainId = AMOY.chainId) {
  // Synchronous provider creation for compatibility with FallbackProvider
  if (!rpcUrl) {
    const urls = getConfiguredRpcUrls();
    if (!urls.length)
      throw new Error(
        "No RPC URL configured (set VITE_JSON_RPC_URL or VITE_AMOY_RPC_URL)",
      );
    rpcUrl = urls[0];
  }
  return makeStaticProvider(rpcUrl, chainId);
}

export function createFallbackProvider(urls, chainId = AMOY.chainId) {
  const list =
    Array.isArray(urls) && urls.length ? urls : getConfiguredRpcUrls();
  if (!list.length)
    throw new Error(
      "No RPC URLs configured (set VITE_JSON_RPC_URL or VITE_AMOY_RPC_URL)",
    );
  if (list.length === 1) return createJsonRpcProvider(list[0], chainId);

  const configs = list.map((url, index) => ({
    provider: makeStaticProvider(url, chainId),
    priority: index + 1,
    stallTimeout: 1500,
    weight: 1,
  }));

  try {
    return new FallbackProvider(configs, chainId, { quorum: 1 });
  } catch (err) {
    console.warn(
      "FallbackProvider failed, using first RPC",
      err?.message || err,
    );
    return createJsonRpcProvider(list[0], chainId);
  }
}

export function createArchiveProvider(urls, chainId = AMOY.chainId) {
  const list = Array.isArray(urls) && urls.length ? urls : [];
  if (!list.length) return null;
  if (list.length === 1) return createJsonRpcProvider(list[0], chainId);

  const configs = list.map((url, index) => ({
    provider: makeStaticProvider(url, chainId),
    priority: index + 1,
    stallTimeout: 2500,
    weight: 1,
  }));

  try {
    return new FallbackProvider(configs, chainId, { quorum: 1 });
  } catch (err) {
    console.warn(
      "Archive FallbackProvider failed, using first archive RPC",
      err?.message || err,
    );
    return createJsonRpcProvider(list[0], chainId);
  }
}

let _sharedFallback = null;
let _sharedArchive = null;

export function getSharedFallbackProvider({ forceRefresh = false } = {}) {
  if (!_sharedFallback || forceRefresh) {
    _sharedFallback = createFallbackProvider();
  }
  return _sharedFallback;
}

export function resetSharedFallbackProvider() {
  _sharedFallback = null;
}

export function getArchiveProvider({ forceRefresh = false } = {}) {
  const urls = getArchiveRpcUrls();
  if (!urls.length) return null;
  if (!_sharedArchive || forceRefresh) {
    _sharedArchive = createArchiveProvider(urls);
  }
  return _sharedArchive;
}

export function getRpcUrls() {
  return getConfiguredRpcUrls();
}

export default getSharedFallbackProvider();

