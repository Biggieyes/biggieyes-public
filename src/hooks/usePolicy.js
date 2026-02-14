import { useStaticContractData } from "./_hookUtils.js";

export default function usePOLICY() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.POLICY,
    policyAddress: ADDR.POLICY,
  }));
}
