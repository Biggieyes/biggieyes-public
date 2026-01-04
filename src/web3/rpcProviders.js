import { ethers } from "ethers";
import { AMOY, getRpcUrls as getConfiguredRpcUrls } from "../utils/rpcConfig";

// Static provider avoids network autodetect calls that can fail due to CORS/rate limits.
const { StaticJsonRpcProvider, FallbackProvider } = ethers.providers;

function makeStaticProvider(url, chainId = AMOY.chainId) {
  return new StaticJsonRpcProvider({ url, chainId, name: AMOY.name }, chainId);
}

export function createJsonRpcProvider(rpcUrl, chainId = AMOY.chainId) {
  const url = rpcUrl || getConfiguredRpcUrls()[0];
  if (!url) throw new Error("No RPC URL configured (set VITE_JSON_RPC_URL or VITE_AMOY_RPC_URL)");
  return makeStaticProvider(url, chainId);
}

export function createFallbackProvider(urls, chainId = AMOY.chainId) {
  const list = Array.isArray(urls) && urls.length ? urls : getConfiguredRpcUrls();
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
  return getConfiguredRpcUrls();
}

export default getSharedFallbackProvider();
