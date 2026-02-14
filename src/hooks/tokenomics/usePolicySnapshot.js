import * as React from "react";
import { useWeb3 } from "@/providers/Web3Provider";
import { fetchPolicySnapshot } from "@/shared/services/tokenomics/policy.reader";
import usePollingSnapshot from "./_usePollingSnapshot";

export default function usePolicySnapshot(options = {}) {
  const { intervalMs = 20000 } = options;
  const { chainId, provider } = useWeb3();
  const isInjected = Boolean(provider?.provider);
  const readProvider = isInjected ? undefined : provider;

  const fetcher = React.useCallback(
    () =>
      fetchPolicySnapshot({
        chainId,
        provider: readProvider,
      }),
    [chainId, readProvider],
  );

  return usePollingSnapshot(fetcher, { intervalMs });
}
