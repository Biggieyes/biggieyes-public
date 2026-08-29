import { getROProvider } from "@/shared/utils/contract";
import {
  createFallbackProvider,
  createArchiveProvider,
  createJsonRpcProvider,
  getArchiveProvider,
  getRpcUrls,
  getSharedFallbackProvider,
  resetSharedFallbackProvider as resetSharedFallbackProviderCache,
} from "./rpcProviders";

let provider = null;

export function getProvider({
  preferLegacy = false,
  forceRefresh = false,
} = {}) {
  if (preferLegacy) return getROProvider();
  if (!provider || forceRefresh) {
    try {
      provider = getSharedFallbackProvider({ forceRefresh });
    } catch (err) {
      console.warn(
        "Fallback provider failed, using legacy getROProvider",
        err?.message || err,
      );
      provider = getROProvider();
    }
  }
  return provider;
}

export async function getChainId() {
  try {
    const network = await getProvider().getNetwork();
    return network.chainId;
  } catch (error) {
    console.error("Unable to resolve chainId", error);
    return null;
  }
}

export function resetSharedFallbackProvider() {
  provider = null;
  resetSharedFallbackProviderCache();
}

export {
  createArchiveProvider,
  createFallbackProvider,
  createJsonRpcProvider,
  getArchiveProvider,
  getRpcUrls,
  getSharedFallbackProvider,
};

export default getProvider();
