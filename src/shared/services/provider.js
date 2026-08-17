import { explorerBaseFor } from "../../config/chains.js";
import { getROProvider as getROProviderImpl } from "../utils/contract.js";

// Lightweight compatibility layer for legacy imports.
export function getROProvider() {
  return getROProviderImpl();
}

export function explorerBaseForChain(chainId = 137) {
  const base = explorerBaseFor(chainId) || explorerBaseFor(137);
  return `${base}/address/`;
}

// Default export for legacy compatibility
export default {
  getROProvider,
  explorerBaseForChain,
};
