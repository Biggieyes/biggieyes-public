import { Contract } from "ethers";
import BiggiBuybackAgent from '../../config/abi/BiggiBuybackAgent.json';
import BiggiTreasury from '../../config/abi/BiggiTreasury.json';
import BiggiToken from '../../config/abi/BiggiToken.json';
import { getBuybackAddresses } from "../../config/addresses";
import defaultProvider from "../provider";

export function getBuybackTreasuryContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const { buybackAgent, treasury, biggiToken, router, reserve, dripDistributor, tokenRewards } =
    getBuybackAddresses(chainId);

  const buybackContract = new Contract(buybackAgent, BiggiBuybackAgent, signerOrProvider);
  const treasuryContract = new Contract(treasury, BiggiTreasury, signerOrProvider);
  const tokenContract = new Contract(biggiToken, BiggiToken, signerOrProvider);

  return {
    buyback: buybackContract,
    treasury: treasuryContract,
    token: tokenContract,
    addrs: {
      buybackAgent,
      treasury,
      biggiToken,
      router,
      reserve,
      dripDistributor,
      tokenRewards,
    },
  };
}
