import { ethers } from "ethers";
import { getDripContracts } from "../../web3/contracts/drip.contracts";
import { getProvider } from "../../web3/provider";

async function _callOptional(fn, fallback = null) {
  if (typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch (error) {
    console.warn("Drip snapshot call failed", fn?.name, error);
    return fallback;
  }
}

export async function fetchDripSnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const { dripDistributor, dripLM, token, addrs } = getDripContracts(
    chainId,
    signerOrProvider,
  );

  const [
    cap,
    availableTokens,
    capRemaining,
    tokensPerMint,
    getAvailable,
    totalClaimed,
    totalNotified,
    totalTopUp,
    paused,
    sellPct,
    slippageBps,
    txDeadlineSec,
    biggiDistributor,
    biggiLm,
    nativeBalance,
  ] = await Promise.all([
    _callOptional(() => dripDistributor.CAP(), ethers.constants.Zero),
    _callOptional(
      () => dripDistributor.availableTokens(),
      ethers.constants.Zero,
    ),
    _callOptional(() => dripDistributor.capRemaining(), ethers.constants.Zero),
    _callOptional(() => dripDistributor.tokensPerMint(), ethers.constants.Zero),
    _callOptional(() => dripDistributor.getAvailable(), ethers.constants.Zero),
    _callOptional(
      () => dripDistributor.getTotalClaimed(),
      ethers.constants.Zero,
    ),
    _callOptional(
      () => dripDistributor.getTotalNotified(),
      ethers.constants.Zero,
    ),
    _callOptional(() => dripDistributor.getTotalTopUp(), ethers.constants.Zero),
    _callOptional(() => dripDistributor.paused(), false),
    _callOptional(() => dripLM.sellPct(), 0),
    _callOptional(() => dripLM.slippageBps(), ethers.constants.Zero),
    _callOptional(() => dripLM.txDeadlineSec(), ethers.constants.Zero),
    _callOptional(
      () => token.balanceOf(addrs.dripDistributor),
      ethers.constants.Zero,
    ),
    _callOptional(() => token.balanceOf(addrs.dripLM), ethers.constants.Zero),
    _callOptional(
      () => signerOrProvider.getBalance(addrs.dripLM),
      ethers.constants.Zero,
    ),
  ]);

  return {
    ts: Date.now(),
    distributor: {
      address: dripDistributor.address,
      cap,
      availableTokens,
      capRemaining,
      tokensPerMint,
      paused,
      totalClaimed,
      totalNotified,
      totalTopUp,
      getAvailable,
      tokenBalance: biggiDistributor,
      dripLM: addrs.dripLM,
      treasury: addrs.treasury,
    },
    dripLM: {
      address: dripLM.address,
      sellPct,
      slippageBps,
      txDeadlineSec,
      router: addrs.router,
      reserve: addrs.reserve,
      biggiBalance: biggiLm,
      nativeBalance,
      distributor: addrs.dripDistributor,
    },
  };
}
