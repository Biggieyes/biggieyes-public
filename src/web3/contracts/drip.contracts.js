import { Contract } from "ethers";
import DripDistributor from "../../config/abi/DripDistributor.json";
import DripLM from "../../config/abi/DripLM.json";
import BiggiToken from "../../config/abi/BiggiToken.json";
import { getDripAddresses } from "../../config/addresses";
import defaultProvider from "../provider";

export function getDripContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const { dripDistributor, dripLM, biggiToken, router, reserve, treasury } =
    getDripAddresses(chainId);

  const distributorContract = new Contract(
    dripDistributor,
    DripDistributor,
    signerOrProvider,
  );
  const lmContract = new Contract(dripLM, DripLM, signerOrProvider);
  const tokenContract = new Contract(biggiToken, BiggiToken, signerOrProvider);

  return {
    dripDistributor: distributorContract,
    dripLM: lmContract,
    token: tokenContract,
    addrs: {
      dripDistributor,
      dripLM,
      router,
      reserve,
      treasury,
    },
  };
}

