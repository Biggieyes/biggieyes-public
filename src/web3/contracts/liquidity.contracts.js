import { Contract } from "ethers";
import {
  BiggiReserveV4 as ABI_BiggiReserve,
  BiggiLiquidityManager as ABI_BiggiLiquidityManager,
  BiggiLiquidityHelperReader as ABI_BiggiLiquidityHelperReader,
  LiquidityVault as ABI_LiquidityVault,
  BiggiReserveTreasuryReader as ABI_BiggiReserveTreasuryReader,
} from "@/config/abi/index.js";
import { getLiquidityAddresses } from "../../config/addresses";
import defaultProvider from "../provider";
export function getLiquidityContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const {
    reserve,
    liquidityManager,
    liquidityVault,
    liquidityHelper,
    reserveTreasuryReader,
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

  return {
    reserve: reserveContract,
    manager: managerContract,
    vault: vaultContract,
    helper: helperContract,
    reserveTreasuryReader: reserveTreasuryReaderContract,
  };
}
