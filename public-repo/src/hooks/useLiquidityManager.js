import { useStaticContractData } from "./_hookUtils.js";

export default function useLiquidityManager() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.LM,
    router: ADDR.ROUTER,
    factory: ADDR.FACTORY,
    pair: ADDR.PAIR,
    keeper: ADDR.KEEPER_PROXY,
  }));
}
