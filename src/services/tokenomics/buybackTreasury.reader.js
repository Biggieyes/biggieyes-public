import { ethers } from "ethers";
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
      ethers.constants.Zero,
    ),
    _callOptional(
      () => buyback.fallbackSwapSlippageBps(),
      ethers.constants.Zero,
    ),
    _callOptional(() => buyback.fallbackTxDeadlineSec(), ethers.constants.Zero),
    _callOptional(() => buyback.lastBuybackAt(), ethers.constants.Zero),
    _callOptional(() => buyback.nativeBalance(), ethers.constants.Zero),
    _callOptional(() => buyback.biggiBalance(), ethers.constants.Zero),
    _callOptional(() => buyback.totalNativeReceived(), ethers.constants.Zero),
    _callOptional(() => buyback.totalNativeSpent(), ethers.constants.Zero),
    _callOptional(() => buyback.totalBiggiAcquired(), ethers.constants.Zero),
    _callOptional(() => buyback.paused(), false),
    _callOptional(() => treasury.biggiBalance(), ethers.constants.Zero),
    _callOptional(() => treasury.maticBalance(), ethers.constants.Zero),
    _callOptional(() => treasury.totalBiggiReceived(), ethers.constants.Zero),
    _callOptional(
      () => treasury.totalBiggiReceivedFromBuyback(),
      ethers.constants.Zero,
    ),
    _callOptional(() => treasury.totalMaticReceived(), ethers.constants.Zero),
    _callOptional(
      () => treasury.totalMaticReceivedFromDistributor(),
      ethers.constants.Zero,
    ),
    _callOptional(
      () => token.balanceOf(addrs.buybackAgent),
      ethers.constants.Zero,
    ),
    _callOptional(() => token.balanceOf(addrs.treasury), ethers.constants.Zero),
    signerOrProvider
      .getBalance(addrs.buybackAgent)
      .catch(() => ethers.constants.Zero),
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
