import { Contract, ZeroAddress } from "ethers";
import {
  BiggiDRIPDistributor as ABI_BiggiDRIPDistributor,
  BiggiDRIPKeeper as ABI_BiggiDRIPKeeper,
  BiggiDRIPLM as ABI_BiggiDRIPLM,
  BiggiToken as ABI_BiggiToken,
} from "@/config/abi/index.js";
import { getDRIPAddresses } from "../../config/addresses/index.js";
import defaultProvider from "../provider";

export function getDRIPContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const addrs = getDRIPAddresses(chainId);

  const distributorAddress = addrs?.DRIPDistributor || ZeroAddress;
  const lmAddress = addrs?.DRIPLM || ZeroAddress;
  const tokenAddress =
    addrs?.biggiToken || addrs?.biggi || addrs?.BIGGI || ZeroAddress;
  const dripKeeperAddress = addrs?.dripKeeperProxy || null;

  const DRIPDistributor = new Contract(
    distributorAddress,
    ABI_BiggiDRIPDistributor,
    signerOrProvider,
  );
  const DRIPLM = new Contract(lmAddress, ABI_BiggiDRIPLM, signerOrProvider);
  const DRIPKeeper = dripKeeperAddress
    ? new Contract(dripKeeperAddress, ABI_BiggiDRIPKeeper, signerOrProvider)
    : null;
  const token = new Contract(tokenAddress, ABI_BiggiToken, signerOrProvider);

  return {
    DRIPDistributor,
    DRIPLM,
    DRIPKeeper,
    token,
    addrs,
  };
}

export default {
  getDRIPContracts,
};
