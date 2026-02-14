// Minimal UniswapV2/Quickswap-like factory ABI – stačí pro read-only volání
export const ABI_FACTORY = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
  "function allPairsLength() view returns (uint256)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
];

