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
  const [state, setState] = React.useState(null);
  const requestId = React.useRef(0);
  const provider = React.useMemo(() => {
    if (providerOverride) return providerOverride;
    try {
      return getROProvider();
    } catch {
      return null;
    }
  }, [providerOverride]);
  const address = addressOverride || ADDR.COLLECTION_REWARDS;
  const context = React.useMemo(
    () => ({ provider, address, walletAddress, collectionAddress }),
    [provider, address, walletAddress, collectionAddress],
  );

  const refresh = React.useCallback(async () => {
    const id = ++requestId.current;
    if (!provider || !address) {
      setState({ context, data: null, loading: false, error: null });
      return null;
    }
    setState({ context, data: null, loading: true, error: null });
    try {
      const service = new CollectionRewardsService(
        address,
        provider,
        collectionAddress,
      );
      const data = await service.getAllStats(
        walletAddress || null,
        collectionAddress,
      );
      if (id !== requestId.current) return null;
      setState({ context, data, loading: false, error: null });
      return data;
    } catch (error) {
      if (id === requestId.current)
        setState({ context, data: null, loading: false, error });
      return null;
    }
  }, [address, collectionAddress, provider, walletAddress, context]);

  React.useEffect(() => {
    refresh();
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);
  const current = state?.context === context ? state : null;
  return {
    data: current?.data ?? null,
    loading: current?.loading ?? Boolean(provider && address),
    error: current?.error ?? null,
    refresh,
  };
}
