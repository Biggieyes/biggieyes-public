import { Contract, ZeroAddress } from "ethers";
import {
  BiggiDripDistributor as ABI_BiggiDripDistributor,
  DripKeeperProxy as ABI_DripKeeperProxy,
  BiggiDripLMToModerator as ABI_BiggiDripLMToModerator,
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
    ABI_BiggiDripDistributor,
    signerOrProvider,
  );
  const DRIPLM = new Contract(lmAddress, ABI_BiggiDripLMToModerator, signerOrProvider);
  const DRIPKeeper = dripKeeperAddress
    ? new Contract(dripKeeperAddress, ABI_DripKeeperProxy, signerOrProvider)
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
