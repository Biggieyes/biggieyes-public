// Canonical address exports for all networks
import AMOY from "./amoy.js";
import MAINNET from "./mainnet.js";
import LOCAL from "./local.js";

export { AMOY, MAINNET, LOCAL };

export const ADDRESSES = {
  amoy: AMOY,
  mainnet: MAINNET,
  local: LOCAL,
};

export const CHAIN_KEYS_BY_ID = {
  80002: "amoy",
  137: "mainnet",
  31337: "local",
};

export function resolveChainKey(chainKeyOrId = "amoy") {
  if (typeof chainKeyOrId === "number") return CHAIN_KEYS_BY_ID[chainKeyOrId] || "amoy";
  const asNum = Number(chainKeyOrId);
  if (!Number.isNaN(asNum)) return CHAIN_KEYS_BY_ID[asNum] || "amoy";
  return String(chainKeyOrId || "amoy").toLowerCase();
}

export function getAddresses(chainKeyOrId = "amoy") {
  const key = resolveChainKey(chainKeyOrId);
  return ADDRESSES[key] || ADDRESSES.amoy;
}

// Legacy / compatibility exports (tokenomics readers still import these)
export * from "../addresses.js";
