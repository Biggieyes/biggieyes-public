import { useStaticContractData } from "./_hookUtils.js";

export default function useBiggiToken(_walletAddress) {
  return useStaticContractData((ADDR) => ({
    address: ADDR.BIGGI,
    tokenAddress: ADDR.BIGGI,
    symbol: "BIGGI",
    decimals: 18,
  }));
}
