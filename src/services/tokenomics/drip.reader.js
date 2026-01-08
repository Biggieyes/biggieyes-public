import { ZeroAddress } from "ethers";
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
    _callOptional(() => dripDistributor.CAP(), 0n),
    _callOptional(
      () => dripDistributor.availableTokens(),
      0n,
    ),
    _callOptional(() => dripDistributor.capRemaining(), 0n),
    _callOptional(() => dripDistributor.tokensPerMint(), 0n),
    _callOptional(() => dripDistributor.getAvailable(), 0n),
    _callOptional(
      () => dripDistributor.getTotalClaimed(),
      0n,
    ),
    _callOptional(
      () => dripDistributor.getTotalNotified(),
      0n,
    ),
    _callOptional(() => dripDistributor.getTotalTopUp(), 0n),
    _callOptional(() => dripDistributor.paused(), false),
    _callOptional(() => dripLM.sellPct(), 0),
    _callOptional(() => dripLM.slippageBps(), 0n),
    _callOptional(() => dripLM.txDeadlineSec(), 0n),
    _callOptional(
      () => token.balanceOf(addrs.dripDistributor),
      0n,
    ),
    _callOptional(() => token.balanceOf(addrs.dripLM), 0n),
    _callOptional(
      () => signerOrProvider.getBalance(addrs.dripLM),
      0n,
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

