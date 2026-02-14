import { useStaticContractData } from "./_hookUtils.js";

export default function useBUYBACK() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.BUYBACK_AGENT,
    BUYBACKAgent: ADDR.BUYBACK_AGENT,
    DRIPDistributor: ADDR.DRIP_DISTRIBUTOR,
    DRIPLM: ADDR.DRIP_LM,
    treasury: ADDR.TREASURY,
    reserve: ADDR.RESERVE,
  }));
}
