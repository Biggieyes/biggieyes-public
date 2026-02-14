import { useStaticContractData } from "./_hookUtils.js";

export default function useReserve() {
  return useStaticContractData((ADDR) => ({
    address: ADDR.RESERVE,
    reserveAddress: ADDR.RESERVE,
    liquidityManager: ADDR.LM || ADDR.LIQUIDITY_MANAGER,
    liquidityVault: ADDR.LIQUIDITY_VAULT,
    token: ADDR.BIGGI,
  }));
}
