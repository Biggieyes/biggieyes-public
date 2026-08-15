// Canonical address exports for all networks
import MAINNET from "./mainnet.js";
import LOCAL from "./local.js";

export { MAINNET, LOCAL };

export const ADDRESSES = {
  mainnet: MAINNET,
  local: LOCAL,
};

export const CHAIN_KEYS_BY_ID = {
  137: "mainnet",
  31337: "local",
};

export function resolveChainKey(chainKeyOrId = "mainnet") {
  if (typeof chainKeyOrId === "number") return CHAIN_KEYS_BY_ID[chainKeyOrId] || "mainnet";
  const asNum = Number(chainKeyOrId);
  if (!Number.isNaN(asNum)) return CHAIN_KEYS_BY_ID[asNum] || "mainnet";
  return String(chainKeyOrId || "mainnet").toLowerCase();
}

export function getAddresses(chainKeyOrId = "mainnet") {
  const key = resolveChainKey(chainKeyOrId);
  return ADDRESSES[key] || ADDRESSES.mainnet;
}

// Legacy / compatibility exports (tokenomics readers still import these)
export * from "../addresses.js";
