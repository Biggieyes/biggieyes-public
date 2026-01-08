// src/HOOKS/useREWARDSReader.js
import * as React from "react";
import { getBiggiREWARDSReaderRO } from "../utils/contract"; // wrapper z utils/contract
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

export default function useREWARDSReader(walletAddress) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const [COLLECTIONInfo, setCOLLECTIONInfo] = React.useState(null);
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
      readerRef.current = getBiggiREWARDSReaderRO();
    } catch (e) {
      console.warn("Inicializace REWARDS readeru selhala:", e?.message || e);
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

        // REWARDSHub-style reader (aggregate/probe helpers)
        if (typeof reader?.getTokenREWARDSStatus === "function") {
          const [
            tokenREWARDSStatus,
            tokenREWARDSAddr,
            COLLECTIONREWARDSAddr,
            communityREWARDSAddr,
            nftREWARDSAddr,
            COLLECTIONDistributorAddr,
          ] = await Promise.all([
            reader.getTokenREWARDSStatus(),
            typeof reader.tokenREWARDS === "function"
              ? reader.tokenREWARDS()
              : Promise.resolve(null),
            typeof reader.COLLECTIONREWARDS === "function"
              ? reader.COLLECTIONREWARDS()
              : Promise.resolve(null),
            typeof reader.communityREWARDS === "function"
              ? reader.communityREWARDS()
              : Promise.resolve(null),
            typeof reader.nftREWARDS === "function"
              ? reader.nftREWARDS()
              : Promise.resolve(null),
            typeof reader.COLLECTIONDistributor === "function"
              ? reader.COLLECTIONDistributor()
              : Promise.resolve(null),
          ]);

          const [
            COLLECTIONTotalPending,
            communityTotalPending,
            communityPendingForUser,
          ] = await Promise.all([
            COLLECTIONREWARDSAddr &&
            typeof reader.getCOLLECTIONTotalPending === "function"
              ? reader.getCOLLECTIONTotalPending(COLLECTIONREWARDSAddr)
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
              tokenREWARDSStatus,
              tokenREWARDSAddr,
              COLLECTIONREWARDSAddr,
              communityREWARDSAddr,
              nftREWARDSAddr,
              COLLECTIONDistributorAddr,
              COLLECTIONTotalPending,
              communityTotalPending,
              communityPendingForUser,
            });
            // legacy outputs not supported by this reader
            setCOLLECTIONInfo(null);
            setOrangeMainIds([]);
            setBlockWins([]);
          }
          return;
        }

        if (!reader?.COLLECTIONREWARDSInfo)
          throw new Error(
            "REWARDS reader ABI mismatch (missing COLLECTIONREWARDSInfo/getTokenREWARDSStatus)",
          );
        if (!cancelled && mountedRef.current) setHubStatus(null);

        // COLLECTIONREWARDSInfo()
        const coll = await readerRef.current.COLLECTIONREWARDSInfo();
        // coll might be object or array
        const info = {
          orangeRewardAmt: bnToNumber(coll?.orangeRewardAmt ?? coll?.[0]),
          blockRewardAmt: bnToNumber(coll?.blockRewardAmt ?? coll?.[1]),
          rainbowRewardAmt: bnToNumber(coll?.rainbowRewardAmt ?? coll?.[2]),
          remainingOrange: bnToNumber(coll?.remainingOrange ?? coll?.[3]),
          remainingBlock: bnToNumber(coll?.remainingBlock ?? coll?.[4]),
          rainbowClaimed: Boolean(coll?.rainbowClaimed ?? coll?.[5]),
        };
        if (!cancelled && mountedRef.current) setCOLLECTIONInfo(info);

        // userCOLLECTIONLists(address)
        if (walletAddress) {
          try {
            const u =
              await readerRef.current.userCOLLECTIONLists(walletAddress);
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
            console.warn("userCOLLECTIONLists failed:", e?.message || e);
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
        console.error("loadAll REWARDSReader error", e);
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
      throw new Error("REWARDS reader is not initialized");
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
    COLLECTIONInfo,
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




