import { ethers } from "ethers";

export async function refreshPolicy({ getPolicyRO, setBiggiData }) {
  const pol = await getPolicyRO();
  if (!pol) return;

  let splits = { reserveBps: null, buybackBps: null, collRewardsBps: null, treasuryBps: null };
  try {
    if (typeof pol.getDistributorSplits === "function") {
      const s = await pol.getDistributorSplits();
      if (s && s.length === 4) {
        splits = {
          reserveBps: Number(s[0]),
          buybackBps: Number(s[1]),
          collRewardsBps: Number(s[2]),
          treasuryBps: Number(s[3]),
        };
      }
    }
  } catch {
    // ignore distributor splits fallback
  }
  try {
    const [resB, buyB, collB, treB] = await Promise.all([
      pol.distributorReserveBps?.(),
      pol.distributorBuybackBps?.(),
      pol.distributorCollectionRewardsBps?.(),
      pol.distributorTreasuryBps?.(),
    ]);
    if (resB != null) splits.reserveBps = Number(resB);
    if (buyB != null) splits.buybackBps = Number(buyB);
    if (collB != null) splits.collRewardsBps = Number(collB);
    if (treB != null) splits.treasuryBps = Number(treB);
  } catch {
    // ignore guards fetch fallback
  }

  const guards = {
    swapSlippageBps: null,
    lpSlippageBps: null,
    txDeadlineSec: null,
    minBuybackInterval: null,
    maxDailyBuybackNative: null,
  };
  try {
    if (typeof pol.getGuards === "function") {
      const g = await pol.getGuards();
      if (g && g.length >= 5) {
        guards.swapSlippageBps = Number(g[0]);
        guards.lpSlippageBps = Number(g[1]);
        guards.txDeadlineSec = Number(g[2]);
        guards.minBuybackInterval = Number(g[3]);
        guards.maxDailyBuybackNative = ethers.utils.formatEther(g[4]);
      }
    }
  } catch {
    // ignore guards fetch fallback
  }
  try {
    const [swapSlip, lpSlip, deadline, cooldown, dailyCap] = await Promise.all([
      pol.swapSlippageBps?.(),
      pol.lpSlippageBps?.(),
      pol.txDeadlineSec?.(),
      pol.minBuybackInterval?.(),
      pol.maxDailyBuybackNative?.(),
    ]);
    if (swapSlip != null) guards.swapSlippageBps = Number(swapSlip);
    if (lpSlip != null) guards.lpSlippageBps = Number(lpSlip);
    if (deadline != null) guards.txDeadlineSec = Number(deadline);
    if (cooldown != null) guards.minBuybackInterval = Number(cooldown);
    if (dailyCap != null) guards.maxDailyBuybackNative = ethers.utils.formatEther(dailyCap);
  } catch {
    // ignore guard fetch fallback
  }

  let buybacksPaused = null;
  try { buybacksPaused = !!(await pol.buybacksPaused()); } catch {
    // ignore pause fetch
  }

  setBiggiData((prev) => ({
    ...prev,
    policy: {
      alphaBuybackBps: splits.buybackBps ?? null,
      betaBurnBps: null,
      gammaStakingBps: splits.collRewardsBps ?? null,
      deltaReserveBps: splits.reserveBps ?? null,
      swapSlippageBps: guards.swapSlippageBps,
      lpSlippageBps: guards.lpSlippageBps,
      txDeadlineSec: guards.txDeadlineSec,
      minBuybackInterval: guards.minBuybackInterval,
      epsilonPriceBandBps: null,
      twapLookbackSec: null,
      maxDailyBuybackNative: guards.maxDailyBuybackNative,
      buybacksPaused,
      refillsPaused: null,
      lpAddsPaused: null,
      endOfCollectionPaused: null,
      operators: [],
    },
  }));
}
