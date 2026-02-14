import * as React from "react";
import { useWeb3 } from "@/providers/Web3Provider";
import { fetchFlowSnapshot } from "@/shared/services/tokenomics/flow.reader";
import usePollingSnapshot from "./_usePollingSnapshot";

export default function useFlowSnapshot(options = {}) {
  const { intervalMs = 15000, ...pollOptions } = options;
  const { chainId, provider } = useWeb3();
  const isInjected = Boolean(provider?.provider);
  const readProvider = isInjected ? undefined : provider;

  const fetcher = React.useCallback(
    () =>
      fetchFlowSnapshot({
        chainId,
        provider: readProvider,
      }),
    [chainId, readProvider],
  );

  return usePollingSnapshot(fetcher, { intervalMs, ...pollOptions });
}
