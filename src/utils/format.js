import { ethers } from "ethers";

export function formatEthNum(bnOrNum) {
  if (bnOrNum == null) return null;
  try {
    if (ethers.BigNumber.isBigNumber(bnOrNum)) {
      return Number(ethers.utils.formatEther(bnOrNum));
    }
    return Number(bnOrNum);
  } catch {
    return null;
  }
}
