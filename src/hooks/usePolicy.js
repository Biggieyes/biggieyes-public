// src/hooks/usePolicy.js
import * as React from "react";
import { ethers } from "ethers";
import { getPolicyRO } from "../utils/contract";
import { getCached } from "../utils/fetchCache";

/**
 * Hook pro čtení dat z Policy kontraktu.
 * Načítá aktuální parametry politiky (BPS, limity, pauzy).
 */
export default function usePolicy() {
  const [data, setData] = React.useState({
    alphaBuybackBps: 0,
    betaBurnBps: 0,
    gammaStakingBps: 0,
    deltaReserveBps: 0,
    swapSlippageBps: 0,
    lpSlippageBps: 0,
    txDeadlineSec: 0,
    minBuybackInterval: 0,
    epsilonPriceBandBps: 0,
    twapLookbackSec: 0,
    maxDailyBuybackNative: "0",
    buybacksPaused: false,
    refillsPaused: false,
    lpAddsPaused: false,
    endOfCollectionPaused: false,
  });

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchPolicy = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const contract = getPolicyRO();
      if (!contract) throw new Error("Policy contract not found");
      const cacheKey = `policy:${contract.address || "unknown"}`;

      const snapshot = await getCached(
        cacheKey,
        async () => {
          const fmt = (v) => {
            try {
              return ethers.utils.formatEther(v);
            } catch {
              return "0";
            }
          };

          const [
            alphaBuybackBps,
            betaBurnBps,
            gammaStakingBps,
            deltaReserveBps,
            swapSlippageBps,
            lpSlippageBps,
            txDeadlineSec,
            minBuybackInterval,
            epsilonPriceBandBps,
            twapLookbackSec,
            maxDailyBuybackNative,
            buybacksPaused,
            refillsPaused,
            lpAddsPaused,
            endOfCollectionPaused,
          ] = await Promise.all([
            contract.alphaBuybackBps?.().catch(() => 0),
            contract.betaBurnBps?.().catch(() => 0),
            contract.gammaStakingBps?.().catch(() => 0),
            contract.deltaReserveBps?.().catch(() => 0),
            contract.swapSlippageBps?.().catch(() => 0),
            contract.lpSlippageBps?.().catch(() => 0),
            contract.txDeadlineSec?.().catch(() => 0),
            contract.minBuybackInterval?.().catch(() => 0),
            contract.epsilonPriceBandBps?.().catch(() => 0),
            contract.twapLookbackSec?.().catch(() => 0),
            contract.maxDailyBuybackNative?.().catch(() => 0),
            contract.buybacksPaused?.().catch(() => false),
            contract.refillsPaused?.().catch(() => false),
            contract.lpAddsPaused?.().catch(() => false),
            contract.endOfCollectionPaused?.().catch(() => false),
          ]);

          return {
            alphaBuybackBps: Number(alphaBuybackBps),
            betaBurnBps: Number(betaBurnBps),
            gammaStakingBps: Number(gammaStakingBps),
            deltaReserveBps: Number(deltaReserveBps),
            swapSlippageBps: Number(swapSlippageBps),
            lpSlippageBps: Number(lpSlippageBps),
            txDeadlineSec: Number(txDeadlineSec),
            minBuybackInterval: Number(minBuybackInterval),
            epsilonPriceBandBps: Number(epsilonPriceBandBps),
            twapLookbackSec: Number(twapLookbackSec),
            maxDailyBuybackNative: fmt(maxDailyBuybackNative),
            buybacksPaused: Boolean(buybacksPaused),
            refillsPaused: Boolean(refillsPaused),
            lpAddsPaused: Boolean(lpAddsPaused),
            endOfCollectionPaused: Boolean(endOfCollectionPaused),
          };
        },
        { force: options?.force === true },
      );
      setData(snapshot);
    } catch (e) {
      console.error("usePolicy.fetchPolicy", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  return { data, loading, error, refresh: fetchPolicy };
}
