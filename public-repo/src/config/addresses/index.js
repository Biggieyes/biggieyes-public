// Canonical address exports for the only supported production network.
import MAINNET from "./mainnet.js";

export { MAINNET };

export const ADDRESSES = {
  mainnet: MAINNET,
};

export const CHAIN_KEYS_BY_ID = {
  137: "mainnet",
};

export function resolveChainKey(chainKeyOrId = "mainnet") {
  if (chainKeyOrId == null || chainKeyOrId === "") return "mainnet";
  if (typeof chainKeyOrId === "number") return CHAIN_KEYS_BY_ID[chainKeyOrId] || null;
  const asNum = Number(chainKeyOrId);
  if (!Number.isNaN(asNum)) return CHAIN_KEYS_BY_ID[asNum] || null;
  const normalized = String(chainKeyOrId).trim().toLowerCase();
  return normalized === "mainnet" || normalized === "polygon"
    ? "mainnet"
    : null;
}

export function getAddresses(chainKeyOrId = "mainnet") {
  const key = resolveChainKey(chainKeyOrId);
  return key ? ADDRESSES[key] || null : null;
}

// Legacy / compatibility exports (tokenomics readers still import these)
export * from "../addresses.js";
