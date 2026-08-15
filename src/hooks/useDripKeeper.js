import { useStaticContractData } from "./_hookUtils.js";

export default function useDRIPKeeper(_walletAddress) {
  return useStaticContractData((ADDR) => ({
    address: ADDR.DRIP_KEEPER_PROXY,
    upkeepNeeded: null,
    DRIPLM: ADDR.DRIP_LM,
  }));
}
