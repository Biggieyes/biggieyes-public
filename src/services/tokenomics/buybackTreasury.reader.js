import { getBUYBACKTreasuryContracts } from "../../web3/contracts/BUYBACKTreasury.contracts";
import { getProvider } from "../../web3/provider";

async function _callOptional(fn, fallback = null) {
  if (typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch (error) {
    console.warn("BUYBACK snapshot call failed", fn?.name, error);
    return fallback;
  }
}

export async function fetchBUYBACKTreasurySnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const { BUYBACK, treasury, token, addrs } = getBUYBACKTreasuryContracts(
    chainId,
    signerOrProvider,
  );

  const [
    routerAddress,
    wrappedNative,
    DRIPLM,
    POLICYAddress,
    autoBUYBACKEnabled,
    fallbackMinIntervalSec,
    fallbackSwapSlippageBps,
    fallbackTxDeadlineSec,
    lastBUYBACK,
    nativeBalance,
    biggiBalance,
    totalNativeReceived,
    totalNativeSpent,
    totalBiggiAcquired,
    paused,
    treasuryBiggiBalance,
    treasuryMaticBalance,
    treasuryTotalBiggiReceived,
    treasuryTotalBiggiFromBUYBACK,
    treasuryTotalMaticReceived,
    treasuryTotalMaticFromDistributor,
    BUYBACKTokenBalance,
    treasuryTokenBalance,
    chainNativeBalance,
  ] = await Promise.all([
    _callOptional(() => BUYBACK.router()),
    _callOptional(() => BUYBACK.wrappedNative()),
    _callOptional(() => BUYBACK.dripLM()),
    _callOptional(() => BUYBACK.policy()),
    _callOptional(() => BUYBACK.autoBuybackEnabled(), false),
    _callOptional(
      () => BUYBACK.fallbackMinIntervalSec(),
      0n,
    ),
    _callOptional(
      () => BUYBACK.fallbackSwapSlippageBps(),
      0n,
    ),
    _callOptional(() => BUYBACK.fallbackTxDeadlineSec(), 0n),
    _callOptional(() => BUYBACK.lastBuybackAt(), 0n),
    _callOptional(() => BUYBACK.nativeBalance(), 0n),
    _callOptional(() => BUYBACK.biggiBalance(), 0n),
    _callOptional(() => BUYBACK.totalNativeReceived(), 0n),
    _callOptional(() => BUYBACK.totalNativeSpent(), 0n),
    _callOptional(() => BUYBACK.totalBiggiAcquired(), 0n),
    _callOptional(() => BUYBACK.paused(), false),
    _callOptional(() => treasury.biggiBalance(), 0n),
    _callOptional(() => treasury.maticBalance(), 0n),
    _callOptional(() => treasury.totalBiggiReceived(), 0n),
    _callOptional(() => treasury.totalBiggiReceivedFromBuyback(), 0n),
    _callOptional(() => treasury.totalMaticReceived(), 0n),
    _callOptional(
      () => treasury.totalMaticReceivedFromDistributor(),
      0n,
    ),
    _callOptional(
      () => token.balanceOf(addrs.BUYBACKAgent),
      0n,
    ),
    _callOptional(() => token.balanceOf(addrs.treasury), 0n),
    signerOrProvider
      .getBalance(addrs.BUYBACKAgent)
      .catch(() => 0n),
  ]);

  return {
    ts: Date.now(),
    BUYBACK: {
      address: BUYBACK.address,
      router: routerAddress,
      wrappedNative,
      DRIPLM,
      POLICY: POLICYAddress,
      autoBUYBACKEnabled,
      fallbackMinIntervalSec,
      fallbackSwapSlippageBps,
      fallbackTxDeadlineSec,
      lastBUYBACK,
      nativeBalance,
      biggiBalance,
      totalNativeReceived,
      totalNativeSpent,
      totalBiggiAcquired,
      paused,
      tokenBalance: BUYBACKTokenBalance,
      nativeOnChain: chainNativeBalance,
    },
    treasury: {
      address: treasury.address,
      biggiBalance: treasuryBiggiBalance,
      maticBalance: treasuryMaticBalance,
      totalBiggiReceived: treasuryTotalBiggiReceived,
      totalBiggiReceivedFromBUYBACK: treasuryTotalBiggiFromBUYBACK,
      totalMaticReceived: treasuryTotalMaticReceived,
      totalMaticReceivedFromDistributor: treasuryTotalMaticFromDistributor,
      tokenBalance: treasuryTokenBalance,
      BUYBACKAgent: addrs.BUYBACKAgent,
      tokenREWARDS: addrs.tokenREWARDS,
      DRIPDistributor: addrs.DRIPDistributor,
      reserve: addrs.reserve,
    },
    providerAddrs: addrs,
  };
}





