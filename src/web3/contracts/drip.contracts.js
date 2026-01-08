import { Contract } from "ethers";
import DRIPDistributor from "../../config/abi/DRIPDistributor.json";
import DRIPLM from "../../config/abi/DRIPLM.json";
import BiggiToken from "../../config/abi/BiggiToken.json";
import { getDRIPAddresses } from "../../config/addresses";
import defaultProvider from "../provider";

export function getDRIPContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const { DRIPDistributor, DRIPLM, biggiToken, router, reserve, treasury } =
    getDRIPAddresses(chainId);

  const distributorContract = new Contract(
    DRIPDistributor,
    DRIPDistributor,
    signerOrProvider,
  );
  const lmContract = new Contract(DRIPLM, DRIPLM, signerOrProvider);
  const tokenContract = new Contract(biggiToken, BiggiToken, signerOrProvider);

  return {
    DRIPDistributor: distributorContract,
    DRIPLM: lmContract,
    token: tokenContract,
    addrs: {
      DRIPDistributor,
      DRIPLM,
      router,
      reserve,
      treasury,
    },
  };
}


