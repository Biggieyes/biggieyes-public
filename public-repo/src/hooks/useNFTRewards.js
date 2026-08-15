import * as React from "react";
import { ADDR } from "@/shared/utils/addresses";
import { getROProvider } from "@/shared/utils/contract";
import NFTRewardsService from "@/shared/services/nftRewardsService.js";

const DEFAULT_SUMMARY = {
  baseURIs: { character: null, leaderboard: null, mystery: null },
  characterClaimed: {},
  leaderboardClaimed: {},
  mysteryClaimed: {},
  totalMinted: 0,
  contractAddress: ADDR.NFT_REWARDS,
};

export default function useNFTRewards(providerOverride, addressOverride) {
  const [data, setData] = React.useState(DEFAULT_SUMMARY);
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

  const address = addressOverride || ADDR.NFT_REWARDS;

  const refresh = React.useCallback(async () => {
    if (!provider || !address) {
      setData(DEFAULT_SUMMARY);
      return DEFAULT_SUMMARY;
    }
    setLoading(true);
    setError(null);
    try {
      const service = new NFTRewardsService(address, provider);
      const stats = await service.getAllStats();
      const next = {
        ...DEFAULT_SUMMARY,
        contractAddress: address,
        name: stats?.name ?? null,
        symbol: stats?.symbol ?? null,
        nextEventId: stats?.nextEventId ?? null,
        nextRewardId: stats?.nextRewardId ?? null,
        VRFRouter: stats?.VRFRouter ?? null,
        mainContract: stats?.mainContract ?? null,
        owner: stats?.owner ?? null,
      };
      setData(next);
      return next;
    } catch (err) {
      setError(err);
      setData(DEFAULT_SUMMARY);
      return DEFAULT_SUMMARY;
    } finally {
      setLoading(false);
    }
  }, [provider, address]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
