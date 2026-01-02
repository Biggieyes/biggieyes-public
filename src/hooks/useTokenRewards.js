// src/hooks/useTokenRewards.js
import * as React from "react";
import { ethers } from "ethers";
import { getReadOnlyContract } from "../utils/contract"; // přizpůsob podle projektu
import { ABI_TOKEN_REWARDS } from "../utils/abi/index.js";

/**
 * Hook pro čtení informací z TokenRewards kontraktu.
 * Čte stav odměn v tokenech a týdenní statistiky.
 */
export default function useTokenRewards() {
  const [data, setData] = React.useState({
    totalDistributed: "0",
    claimableNow: "0",
    currentWeek: 0,
    lastDistribution: null,
    nextDistribution: null,
    rewardToken: null,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchTokenRewards = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const contract = await getReadOnlyContract("tokenRewards", ABI_TOKEN_REWARDS);
      if (!contract) throw new Error("TokenRewards contract not found");

      const [
        totalDistributedWei,
        claimableNowWei,
        currentWeekBN,
        rewardToken,
        lastDistRaw,
        nextDistRaw,
      ] = await Promise.all([
        contract.totalDistributed?.().catch(() => ethers.constants.Zero),
        contract.claimableNow?.().catch(() => ethers.constants.Zero),
        contract.currentWeek?.().catch(() => 0),
        contract.rewardToken?.().catch(() => contract.token?.().catch(() => null)),
        contract.lastDistributionAt?.().catch(() => 0),
        contract.nextDistributionAt?.().catch(() => 0),
      ]);

      let lastDistribution = null;
      let nextDistribution = null;
      try {
        const l = Number(lastDistRaw?.toString?.() || 0);
        const n = Number(nextDistRaw?.toString?.() || 0);
        if (l > 0) lastDistribution = new Date(l * 1000).toLocaleString();
        if (n > 0) nextDistribution = new Date(n * 1000).toLocaleString();
      } catch (err) {
        console.debug("tokenRewards date parsing failed", err);
      }

      setData({
        totalDistributed: ethers.utils.formatEther(totalDistributedWei || 0),
        claimableNow: ethers.utils.formatEther(claimableNowWei || 0),
        currentWeek: Number(currentWeekBN || 0),
        lastDistribution,
        nextDistribution,
        rewardToken: rewardToken || null,
      });
    } catch (e) {
      console.error("useTokenRewards.fetchTokenRewards", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTokenRewards();
  }, [fetchTokenRewards]);

  return { data, loading, error, refresh: fetchTokenRewards };
}
