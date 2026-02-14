import * as React from "react";
import { Contract } from "ethers";
import { ADDR } from "@/shared/utils/addresses";
import { getROProvider } from "@/shared/utils/contract";
import { BiggiTokenRewards as BiggiTokenRewardsABI } from "@/config/abi/index.js";

const ABI = Array.isArray(BiggiTokenRewardsABI) ? BiggiTokenRewardsABI : [];

const safeCall = async (fn, fallback = null) => {
  if (typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

const normalizeTokenMeta = (meta) => {
  if (!meta) return null;
  if (Array.isArray(meta)) {
    return {
      name_: meta[0],
      symbol_: meta[1],
      decimals_: Number(meta[2] ?? 18),
    };
  }
  return meta;
};

export default function useTokenRewards(providerOverride, addressOverride) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const provider = React.useMemo(() => {
    if (providerOverride) return providerOverride;
    try {
      return getROProvider();
    } catch {
      return null;
    }
  }, [providerOverride]);

  const address = addressOverride || ADDR.TOKEN_REWARDS;

  const refresh = React.useCallback(async () => {
    if (!provider || !address || !ABI.length) {
      setData(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const contract = new Contract(address, ABI, provider);
      const [
        unitReward,
        rewardsMinted,
        rewardsCap,
        remainingCap,
        totalDistributed,
        distributedThisWeek,
        currentWeek,
        lastRecordedWeek,
        lastWeekDistributed,
        blockWeights,
        tokenMetaRaw,
      ] = await Promise.all([
        safeCall(() => contract.unitReward?.(), null),
        safeCall(() => contract.rewardsMinted?.(), null),
        safeCall(() => contract.rewardsCap?.(), null),
        safeCall(() => contract.remainingCap?.(), null),
        safeCall(() => contract.totalDistributed?.(), null),
        safeCall(() => contract.distributedThisWeek?.(), null),
        safeCall(() => contract.currentWeek?.(), null),
        safeCall(() => contract.lastRecordedWeek?.(), null),
        safeCall(() => contract.lastWeekDistributed?.(), null),
        safeCall(() => contract.getBlockWeights?.(), null),
        safeCall(() => contract.tokenMeta?.(), null),
      ]);

      const tokenMeta = normalizeTokenMeta(tokenMetaRaw);
      const tokenDecimals = tokenMeta?.decimals_ ?? tokenMeta?.decimals ?? 18;
      const tokenSymbol = tokenMeta?.symbol_ ?? tokenMeta?.symbol ?? null;

      const next = {
        unitReward,
        REWARDSMinted: rewardsMinted,
        REWARDSCap: rewardsCap,
        remainingCap,
        totalDistributed,
        distributedThisWeek,
        currentWeek,
        lastRecordedWeek,
        lastWeekDistributed,
        blockWeights,
        tokenMeta,
        tokenDecimals,
        tokenSymbol,
      };

      setData(next);
      return next;
    } catch (err) {
      setError(err);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [provider, address]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
