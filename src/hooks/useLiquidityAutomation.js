import { useStaticContractData } from "./_hookUtils.js";

export default function useLiquidityAutomation() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.LIQUIDITY_AUTOMATION,
    router: ADDR.ROUTER,
    factory: ADDR.FACTORY,
  }));
}
