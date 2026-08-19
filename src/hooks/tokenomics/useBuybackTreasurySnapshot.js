import * as React from "react";
import { useWeb3 } from "@/providers/Web3Provider";
import { fetchBUYBACKTreasurySnapshot } from "@/shared/services/tokenomics/buybackTreasury.reader";
import { mapBUYBACKSnapshotToUI } from "@/shared/services/tokenomics/buybackTreasury.mappers";
import usePollingSnapshot from "./_usePollingSnapshot";

export default function useBUYBACKTreasurySnapshot(options = {}) {
  const { intervalMs = 20000, ...pollOptions } = options;
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
        DRIPLM:
          raw.BUYBACK?.DRIPLM ||
          raw.addresses?.dripLM ||
          raw.addresses?.DRIPLM ||
          null,
        router: raw.addresses?.router || raw.BUYBACK?.router,
        wrappedNative: raw.BUYBACK?.wrappedNative || raw.addresses?.weth || null,
        lastBUYBACK:
          raw.BUYBACK?.lastBUYBACK ??
          raw.BUYBACK?.lastBuybackAt ??
          (raw.BUYBACK?.lastBUYBACKLabel && raw.BUYBACK.lastBUYBACKLabel !== "--"
            ? raw.BUYBACK.lastBUYBACKLabel
            : null),
      },
      treasury: {
        ...raw.treasury,
        address: raw.treasury?.address || raw.addresses?.treasury,
        BUYBACKAgent:
          raw.treasury?.BUYBACKAgent ||
          raw.BUYBACK?.address ||
          raw.addresses?.buyback ||
          raw.addresses?.BUYBACK ||
          raw.addresses?.BUYBACK_AGENT ||
          null,
        reserve:
          raw.treasury?.reserve ||
          raw.addresses?.reserve ||
          raw.addresses?.RESERVE ||
          null,
        DRIPDistributor:
          raw.treasury?.DRIPDistributor ||
          raw.addresses?.DRIPDistributor ||
          raw.addresses?.DRIP_DISTRIBUTOR ||
          null,
        tokenREWARDS:
          raw.treasury?.tokenREWARDS ||
          raw.addresses?.tokenREWARDS ||
          raw.addresses?.TOKEN_REWARDS ||
          null,
      },
    };

    return mapBUYBACKSnapshotToUI(adjusted) || adjusted;
  }, [chainId, readProvider]);

  return usePollingSnapshot(fetcher, { intervalMs, ...pollOptions });
}
