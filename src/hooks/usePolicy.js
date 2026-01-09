// src/HOOKS/usePOLICY.js
import * as React from "react";
import { formatEther } from "ethers/lib.esm/utils.js";
import { getPOLICYRO } from "../utils/contract";
import { getCached } from "../utils/fetchCache";

/**
 * Hook pro čtení dat z POLICY kontraktu.
 * Načítá aktuální parametry politiky (BPS, limity, pauzy).
 */
export default function usePOLICY() {
  const [data, setData] = React.useState({
    alphaBUYBACKBps: 0,
    betaBurnBps: 0,
    gammaStakingBps: 0,
    deltaReserveBps: 0,
    swapSlippageBps: 0,
    lpSlippageBps: 0,
    txDeadlineSec: 0,
    minBUYBACKInterval: 0,
    epsilonPriceBandBps: 0,
    twapLookbackSec: 0,
    maxDailyBUYBACKNative: "0",
    BUYBACKsPaused: false,
    refillsPaused: false,
    lpAddsPaused: false,
    endOfCOLLECTIONPaused: false,
  });

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchPOLICY = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const contract = getPOLICYRO();
      if (!contract) throw new Error("POLICY contract not found");
      const cacheKey = `POLICY:${contract.address || "unknown"}`;

      const snapshot = await getCached(
        cacheKey,
        async () => {
          const fmt = (v) => {
            try {
              return formatEther(v);
            } catch {
              return "0";
            }
          };

          const [
            alphaBUYBACKBps,
            betaBurnBps,
            gammaStakingBps,
            deltaReserveBps,
            swapSlippageBps,
            lpSlippageBps,
            txDeadlineSec,
            minBUYBACKInterval,
            epsilonPriceBandBps,
            twapLookbackSec,
            maxDailyBUYBACKNative,
            BUYBACKsPaused,
            refillsPaused,
            lpAddsPaused,
            endOfCOLLECTIONPaused,
          ] = await Promise.all([
            contract.alphaBUYBACKBps?.().catch(() => 0),
            contract.betaBurnBps?.().catch(() => 0),
            contract.gammaStakingBps?.().catch(() => 0),
            contract.deltaReserveBps?.().catch(() => 0),
            contract.swapSlippageBps?.().catch(() => 0),
            contract.lpSlippageBps?.().catch(() => 0),
            contract.txDeadlineSec?.().catch(() => 0),
            contract.minBuybackInterval?.().catch(() => 0),
            contract.epsilonPriceBandBps?.().catch(() => 0),
            contract.twapLookbackSec?.().catch(() => 0),
            contract.maxDailyBUYBACKNative?.().catch(() => 0),
            contract.buybacksPaused?.().catch(() => false),
            contract.refillsPaused?.().catch(() => false),
            contract.lpAddsPaused?.().catch(() => false),
            contract.endOfCOLLECTIONPaused?.().catch(() => false),
          ]);

          return {
            alphaBUYBACKBps: Number(alphaBUYBACKBps),
            betaBurnBps: Number(betaBurnBps),
            gammaStakingBps: Number(gammaStakingBps),
            deltaReserveBps: Number(deltaReserveBps),
            swapSlippageBps: Number(swapSlippageBps),
            lpSlippageBps: Number(lpSlippageBps),
            txDeadlineSec: Number(txDeadlineSec),
            minBUYBACKInterval: Number(minBUYBACKInterval),
            epsilonPriceBandBps: Number(epsilonPriceBandBps),
            twapLookbackSec: Number(twapLookbackSec),
            maxDailyBUYBACKNative: fmt(maxDailyBUYBACKNative),
            BUYBACKsPaused: Boolean(BUYBACKsPaused),
            refillsPaused: Boolean(refillsPaused),
            lpAddsPaused: Boolean(lpAddsPaused),
            endOfCOLLECTIONPaused: Boolean(endOfCOLLECTIONPaused),
          };
        },
        { force: options?.force === true },
      );
      setData(snapshot);
    } catch (e) {
      console.error("usePOLICY.fetchPOLICY", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPOLICY();
  }, [fetchPOLICY]);

  return { data, loading, error, refresh: fetchPOLICY };
}



