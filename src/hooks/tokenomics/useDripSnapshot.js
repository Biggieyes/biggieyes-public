import * as React from "react";
import { useWeb3 } from "@/providers/Web3Provider";
import { fetchDRIPSnapshot } from "@/shared/services/tokenomics/drip.reader";
import { mapDRIPSnapshotToUI } from "@/shared/services/tokenomics/drip.mappers";
import usePollingSnapshot from "./_usePollingSnapshot";

export default function useDRIPSnapshot(options = {}) {
  const { intervalMs = 20000 } = options;
  const { chainId, provider } = useWeb3();
  const isInjected = Boolean(provider?.provider);
  const readProvider = isInjected ? undefined : provider;

  const fetcher = React.useCallback(async () => {
    const raw = await fetchDRIPSnapshot({
      chainId,
      provider: readProvider,
    });
    if (!raw) return null;
    return mapDRIPSnapshotToUI(raw) || raw;
  }, [chainId, readProvider]);

  return usePollingSnapshot(fetcher, { intervalMs });
}
