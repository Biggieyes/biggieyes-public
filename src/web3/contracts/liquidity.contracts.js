import { Contract } from "ethers";
import BiggiReserve from "../../config/abi/BiggiReserve.json";
import BiggiLiquidityManager from "../../config/abi/BiggiLiquidityManager.json";
import LiquidityVault from "../../config/abi/LiquidityVault.json";
import { getLiquidityAddresses } from "../../config/addresses";
import defaultProvider from "../provider";

export function getLiquidityContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const { reserve, liquidityManager, liquidityVault } =
    getLiquidityAddresses(chainId);

  const reserveContract = new Contract(
    reserve,
    BiggiReserve,
    signerOrProvider,
  );
  const managerContract = new Contract(
    liquidityManager,
    BiggiLiquidityManager,
    signerOrProvider,
  );
  const vaultContract = new Contract(
    liquidityVault,
    LiquidityVault,
    signerOrProvider,
  );

  return {
    reserve: reserveContract,
    manager: managerContract,
    vault: vaultContract,
  };
}
