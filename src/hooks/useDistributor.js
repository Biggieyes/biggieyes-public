import { useStaticContractData } from "./_hookUtils.js";

export default function useDistributor() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.DISTRIBUTOR,
    distributorAddress: ADDR.DISTRIBUTOR,
    pendingBUYBACK: null,
    pendingBUYBACKAgent: null,
  }));
}
