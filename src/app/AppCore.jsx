import * as React from "react";
import { useTokenPanelLoader } from "../hooks/useTokenPanelLoader";
import { useContractListeners } from "../hooks/useContractListeners";

export default function AppCore({
  walletAddress,
  vrfPending,
  fetchStats,
  fetchRewards,
  fetchWalletAssets,
  refreshVRFPanel,
  checkVrfResolution,
  fetchLastMinted,
  fetchCountdownMeta,
  unsubRef,
  isTokenPanelOpen,
  onRefreshTokenMeta,
  onRefreshRouterInfo,
  onRefreshLiquidityPreview,
  onRefreshBuybackInfo,
  fetchReserveInfo,
  fetchTreasuryInfo,
  ZERO_ADDRESS,
  contractRef,
  getContract,
  setWalletAddress,
  setMyNFTs,
  setDynamicTraitsById,
  setVrfPending,
  setIsRedeeming,
  setRedeemMsg,
  setTopFirstId,
  setPendingTicketId,
  setRedeemStartBlock,
  setRedeemStartedAt,
  redeemStartedAt,
  enrichMetaWithPrices,
  readJsonFromURI,
  resolveImageUrl,
}) {
  useTokenPanelLoader({
    isTokenPanelOpen,
    onRefreshTokenMeta,
    onRefreshRouterInfo,
    onRefreshLiquidityPreview,
    onRefreshBuybackInfo,
    fetchReserveInfo,
    fetchTreasuryInfo,
  });

  const statsTimerRef = React.useRef(null);
  const rewardsTimerRef = React.useRef(null);

  const scheduleFetchStats = React.useCallback(
    (delay = 500) => {
      if (statsTimerRef.current) return;
      statsTimerRef.current = setTimeout(async () => {
        statsTimerRef.current = null;
        try {
          await fetchStats();
        } catch {}
      }, delay);
    },
    [fetchStats],
  );

  const scheduleFetchRewards = React.useCallback(
    (delay = 500) => {
      if (rewardsTimerRef.current) return;
      rewardsTimerRef.current = setTimeout(async () => {
        rewardsTimerRef.current = null;
        try {
          await fetchRewards();
        } catch {}
      }, delay);
    },
    [fetchRewards],
  );

  const attachEventListeners = useContractListeners({
    ZERO_ADDRESS,
    contractRef,
    getContract,
    setWalletAddress,
    setMyNFTs,
    setDynamicTraitsById,
    setVrfPending,
    setIsRedeeming,
    setRedeemMsg,
    setTopFirstId,
    setPendingTicketId,
    setRedeemStartBlock,
    setRedeemStartedAt,
    fetchStats,
    fetchRewards,
    fetchWalletAssets,
    fetchLastMinted,
    refreshVRFPanel,
    scheduleFetchStats,
    scheduleFetchRewards,
    enrichMetaWithPrices,
    readJsonFromURI,
    resolveImageUrl,
    unsubRef,
    walletAddress,
  });

  // Initial load sequence
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchStats();
        if (cancelled) return;
        await fetchRewards();
        if (cancelled) return;
        await fetchLastMinted();
        if (cancelled) return;
        await refreshVRFPanel();
        if (cancelled) return;
        await fetchCountdownMeta();
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [
    fetchStats,
    fetchRewards,
    fetchLastMinted,
    refreshVRFPanel,
    fetchCountdownMeta,
  ]);

  // VRF pending polling
  React.useEffect(() => {
    if (!vrfPending || !walletAddress) return;
    let cancelled = false;
    let timer = null;
    let pollCount = 0;

    const tick = async () => {
      if (cancelled) return;
      pollCount += 1;
      try {
        await fetchStats();
        await fetchRewards();
        await refreshVRFPanel();
        await checkVrfResolution();
        if (pollCount % 5 === 0) {
          await fetchWalletAssets(walletAddress);
        }
      } catch {}

      const elapsed = redeemStartedAt ? Date.now() - redeemStartedAt : 0;
      let nextDelay = 8000;
      if (elapsed && elapsed < 120000) nextDelay = 4000;
      else if (elapsed && elapsed < 600000) nextDelay = 8000;
      else if (elapsed) nextDelay = 15000;
      timer = setTimeout(tick, nextDelay);
    };

    timer = setTimeout(tick, 2000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    vrfPending,
    walletAddress,
    fetchStats,
    fetchRewards,
    fetchWalletAssets,
    refreshVRFPanel,
    checkVrfResolution,
    redeemStartedAt,
  ]);

  // Fetch assets when wallet changes
  React.useEffect(() => {
    if (walletAddress) fetchWalletAssets(walletAddress);
  }, [walletAddress, fetchWalletAssets]);

  // Attach contract/event listeners on wallet change
  React.useEffect(() => {
    if (walletAddress && typeof attachEventListeners === "function") {
      attachEventListeners(walletAddress);
    }
    return () => {
      unsubRef?.current?.();
    };
  }, [walletAddress, attachEventListeners, unsubRef]);

  // Cleanup timers and listeners on unmount
  React.useEffect(() => {
    return () => {
      if (statsTimerRef?.current) clearTimeout(statsTimerRef.current);
      if (rewardsTimerRef?.current) clearTimeout(rewardsTimerRef.current);
      unsubRef?.current?.();
    };
  }, [statsTimerRef, rewardsTimerRef, unsubRef]);

  return null;
}
