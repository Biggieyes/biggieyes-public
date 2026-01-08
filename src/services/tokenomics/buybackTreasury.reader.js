import { ZeroAddress } from "ethers";
import { getBuybackTreasuryContracts } from "../../web3/contracts/buybackTreasury.contracts";
import { getProvider } from "../../web3/provider";

async function _callOptional(fn, fallback = null) {
  if (typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch (error) {
    console.warn("Buyback snapshot call failed", fn?.name, error);
    return fallback;
  }
}

export async function fetchBuybackTreasurySnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const { buyback, treasury, token, addrs } = getBuybackTreasuryContracts(
    chainId,
    signerOrProvider,
  );

  const [
    routerAddress,
    wrappedNative,
    dripLM,
    policyAddress,
    autoBuybackEnabled,
    fallbackMinIntervalSec,
    fallbackSwapSlippageBps,
    fallbackTxDeadlineSec,
    lastBuyback,
    nativeBalance,
    biggiBalance,
    totalNativeReceived,
    totalNativeSpent,
    totalBiggiAcquired,
    paused,
    treasuryBiggiBalance,
    treasuryMaticBalance,
    treasuryTotalBiggiReceived,
    treasuryTotalBiggiFromBuyback,
    treasuryTotalMaticReceived,
    treasuryTotalMaticFromDistributor,
    buybackTokenBalance,
    treasuryTokenBalance,
    chainNativeBalance,
  ] = await Promise.all([
    _callOptional(() => buyback.router()),
    _callOptional(() => buyback.wrappedNative()),
    _callOptional(() => buyback.dripLM()),
    _callOptional(() => buyback.policy()),
    _callOptional(() => buyback.autoBuybackEnabled(), false),
    _callOptional(
      () => buyback.fallbackMinIntervalSec(),
      0n,
    ),
    _callOptional(
      () => buyback.fallbackSwapSlippageBps(),
      0n,
    ),
    _callOptional(() => buyback.fallbackTxDeadlineSec(), 0n),
    _callOptional(() => buyback.lastBuybackAt(), 0n),
    _callOptional(() => buyback.nativeBalance(), 0n),
    _callOptional(() => buyback.biggiBalance(), 0n),
    _callOptional(() => buyback.totalNativeReceived(), 0n),
    _callOptional(() => buyback.totalNativeSpent(), 0n),
    _callOptional(() => buyback.totalBiggiAcquired(), 0n),
    _callOptional(() => buyback.paused(), false),
    _callOptional(() => treasury.biggiBalance(), 0n),
    _callOptional(() => treasury.maticBalance(), 0n),
    _callOptional(() => treasury.totalBiggiReceived(), 0n),
    _callOptional(
      () => treasury.totalBiggiReceivedFromBuyback(),
      0n,
    ),
    _callOptional(() => treasury.totalMaticReceived(), 0n),
    _callOptional(
      () => treasury.totalMaticReceivedFromDistributor(),
      0n,
    ),
    _callOptional(
      () => token.balanceOf(addrs.buybackAgent),
      0n,
    ),
    _callOptional(() => token.balanceOf(addrs.treasury), 0n),
    signerOrProvider
      .getBalance(addrs.buybackAgent)
      .catch(() => 0n),
  ]);

  return {
    ts: Date.now(),
    buyback: {
      address: buyback.address,
      router: routerAddress,
      wrappedNative,
      dripLM,
      policy: policyAddress,
      autoBuybackEnabled,
      fallbackMinIntervalSec,
      fallbackSwapSlippageBps,
      fallbackTxDeadlineSec,
      lastBuyback,
      nativeBalance,
      biggiBalance,
      totalNativeReceived,
      totalNativeSpent,
      totalBiggiAcquired,
      paused,
      tokenBalance: buybackTokenBalance,
      nativeOnChain: chainNativeBalance,
    },
    treasury: {
      address: treasury.address,
      biggiBalance: treasuryBiggiBalance,
      maticBalance: treasuryMaticBalance,
      totalBiggiReceived: treasuryTotalBiggiReceived,
      totalBiggiReceivedFromBuyback: treasuryTotalBiggiFromBuyback,
      totalMaticReceived: treasuryTotalMaticReceived,
      totalMaticReceivedFromDistributor: treasuryTotalMaticFromDistributor,
      tokenBalance: treasuryTokenBalance,
      buybackAgent: addrs.buybackAgent,
      tokenRewards: addrs.tokenRewards,
      dripDistributor: addrs.dripDistributor,
      reserve: addrs.reserve,
    },
    providerAddrs: addrs,
  };
}

