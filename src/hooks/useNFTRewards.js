// src/hooks/useNFTRewards.js
import * as React from "react";
import NFTRewardsService from "../services/nftRewardsService";
import { ADDR, getROProvider, getSignerProvider } from "../utils/contract";
import { getCached } from "../utils/fetchCache";

const DEFAULT_DATA = {
  baseURIs: { character: null, leaderboard: null, mystery: null },
  characterClaimed: {},
  leaderboardClaimed: {},
  mysteryClaimed: {},
  totalMinted: 0,
  contractAddress: ADDR.NFT_REWARDS,
};

export default function useNFTRewards(providerOverride = null) {
  const [data, setData] = React.useState(DEFAULT_DATA);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const provider = providerOverride || getROProvider();
      if (!provider) throw new Error("Read-only provider not available");

      const svc = new NFTRewardsService(ADDR.NFT_REWARDS, provider);
      const cacheKey = `nftRewards:${svc.address || ADDR.NFT_REWARDS || "unknown"}`;
      const snapshot = await getCached(
        cacheKey,
        async () => {
          const stats = await svc.getAllStats();
          const nextReward = Number(stats.nextRewardId?.toString?.() ?? stats.nextRewardId ?? 0);
          return {
            totalMinted: Number.isFinite(nextReward) ? nextReward : null,
            contractAddress: svc.address,
          };
        },
        { force: options?.force === true }
      );

      setData((prev) => ({
        ...prev,
        totalMinted: snapshot.totalMinted == null ? prev.totalMinted : snapshot.totalMinted,
        contractAddress: snapshot.contractAddress || prev.contractAddress,
      }));
    } catch (e) {
      console.error("useNFTRewards.refresh", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [providerOverride]);

  const claimReward = React.useCallback(async (rewardId, overrides = {}) => {
    setError(null);
    try {
      const provider = getSignerProvider();
      const svc = new NFTRewardsService(ADDR.NFT_REWARDS, provider);
      svc.connectWithSigner(provider.getSigner());
      return await svc.claim(rewardId, overrides);
    } catch (e) {
      console.error("useNFTRewards.claimReward", e);
      setError(e);
      throw e;
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh, claimReward };
}
