// import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress } from "ethers";
import { FallbackProvider, JsonRpcProvider, Network } from "ethers";
import {
  ACTIVE_CHAIN,
  getRpcBatchMaxCount,
  getRpcFallbackStallTimeoutMs,
  getRpcUrls as getConfiguredRpcUrls,
  getArchiveRpcUrls,
  isEthersFallbackProviderEnabled,
} from "../shared/utils/rpcConfig.js";

function makeStaticProvider(url, chainId = ACTIVE_CHAIN.chainId) {
  const network = Network.from({ chainId, name: ACTIVE_CHAIN.name });
  // staticNetwork avoids repeated chainId detection on flaky/public RPCs
  // ethers v6 expects a Network object for staticNetwork (not boolean)
  const options = {
    staticNetwork: network,
    batchMaxCount: getRpcBatchMaxCount(url),
  };
  return new JsonRpcProvider(url, network, options);
}

// Helper to create a provider with dynamic healthy endpoint selection
export function createJsonRpcProvider(rpcUrl, chainId = ACTIVE_CHAIN.chainId) {
  // Synchronous provider creation for compatibility with FallbackProvider
  if (!rpcUrl) {
    const urls = getConfiguredRpcUrls();
    if (!urls.length)
      throw new Error(
        "No RPC URL configured (set VITE_JSON_RPC_URL or VITE_POLYGON_RPC_URL)",
      );
    rpcUrl = urls[0];
  }
  return makeStaticProvider(rpcUrl, chainId);
}

export function createFallbackProvider(urls, chainId = ACTIVE_CHAIN.chainId) {
  const list =
    Array.isArray(urls) && urls.length ? urls : getConfiguredRpcUrls();
  if (!list.length)
    throw new Error(
      "No RPC URLs configured (set VITE_JSON_RPC_URL or VITE_POLYGON_RPC_URL)",
    );
  if (list.length === 1) return createJsonRpcProvider(list[0], chainId);
  if (!isEthersFallbackProviderEnabled())
    return createJsonRpcProvider(list[0], chainId);

  const stallTimeout = getRpcFallbackStallTimeoutMs();

  const configs = list.map((url, index) => ({
    provider: makeStaticProvider(url, chainId),
    priority: index + 1,
    stallTimeout,
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

export function createArchiveProvider(urls, chainId = ACTIVE_CHAIN.chainId) {
  const list = Array.isArray(urls) && urls.length ? urls : [];
  if (!list.length) return null;
  if (list.length === 1) return createJsonRpcProvider(list[0], chainId);
  if (!isEthersFallbackProviderEnabled())
    return createJsonRpcProvider(list[0], chainId);

  const stallTimeout = getRpcFallbackStallTimeoutMs(2000);

  const configs = list.map((url, index) => ({
    provider: makeStaticProvider(url, chainId),
    priority: index + 1,
    stallTimeout,
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

function destroyProvider(provider) {
  try {
    const result = provider?.destroy?.();
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch {
    // ignore provider cleanup failures
  }
}

export function getSharedFallbackProvider({ forceRefresh = false } = {}) {
  if (!_sharedFallback || forceRefresh) {
    if (forceRefresh) destroyProvider(_sharedFallback);
    _sharedFallback = createFallbackProvider();
  }
  return _sharedFallback;
}

export function resetSharedFallbackProvider() {
  destroyProvider(_sharedFallback);
  _sharedFallback = null;
}

export function getArchiveProvider({ forceRefresh = false } = {}) {
  const urls = getArchiveRpcUrls();
  if (!urls.length) return null;
  if (!_sharedArchive || forceRefresh) {
    if (forceRefresh) destroyProvider(_sharedArchive);
    _sharedArchive = createArchiveProvider(urls);
  }
  return _sharedArchive;
}

export function getRpcUrls() {
  return getConfiguredRpcUrls();
}

export default getSharedFallbackProvider();
