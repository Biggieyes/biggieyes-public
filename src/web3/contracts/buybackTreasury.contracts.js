import { Contract } from "ethers";
import BiggiBUYBACKAgent from "../../config/abi/BiggiBUYBACKAgent.json";
import BiggiTreasury from "../../config/abi/BiggiTreasury.json";
import BiggiToken from "../../config/abi/BiggiToken.json";
import { getBUYBACKAddresses } from "../../config/addresses";
import defaultProvider from "../provider";

export function getBUYBACKTreasuryContracts(chainId, provider) {
  const signerOrProvider = provider || defaultProvider;
  const {
    BUYBACKAgent,
    treasury,
    biggiToken,
    router,
    reserve,
    DRIPDistributor,
    tokenREWARDS,
  } = getBUYBACKAddresses(chainId);

  const BUYBACKContract = new Contract(
    BUYBACKAgent,
    BiggiBUYBACKAgent,
    signerOrProvider,
  );
  const treasuryContract = new Contract(
    treasury,
    BiggiTreasury,
    signerOrProvider,
  );
  const tokenContract = new Contract(biggiToken, BiggiToken, signerOrProvider);

  return {
    BUYBACK: BUYBACKContract,
    treasury: treasuryContract,
    token: tokenContract,
    addrs: {
      BUYBACKAgent,
      treasury,
      biggiToken,
      router,
      reserve,
      DRIPDistributor,
      tokenREWARDS,
    },
  };
}




