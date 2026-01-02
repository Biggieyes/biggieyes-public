export function explorerBaseFor(chainId) {
  switch (Number(chainId)) {
    case 1: return "https://etherscan.io";
    case 5: return "https://goerli.etherscan.io";
    case 10: return "https://optimistic.etherscan.io";
    case 137: return "https://polygonscan.com";
    case 80001: return "https://mumbai.polygonscan.com";
    case 80002: return "https://amoy.polygonscan.com";
    case 8453: return "https://basescan.org";
    case 42161: return "https://arbiscan.io";
    default: return "";
  }
}
