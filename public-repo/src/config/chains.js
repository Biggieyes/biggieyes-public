export const CHAINS = {
  137: {
    chainId: 137,
    hex: "0x89",
    name: "Polygon mainnet",
    explorer: "https://polygonscan.com",
    currency: { name: "POL", symbol: "POL", decimals: 18 },
  },
};

export function getChainInfo(chainId) {
  const id = Number(chainId);
  return CHAINS[id] || null;
}

export function explorerBaseFor(chainId) {
  return getChainInfo(chainId)?.explorer || "";
}

export function chainNameFor(chainId) {
  const info = getChainInfo(chainId);
  if (info?.name) return info.name;
  const id = Number(chainId);
  return id ? `Chain ${id}` : "Not connected";
}
