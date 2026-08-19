import { Contract, ZeroAddress } from "ethers";
import {
  BiggiBuybackAgent as ABI_BiggiBuybackAgent,
  BiggiTreasury as ABI_BiggiTreasury,
  BiggiToken as ABI_BiggiToken,
} from "@/config/abi/index.js";
import { getBUYBACKAddresses } from "../../config/addresses/index.js";
import defaultProvider from "../provider";

export function getBUYBACKTreasuryContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const addrs = getBUYBACKAddresses(chainId);

  const BUYBACKAddress =
    addrs?.BUYBACKAgent || addrs?.BUYBACK || addrs?.buyback || ZeroAddress;
  const treasuryAddress = addrs?.treasury || ZeroAddress;
  const tokenAddress =
    addrs?.biggiToken || addrs?.biggi || addrs?.BIGGI || ZeroAddress;

  const BUYBACK = new Contract(
    BUYBACKAddress,
    ABI_BiggiBuybackAgent,
    signerOrProvider,
  );
  const treasury = new Contract(
    treasuryAddress,
    ABI_BiggiTreasury,
    signerOrProvider,
  );
  const token = new Contract(
    tokenAddress,
    ABI_BiggiToken,
    signerOrProvider,
  );

  return {
    BUYBACK,
    treasury,
    token,
    addrs,
  };
}

export default {
  getBUYBACKTreasuryContracts,
};
