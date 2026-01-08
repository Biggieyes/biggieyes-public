import { Contract } from "@ethersproject/contracts";
import { keccak256, arrayify, hexlify, isAddress } from "ethers";

export async function refreshPOLICY({ getPOLICYRO, setBiggiData }) {
  const pol = await getPOLICYRO();
  if (!pol) return;

  let splits = {
    reserveBps: null,
    BUYBACKBps: null,
    collREWARDSBps: null,
    treasuryBps: null,
  };
  try {
    if (typeof pol.getDistributorSplits === "function") {
      const s = await pol.getDistributorSplits();
      if (s && s.length === 4) {
        splits = {
          reserveBps: Number(s[0]),
          BUYBACKBps: Number(s[1]),
          collREWARDSBps: Number(s[2]),
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
      pol.distributorBUYBACKBps?.(),
      pol.distributorCOLLECTIONREWARDSBps?.(),
      pol.distributorTreasuryBps?.(),
    ]);
    if (resB != null) splits.reserveBps = Number(resB);
    if (buyB != null) splits.BUYBACKBps = Number(buyB);
    if (collB != null) splits.collREWARDSBps = Number(collB);
    if (treB != null) splits.treasuryBps = Number(treB);
  } catch {
    // ignore guards fetch fallback
  }

  const guards = {
    swapSlippageBps: null,
    lpSlippageBps: null,
    txDeadlineSec: null,
    minBUYBACKInterval: null,
    maxDailyBUYBACKNative: null,
  };
  try {
    if (typeof pol.getGuards === "function") {
      const g = await pol.getGuards();
      if (g && g.length >= 5) {
        guards.swapSlippageBps = Number(g[0]);
        guards.lpSlippageBps = Number(g[1]);
        guards.txDeadlineSec = Number(g[2]);
        guards.minBUYBACKInterval = Number(g[3]);
        guards.maxDailyBUYBACKNative = formatEther(g[4]);
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
      pol.minBUYBACKInterval?.(),
      pol.maxDailyBUYBACKNative?.(),
    ]);
    if (swapSlip != null) guards.swapSlippageBps = Number(swapSlip);
    if (lpSlip != null) guards.lpSlippageBps = Number(lpSlip);
    if (deadline != null) guards.txDeadlineSec = Number(deadline);
    if (cooldown != null) guards.minBUYBACKInterval = Number(cooldown);
    if (dailyCap != null)
      guards.maxDailyBUYBACKNative = formatEther(dailyCap);
  } catch {
    // ignore guard fetch fallback
  }

  let BUYBACKsPaused = null;
  try {
    BUYBACKsPaused = !!(await pol.BUYBACKsPaused());
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





