import { useStaticContractData } from "./_hookUtils.js";

export default function useDRIPLM() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.DRIP_LM,
    DRIPLM: ADDR.DRIP_LM,
  }));
}
