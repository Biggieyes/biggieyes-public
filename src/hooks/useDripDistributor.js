import { useStaticContractData } from "./_hookUtils.js";

export default function useDRIPDistributor() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.DRIP_DISTRIBUTOR,
    DRIPDistributor: ADDR.DRIP_DISTRIBUTOR,
  }));
}
