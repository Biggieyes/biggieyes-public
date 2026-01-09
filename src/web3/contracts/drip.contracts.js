import { Contract } from "ethers";
import DRIPDistributorAbi from "../../config/abi/DRIPDistributor.json";
import DRIPLmAbi from "../../config/abi/DRIPLM.json";
import BiggiToken from "../../config/abi/BiggiToken.json";
import { getDRIPAddresses } from "../../config/addresses";
import defaultProvider from "../provider";

export function getDRIPContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const {
    DRIPDistributor: distributorAddr,
    DRIPLM: lmAddr,
    biggiToken,
    router,
    reserve,
    treasury,
  } = getDRIPAddresses(chainId);

  const distributorContract = new Contract(
    distributorAddr,
    DRIPDistributorAbi,
    signerOrProvider,
  );
  const lmContract = new Contract(lmAddr, DRIPLmAbi, signerOrProvider);
  const tokenContract = new Contract(biggiToken, BiggiToken, signerOrProvider);

  return {
    DRIPDistributor: distributorContract,
    DRIPLM: lmContract,
    token: tokenContract,
    addrs: {
      DRIPDistributor: distributorAddr,
      DRIPLM: lmAddr,
      router,
      reserve,
      treasury,
    },
  };
}


