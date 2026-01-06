import { getROProvider } from "../utils/contract";
import {
  createFallbackProvider,
  createJsonRpcProvider,
  getRpcUrls,
  getSharedFallbackProvider,
  resetSharedFallbackProvider,
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

export {
  createFallbackProvider,
  createJsonRpcProvider,
  getRpcUrls,
  getSharedFallbackProvider,
  resetSharedFallbackProvider,
};

export default getProvider();
