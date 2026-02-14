import { formatEther } from "ethers";

export function formatEthNum(bnOrNum) {
  if (bnOrNum == null) return null;
  try {
    if (typeof bnOrNum === 'bigint') {
      return Number(formatEther(bnOrNum));
    }
    return Number(bnOrNum);
  } catch {
    return null;
  }
}

