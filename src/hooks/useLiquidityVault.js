import { useStaticContractData } from "./_hookUtils.js";

export default function useLiquidityVault() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.LIQUIDITY_VAULT,
    liquidityVault: ADDR.LIQUIDITY_VAULT,
  }));
}
