import * as React from "react";

import usePollingSnapshot from "@/hooks/tokenomics/_usePollingSnapshot";
import {
  getFrontendSnapshotLiteActive,
  getReaderRO,
  getReserveTreasurySnapshotRO,
  getTokenREWARDSRO,
  getTokenRO,
} from "@/shared/utils/contract";
import { fetchLiquiditySnapshot } from "@/shared/services/tokenomics/liquidity.reader";
import { fetchDRIPSnapshot } from "@/shared/services/tokenomics/drip.reader";
import { useWeb3 } from "@/providers/Web3Provider";

const resolveTicketMinted = (snapshot) => {
  if (!snapshot) return null;
  if (Array.isArray(snapshot)) return snapshot[1] ?? null;
  return snapshot.ticketMinted ?? snapshot.ticketMinted_ ?? snapshot[1] ?? null;
};

export default function useTrustSnapshot(options = {}) {
  const { intervalMs = 15000, ...pollOptions } = options;
  const { chainId, provider } = useWeb3();
  const isInjected = Boolean(provider?.provider);
  const readProvider = isInjected ? undefined : provider;

  const fetcher = React.useCallback(async () => {
    const reader = getReaderRO(readProvider);
    let reserveReader = null;
    let token = null;
    let tokenREWARDS = null;
    try {
      reserveReader = getReserveTreasurySnapshotRO(readProvider);
    } catch {
      reserveReader = null;
    }
    try {
      token = getTokenRO(readProvider);
    } catch {
      token = null;
    }
    try {
      tokenREWARDS = getTokenREWARDSRO(readProvider);
    } catch {
      tokenREWARDS = null;
    }

    const [
      frontendSnap,
      reserveSnap,
      tokenSupply,
      rewardsMinted,
      liquiditySnap,
      dripSnap,
    ] = await Promise.all([
      getFrontendSnapshotLiteActive(reader).catch(() => null),
      reserveReader?.reserveSnapshot?.().catch(() => null),
      token?.totalSupply?.().catch(() => null),
      tokenREWARDS?.rewardsMinted?.().catch(() => null),
      fetchLiquiditySnapshot({ chainId, provider: readProvider }).catch(() => null),
      fetchDRIPSnapshot({ chainId, provider: readProvider }).catch(() => null),
    ]);

    const reserveNative = reserveSnap?.reservePol ?? reserveSnap?.[0] ?? null;
    const reserveBiggi = reserveSnap?.reserveBiggi ?? reserveSnap?.[1] ?? null;
    const lpVaultBalance =
      liquiditySnap?.vault?.totalLpLocked ??
      liquiditySnap?.vault?.vaultLpBalance ??
      null;
    const totalMintedTickets = resolveTicketMinted(frontendSnap);
    const dripAvailable =
      dripSnap?.distributor?.availableTokens ??
      dripSnap?.distributor?.getAvailable ??
      dripSnap?.distributor?.effectiveAvailable ??
      null;

    return {
      ts: Date.now(),
      reserveNative,
      reserveBiggi,
      lpVaultBalance,
      totalMintedTickets,
      tokenSupply,
      rewardsMinted,
      dripAvailable,
    };
  }, [chainId, readProvider]);

  return usePollingSnapshot(fetcher, { intervalMs, ...pollOptions });
}
