export async function refreshPOLICY({ getPOLICYRO, setBiggiData }) {
  const pol = await getPOLICYRO();
  if (!pol) return;

  const splits = {
    reserveBps: null,
    BUYBACKBps: null,
    collREWARDSBps: null,
    treasuryBps: null,
  };

  const guards = {
    swapSlippageBps: null,
    lpSlippageBps: null,
    txDeadlineSec: null,
    minBUYBACKInterval: null,
    maxDailyBUYBACKNative: null,
  };

  let BUYBACKsPaused = null;
  try {
    BUYBACKsPaused = !!(await pol.buybacksPaused());
  } catch {
    // ignore pause fetch
  }

  setBiggiData((prev) => ({
    ...prev,
    POLICY: {
      alphaBUYBACKBps: splits.BUYBACKBps ?? null,
      betaBurnBps: null,
      gammaStakingBps: splits.collREWARDSBps ?? null,
      deltaReserveBps: splits.reserveBps ?? null,
      swapSlippageBps: guards.swapSlippageBps,
      lpSlippageBps: guards.lpSlippageBps,
      txDeadlineSec: guards.txDeadlineSec,
      minBUYBACKInterval: guards.minBUYBACKInterval,
      epsilonPriceBandBps: null,
      twapLookbackSec: null,
      maxDailyBUYBACKNative: guards.maxDailyBUYBACKNative,
      BUYBACKsPaused,
      refillsPaused: null,
      lpAddsPaused: null,
      endOfCOLLECTIONPaused: null,
      operators: [],
    },
  }));
}





