import { Contract, ZeroAddress } from "ethers";
import {
  BiggiDRIPDistributor as ABI_BiggiDRIPDistributor,
  BiggiDRIPLM as ABI_BiggiDRIPLM,
  BiggiToken as ABI_BiggiToken,
} from "@/config/abi/index.js";
import { getDRIPAddresses } from "../../config/addresses";
import defaultProvider from "../provider";

export function getDRIPContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const addrs = getDRIPAddresses(chainId);

  const distributorAddress = addrs?.DRIPDistributor || ZeroAddress;
  const lmAddress = addrs?.DRIPLM || ZeroAddress;
  const tokenAddress =
    addrs?.biggiToken || addrs?.biggi || addrs?.BIGGI || ZeroAddress;

  const DRIPDistributor = new Contract(
    distributorAddress,
    ABI_BiggiDRIPDistributor,
    signerOrProvider,
  );
  const DRIPLM = new Contract(lmAddress, ABI_BiggiDRIPLM, signerOrProvider);
  const token = new Contract(tokenAddress, ABI_BiggiToken, signerOrProvider);

  return {
    DRIPDistributor,
    DRIPLM,
    token,
    addrs,
  };
}

export default {
  getDRIPContracts,
};
