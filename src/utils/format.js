import { BigNumber } from "@ethersproject/bignumber";
import { formatUnits, parseUnits } from "@ethersproject/units";

export function formatEthNum(bnOrNum) {
  if (bnOrNum == null) return null;
  try {
    if (ethers.BigNumber.isBigNumber(bnOrNum)) {
      return Number(ethers.formatEther(bnOrNum));
    }
    return Number(bnOrNum);
  } catch {
    return null;
  }
}
