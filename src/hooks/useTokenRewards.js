// src/hooks/useTokenRewards.js
import * as React from "react";
import TokenRewardsService from "../services/tokenRewardsService";
import { ADDR, getROProvider } from "../utils/contract";
import { getCached } from "../utils/fetchCache";

const DEFAULT_DATA = {
  address: null,
  unitReward: "0",
  rewardsMinted: "0",
  rewardsCap: "0",
  remainingCap: "0",
  totalDistributed: "0",
  distributedThisWeek: "0",
  currentWeek: 0,
  lastRecordedWeek: 0,
  lastWeekDistributed: "0",
  blockWeights: [],
  tokenMeta: null,
  tokenSymbol: "BIGGI",
  tokenDecimals: 18,
  mainNFT: null,
  main2NFT: null,
  owner: null,
  paused: false,
  treasure: null,
};

export default function useTokenRewards(providerOverride = null) {
  const [data, setData] = React.useState(DEFAULT_DATA);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const provider = providerOverride || getROProvider();
      if (!provider) throw new Error("Read-only provider not available");

      const svc = new TokenRewardsService(ADDR.TOKEN_REWARDS, provider);
      const cacheKey = `tokenRewards:${svc.address || ADDR.TOKEN_REWARDS || "unknown"}`;
      const snapshot = await getCached(
        cacheKey,
        async () => {
          const raw = await svc.getAllStats();
          const formatted = await TokenRewardsService.formatUsingTokenMeta(raw);
          const meta = formatted?.tokenMeta || null;
          const tokenSymbol = meta?.symbol_ ?? meta?.symbol ?? "BIGGI";
          const rawDecimals = meta?.decimals_ ?? meta?.decimals ?? 18;
          const tokenDecimals = Number(rawDecimals?.toString?.() ?? rawDecimals ?? 18) || 18;

          return {
            ...DEFAULT_DATA,
            ...formatted,
            address: svc.address,
            tokenMeta: meta,
            tokenSymbol,
            tokenDecimals,
          };
        },
        { force: options?.force === true }
      );

      setData(snapshot);
    } catch (e) {
      console.error("useTokenRewards.refresh", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [providerOverride]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
