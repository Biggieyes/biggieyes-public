// src/hooks/useRewardsReader.js
import * as React from "react";
import { getBiggiRewardsReaderRO } from "../utils/contract"; // wrapper z utils/contract
import { canPoll, getPollInterval } from "../utils/polling";

const POLL_INTERVAL_MS = getPollInterval(20_000, "VITE_REWARDS_READER_POLL_MS");

function bnToNumber(bn) {
  if (bn == null) return 0;
  try {
    // BigNumber nebo běžný number/string
    if (bn?.toNumber) return bn.toNumber();
    return Number(bn?.toString ? bn.toString() : bn);
  } catch {
    try {
      return Number(String(bn));
    } catch {
      return 0;
    }
  }
}

export default function useRewardsReader(walletAddress) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const [collectionInfo, setCollectionInfo] = React.useState(null);
  const [orangeMainIds, setOrangeMainIds] = React.useState([]);
  const [blockWins, setBlockWins] = React.useState([]);
  const [hubStatus, setHubStatus] = React.useState(null);

  const [rewardTokenIds, setRewardTokenIds] = React.useState([]);
  const cursorRef = React.useRef(0);
  const [hasMorePages, setHasMorePages] = React.useState(true);
  const loadingPageRef = React.useRef(false);

  const readerRef = React.useRef(null);
  const mountedRef = React.useRef(true);
  const inFlightRef = React.useRef(false);

  // initialize reader once
  React.useEffect(() => {
    mountedRef.current = true;
    try {
      readerRef.current = getBiggiRewardsReaderRO();
    } catch (e) {
      console.warn("Inicializace rewards readeru selhala:", e?.message || e);
      readerRef.current = null;
      setError(e);
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // reset pagination when wallet changes (important)
  React.useEffect(() => {
    cursorRef.current = 0;
    setRewardTokenIds([]);
    setHasMorePages(true);
    loadingPageRef.current = false;
  }, [walletAddress]);

  React.useEffect(() => {
    if (!readerRef.current) return;
    let cancelled = false;

    async function loadAll() {
      if (cancelled || !readerRef.current) return;
      if (!canPoll() || inFlightRef.current) return;
      inFlightRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const reader = readerRef.current;

        // RewardsHub-style reader (aggregate/probe helpers)
        if (typeof reader?.getTokenRewardsStatus === "function") {
          const [
            tokenRewardsStatus,
            tokenRewardsAddr,
            collectionRewardsAddr,
            communityRewardsAddr,
            nftRewardsAddr,
            collectionDistributorAddr,
          ] = await Promise.all([
            reader.getTokenRewardsStatus(),
            typeof reader.tokenRewards === "function"
              ? reader.tokenRewards()
              : Promise.resolve(null),
            typeof reader.collectionRewards === "function"
              ? reader.collectionRewards()
              : Promise.resolve(null),
            typeof reader.communityRewards === "function"
              ? reader.communityRewards()
              : Promise.resolve(null),
            typeof reader.nftRewards === "function"
              ? reader.nftRewards()
              : Promise.resolve(null),
            typeof reader.collectionDistributor === "function"
              ? reader.collectionDistributor()
              : Promise.resolve(null),
          ]);

          const [
            collectionTotalPending,
            communityTotalPending,
            communityPendingForUser,
          ] = await Promise.all([
            collectionRewardsAddr &&
            typeof reader.getCollectionTotalPending === "function"
              ? reader.getCollectionTotalPending(collectionRewardsAddr)
              : Promise.resolve(null),
            typeof reader.getCommunityTotalPending === "function"
              ? reader.getCommunityTotalPending()
              : Promise.resolve(null),
            walletAddress && typeof reader.getCommunityPending === "function"
              ? reader.getCommunityPending(walletAddress)
              : Promise.resolve(null),
          ]);

          if (!cancelled && mountedRef.current) {
            setHubStatus({
              tokenRewardsStatus,
              tokenRewardsAddr,
              collectionRewardsAddr,
              communityRewardsAddr,
              nftRewardsAddr,
              collectionDistributorAddr,
              collectionTotalPending,
              communityTotalPending,
              communityPendingForUser,
            });
            // legacy outputs not supported by this reader
            setCollectionInfo(null);
            setOrangeMainIds([]);
            setBlockWins([]);
          }
          return;
        }

        if (!reader?.collectionRewardsInfo)
          throw new Error(
            "Rewards reader ABI mismatch (missing collectionRewardsInfo/getTokenRewardsStatus)",
          );
        if (!cancelled && mountedRef.current) setHubStatus(null);

        // collectionRewardsInfo()
        const coll = await readerRef.current.collectionRewardsInfo();
        // coll might be object or array
        const info = {
          orangeRewardAmt: bnToNumber(coll?.orangeRewardAmt ?? coll?.[0]),
          blockRewardAmt: bnToNumber(coll?.blockRewardAmt ?? coll?.[1]),
          rainbowRewardAmt: bnToNumber(coll?.rainbowRewardAmt ?? coll?.[2]),
          remainingOrange: bnToNumber(coll?.remainingOrange ?? coll?.[3]),
          remainingBlock: bnToNumber(coll?.remainingBlock ?? coll?.[4]),
          rainbowClaimed: Boolean(coll?.rainbowClaimed ?? coll?.[5]),
        };
        if (!cancelled && mountedRef.current) setCollectionInfo(info);

        // userCollectionLists(address)
        if (walletAddress) {
          try {
            const u =
              await readerRef.current.userCollectionLists(walletAddress);
            const orange = ((u?.orangeMainIds ?? u?.[0]) || []).map((bn) =>
              bnToNumber(bn),
            );
            const blocks = ((u?.blockWins ?? u?.[1]) || []).map((bn) =>
              bnToNumber(bn),
            );
            if (!cancelled && mountedRef.current) {
              setOrangeMainIds(orange);
              setBlockWins(blocks);
            }
          } catch (e) {
            // pokud volání selže, nastavíme prázdné hodnoty
            console.warn("userCollectionLists failed:", e?.message || e);
            if (!cancelled && mountedRef.current) {
              setOrangeMainIds([]);
              setBlockWins([]);
            }
          }
        } else {
          if (!cancelled && mountedRef.current) {
            setOrangeMainIds([]);
            setBlockWins([]);
          }
        }
      } catch (e) {
        console.error("loadAll rewardsReader error", e);
        if (!cancelled && mountedRef.current) setError(e);
      } finally {
        inFlightRef.current = false;
        if (!cancelled && mountedRef.current) setLoading(false);
      }
    }

    loadAll();
    const t = setInterval(loadAll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [walletAddress]);

  async function loadNextPage(pageSize = 50) {
    if (!readerRef.current || !walletAddress) return;
    if (typeof readerRef.current.rewardTokensByOwnerPaged !== "function")
      return;
    if (loadingPageRef.current) return;
    if (!hasMorePages) return;
    loadingPageRef.current = true;
    let cancelled = false;

    try {
      const res = await readerRef.current.rewardTokensByOwnerPaged(
        walletAddress,
        cursorRef.current,
        pageSize,
      );
      const ids = ((res?.ids ?? res?.[0]) || []).map((bn) => bnToNumber(bn));
      const newCursor = bnToNumber(res?.newCursor ?? res?.[1]);
      if (mountedRef.current && !cancelled) {
        setRewardTokenIds((prev) => [...prev, ...ids]);
        cursorRef.current = newCursor;
        if (ids.length < pageSize || newCursor === 0) setHasMorePages(false);
      }
    } catch (e) {
      console.error("loadNextPage error", e);
      if (mountedRef.current) setError(e);
    } finally {
      loadingPageRef.current = false;
    }

    return () => {
      cancelled = true;
    };
  }

  async function refreshRewardTokenIds() {
    cursorRef.current = 0;
    setRewardTokenIds([]);
    setHasMorePages(true);
    await loadNextPage();
  }

  async function getRewardTokenInfo(tokenId) {
    if (!readerRef.current)
      throw new Error("Rewards reader is not initialized");
    if (typeof readerRef.current.getRewardTokenInfo !== "function")
      throw new Error("getRewardTokenInfo is not supported by this reader");
    let cancelled = false;
    try {
      const r = await readerRef.current.getRewardTokenInfo(tokenId);
      const owner = r?.owner ?? r?.[0] ?? null;
      const uri = r?.uri ?? r?.[1] ?? "";
      if (!cancelled) return { owner, uri };
      return { owner: null, uri: "" };
    } catch (e) {
      console.error("getRewardTokenInfo failed", e);
      throw e;
    }
  }

  return {
    loading,
    error,
    collectionInfo,
    orangeMainIds,
    blockWins,
    hubStatus,
    rewardTokenIds,
    hasMorePages,
    loadNextPage,
    refreshRewardTokenIds,
    getRewardTokenInfo,
  };
}
