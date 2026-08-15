import * as React from "react";
import { useWeb3 } from "@/providers/Web3Provider";
import { fetchLiquiditySnapshot } from "@/shared/services/tokenomics/liquidity.reader";
import { mapRawSnapshotToUI } from "@/shared/services/tokenomics/liquidity.mappers";
import usePollingSnapshot from "./_usePollingSnapshot";

export default function useLiquiditySnapshot(options = {}) {
  const { intervalMs = 20000, ...pollOptions } = options;
  const { chainId, provider } = useWeb3();
  const isInjected = Boolean(provider?.provider);
  const readProvider = isInjected ? undefined : provider;

  const fetcher = React.useCallback(async () => {
    const raw = await fetchLiquiditySnapshot({
      chainId,
      provider: readProvider,
    });
    if (!raw) return null;
    const ui = mapRawSnapshotToUI(raw);
    if (!ui) return raw;
    return {
      ...ui,
      treasury: ui.treasury ?? raw.treasury,
      automation: ui.automation ?? raw.automation,
      keeperProxy: ui.keeperProxy ?? raw.keeperProxy,
      branchReader: ui.branchReader ?? raw.branchReader,
      vault: {
        ...ui.vault,
        pairWhitelisted:
          raw.vault?.pairWhitelisted ?? ui.vault?.pairWhitelisted,
      },
    };
  }, [chainId, readProvider]);

  return usePollingSnapshot(fetcher, { intervalMs, ...pollOptions });
}
