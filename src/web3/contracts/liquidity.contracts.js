import { Contract } from "ethers";
import {
  BiggiReserveV4 as ABI_BiggiReserve,
  BiggiLiquidityBranchUserReader as ABI_BiggiLiquidityBranchUserReader,
  BiggiLiquidityManager as ABI_BiggiLiquidityManager,
  BiggiLiquidityHelperReader as ABI_BiggiLiquidityHelperReader,
  BiggiLiquidityOrchestrator as ABI_BiggiLiquidityOrchestrator,
  LiquidityVault as ABI_LiquidityVault,
  LiquidityKeeperProxy as ABI_LiquidityKeeperProxy,
  BiggiReserveTreasuryReader as ABI_BiggiReserveTreasuryReader,
} from "@/config/abi/index.js";
import { getLiquidityAddresses } from "../../config/addresses/index.js";
import defaultProvider from "../provider";
export function getLiquidityContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const {
    reserve,
    liquidityManager,
    liquidityVault,
    liquidityHelper,
    reserveTreasuryReader,
    liquidityOrchestrator,
    keeperProxy,
    liquidityBranchUserReader,
  } =
    getLiquidityAddresses(chainId);

  const reserveContract = new Contract(
    reserve,
    ABI_BiggiReserve,
    signerOrProvider,
  );
  const managerContract = new Contract(
    liquidityManager,
    ABI_BiggiLiquidityManager,
    signerOrProvider,
  );
  const vaultContract = new Contract(
    liquidityVault,
    ABI_LiquidityVault,
    signerOrProvider,
  );
  const helperContract = liquidityHelper
    ? new Contract(liquidityHelper, ABI_BiggiLiquidityHelperReader, signerOrProvider)
    : null;
  const reserveTreasuryReaderContract = reserveTreasuryReader
    ? new Contract(
        reserveTreasuryReader,
        ABI_BiggiReserveTreasuryReader,
        signerOrProvider,
      )
    : null;
  const orchestratorContract = liquidityOrchestrator
    ? new Contract(
        liquidityOrchestrator,
        ABI_BiggiLiquidityOrchestrator,
        signerOrProvider,
      )
    : null;
  const keeperProxyContract = keeperProxy
    ? new Contract(keeperProxy, ABI_LiquidityKeeperProxy, signerOrProvider)
    : null;
  const branchUserReaderContract = liquidityBranchUserReader
    ? new Contract(
        liquidityBranchUserReader,
        ABI_BiggiLiquidityBranchUserReader,
        signerOrProvider,
      )
    : null;

  return {
    reserve: reserveContract,
    manager: managerContract,
    vault: vaultContract,
    helper: helperContract,
    reserveTreasuryReader: reserveTreasuryReaderContract,
    orchestrator: orchestratorContract,
    keeperProxy: keeperProxyContract,
    branchUserReader: branchUserReaderContract,
  };
}
