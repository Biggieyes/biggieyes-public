import { explorerBaseFor as explorerBaseForFromConfig } from "../../config/chains.js";

export function explorerBaseFor(chainId) {
  return explorerBaseForFromConfig(chainId);
}
