import { useStaticContractData } from "./_hookUtils.js";

export default function useTreasury() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.TREASURY,
    treasuryAddress: ADDR.TREASURY,
    tokenRewards: ADDR.TOKEN_REWARDS,
    reserve: ADDR.RESERVE,
  }));
}
