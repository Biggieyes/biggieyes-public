import { useStaticContractData } from "./_hookUtils.js";

export default function useBUYBACKKeeper() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.UPKEEP_PROXY || ADDR.KEEPER_PROXY,
    upkeepNeeded: null,
  }));
}
