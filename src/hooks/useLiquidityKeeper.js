import { useStaticContractData } from "./_hookUtils.js";

export default function useLiquidityKeeper() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.KEEPER_PROXY,
    upkeepNeeded: null,
  }));
}
