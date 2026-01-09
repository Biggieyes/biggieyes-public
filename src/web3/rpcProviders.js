// import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { FallbackProvider, StaticJsonRpcProvider } from "@ethersproject/providers";
import { AMOY, getRpcUrls as getConfiguredRpcUrls } from "../utils/rpcConfig";

function makeStaticProvider(url, chainId = AMOY.chainId) {
  return new StaticJsonRpcProvider({ url, chainId, name: AMOY.name }, chainId);
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
    return new FallbackProvider(configs, 1);
  } catch (err) {
    console.warn(
      "FallbackProvider failed, using first RPC",
      err?.message || err,
    );
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
  return getConfiguredRpcUrls();
}

export default getSharedFallbackProvider();

