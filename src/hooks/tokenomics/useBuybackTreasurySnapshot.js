import * as React from "react";
import { useWeb3 } from "@/providers/Web3Provider";
import { fetchBUYBACKTreasurySnapshot } from "@/shared/services/tokenomics/buybackTreasury.reader";
import { mapBUYBACKSnapshotToUI } from "@/shared/services/tokenomics/buybackTreasury.mappers";
import usePollingSnapshot from "./_usePollingSnapshot";

export default function useBUYBACKTreasurySnapshot(options = {}) {
  const { intervalMs = 20000 } = options;
  const { chainId, provider } = useWeb3();
  const isInjected = Boolean(provider?.provider);
  const readProvider = isInjected ? undefined : provider;

  const fetcher = React.useCallback(async () => {
    const raw = await fetchBUYBACKTreasurySnapshot({
      chainId,
      provider: readProvider,
    });
    if (!raw) return null;

    const adjusted = {
      ...raw,
      BUYBACK: {
        ...raw.BUYBACK,
        router: raw.addresses?.router || raw.BUYBACK?.router,
        lastBUYBACK:
          raw.BUYBACK?.lastBUYBACK ??
          (raw.BUYBACK?.lastBUYBACKLabel && raw.BUYBACK.lastBUYBACKLabel !== "--"
            ? raw.BUYBACK.lastBUYBACKLabel
            : null),
      },
      treasury: {
        ...raw.treasury,
        address: raw.treasury?.address || raw.addresses?.treasury,
      },
    };

    return mapBUYBACKSnapshotToUI(adjusted) || adjusted;
  }, [chainId, readProvider]);

  return usePollingSnapshot(fetcher, { intervalMs });
}
