export const CHAINS = {
  1: {
    chainId: 1,
    hex: "0x1",
    name: "Ethereum",
    explorer: "https://etherscan.io",
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
  },
  10: {
    chainId: 10,
    hex: "0xa",
    name: "Optimism",
    explorer: "https://optimistic.etherscan.io",
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
  },
  137: {
    chainId: 137,
    hex: "0x89",
    name: "Polygon",
    explorer: "https://polygonscan.com",
    currency: { name: "POL", symbol: "POL", decimals: 18 },
  },
  8453: {
    chainId: 8453,
    hex: "0x2105",
    name: "Base",
    explorer: "https://basescan.org",
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
  },
  42161: {
    chainId: 42161,
    hex: "0xa4b1",
    name: "Arbitrum One",
    explorer: "https://arbiscan.io",
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
  },
  31337: {
    chainId: 31337,
    hex: "0x7a69",
    name: "Localhost",
    explorer: "",
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
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
