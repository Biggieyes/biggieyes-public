import * as React from "react";
import { useWeb3 } from "@/providers/Web3Provider";
import { fetchDistributorSnapshot } from "@/shared/services/tokenomics/distributor.reader";
import { mapDistributorSnapshotToUI } from "@/shared/services/tokenomics/distributor.mappers";
import usePollingSnapshot from "./_usePollingSnapshot";

export default function useDistributorSnapshot(options = {}) {
  const { intervalMs = 20000, ...pollOptions } = options;
  const { chainId, provider } = useWeb3();
  const isInjected = Boolean(provider?.provider);
  const readProvider = isInjected ? undefined : provider;

  const fetcher = React.useCallback(async () => {
    const raw = await fetchDistributorSnapshot({
      chainId,
      provider: readProvider,
    });
    if (!raw) return null;
    return mapDistributorSnapshotToUI(raw) || raw;
  }, [chainId, readProvider]);

  return usePollingSnapshot(fetcher, { intervalMs, ...pollOptions });
}
