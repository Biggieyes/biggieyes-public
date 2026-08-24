import * as React from "react";
import { ADDR } from "@/shared/utils/addresses";
import { getROProvider } from "@/shared/utils/contract";
import CollectionRewardsService from "@/shared/services/collectionRewardsService.js";

export default function useCollectionRewards(
  walletAddress,
  providerOverride,
  addressOverride,
  collectionAddress,
) {
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

  const address = addressOverride || ADDR.COLLECTION_REWARDS;

  const refresh = React.useCallback(async () => {
    if (!provider || !address) {
      setData(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const service = new CollectionRewardsService(
        address,
        provider,
        collectionAddress,
      );
      const stats = await service.getAllStats(
        walletAddress || null,
        collectionAddress,
      );
      setData(stats);
      return stats;
    } catch (err) {
      setError(err);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [address, collectionAddress, provider, walletAddress]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
