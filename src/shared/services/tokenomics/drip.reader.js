import { isAddress } from "ethers";
import { getProvider } from "../../../web3/provider";
import { getDRIPContracts } from "../../../web3/contracts/DRIP.contracts";

async function _callOptional(fn, fallback = null) {
  if (typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch (error) {
    console.warn("DRIP snapshot call failed", fn?.name, error);
    return fallback;
  }
}

// totalReceived/getTotalReceived calls are disabled (invalid ABI/contract response).

export async function fetchDRIPSnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const { DRIPDistributor, DRIPLM, token, addrs } = getDRIPContracts(
    chainId,
    signerOrProvider,
  );
  const distributorAddr = isAddress(addrs?.DRIPDistributor)
    ? addrs.DRIPDistributor
    : null;
  const lmAddr = isAddress(addrs?.DRIPLM) ? addrs.DRIPLM : null;

  const [
    cap,
    availableTokens,
    capRemaining,
    tokensPerMint,
    getAvailable,
    totalClaimed,
    totalNotified,
    paused,
    sellPct,
    slippageBps,
    txDeadlineSec,
    biggiDistributor,
    biggiLm,
    nativeBalance,
  ] = await Promise.all([
    _callOptional(() => DRIPDistributor.CAP(), 0n),
    _callOptional(
      () => DRIPDistributor.availableTokens(),
      0n,
    ),
    _callOptional(() => DRIPDistributor.capRemaining(), 0n),
    _callOptional(() => DRIPDistributor.tokensPerMint(), 0n),
    _callOptional(() => DRIPDistributor.getAvailable(), 0n),
    _callOptional(
      () => DRIPDistributor.getTotalClaimed(),
      0n,
    ),
    _callOptional(
      () => DRIPDistributor.getTotalNotified(),
      0n,
    ),
    _callOptional(() => DRIPDistributor.paused(), false),
    _callOptional(() => DRIPLM.sellPct(), 0),
    _callOptional(() => DRIPLM.slippageBps(), 0n),
    _callOptional(() => DRIPLM.txDeadlineSec(), 0n),
    _callOptional(
      () => (distributorAddr ? token.balanceOf(distributorAddr) : 0n),
      0n,
    ),
    _callOptional(() => (lmAddr ? token.balanceOf(lmAddr) : 0n), 0n),
    _callOptional(
      () => (lmAddr ? signerOrProvider.getBalance(lmAddr) : 0n),
      0n,
    ),
  ]);

  const totalTopUpPrimary = null;
  const totalTopUpFallback = null;
  const totalTopUp = totalTopUpPrimary ?? totalTopUpFallback ?? 0n;

  return {
    ts: Date.now(),
    distributor: {
      address: DRIPDistributor.address,
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
      DRIPLM: addrs.DRIPLM,
      treasury: addrs.treasury,
    },
    DRIPLM: {
      address: DRIPLM.address,
      sellPct,
      slippageBps,
      txDeadlineSec,
      router: addrs.router,
      reserve: addrs.reserve,
      biggiBalance: biggiLm,
      nativeBalance,
      distributor: addrs.DRIPDistributor,
    },
  };
}
