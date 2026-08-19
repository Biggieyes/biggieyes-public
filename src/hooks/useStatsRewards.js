import * as React from "react";
import { formatEther } from "ethers";
import {
  getReadOnlyMain,
  getReadOnlyTicketHub,
  getReaderRO,
  getFrontendSnapshotLiteActive,
} from "@/shared/utils/contract";

const toNumEth = (value) => {
  try {
    if (value == null) return null;
    if (typeof value === "bigint") return Number(formatEther(value));
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && /^\d+$/.test(value))
      return Number(formatEther(BigInt(value)));
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};

const safeCall = async (fn, fallback = null) => {
  if (typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

const applySetter = (fn, value) => {
  if (typeof fn === "function") fn(value);
};

export function useStatsREWARDS(options = {}) {
  const {
    setTicketPrice,
    setTicketMinted,
    setBiggiMinted,
    setBlockPrices,
    setBlockMintCounts,
    setBackgroundMintCounts,
    setRewardPool,
    setMintVolumeMatic,
    walletAddress,
    myNFTs,
    setMyClaimable,
  } = options;

  const fetchStats = React.useCallback(async () => {
    // 1) Try reader snapshot
    try {
      const reader = getReaderRO?.();
      const snap = reader ? await getFrontendSnapshotLiteActive(reader) : null;
      if (snap) {
        const [
          ticketPriceWei,
          ticketMinted,
          biggiMinted,
          currentBlockPrices,
          blocksMinted,
          bgsMinted,
        ] = snap;

        applySetter(setTicketPrice, toNumEth(ticketPriceWei));
        applySetter(
          setTicketMinted,
          ticketMinted != null ? Number(ticketMinted) : null,
        );
        applySetter(
          setBiggiMinted,
          biggiMinted != null ? Number(biggiMinted) : null,
        );
        if (Array.isArray(currentBlockPrices)) {
          applySetter(
            setBlockPrices,
            currentBlockPrices.map((v) => toNumEth(v)),
          );
        }
        if (Array.isArray(blocksMinted)) {
          applySetter(
            setBlockMintCounts,
            blocksMinted.map((v) => (v != null ? Number(v) : null)),
          );
        }
        if (Array.isArray(bgsMinted)) {
          applySetter(
            setBackgroundMintCounts,
            bgsMinted.map((v) => (v != null ? Number(v) : null)),
          );
        }
        return snap;
      }
    } catch (err) {
      // reader snapshot failed, fall through to direct calls

      console.debug("useStatsREWARDS reader snapshot failed", err);
    }

    // 2) Fallback to direct contract calls
    try {
      const main = getReadOnlyMain();
      const ticketHub = getReadOnlyTicketHub();
      if (!main) return null;

      const priceWei = await safeCall(() =>
        ticketHub.getTicketPrice?.().catch(() => ticketHub.ticketPrice?.()),
      );
      applySetter(setTicketPrice, toNumEth(priceWei));

      const tm = await safeCall(() => ticketHub.ticketMinted?.(), null);
      const bm = await safeCall(() => main.biggiMinted?.(), null);
      applySetter(setTicketMinted, tm != null ? Number(tm) : null);
      applySetter(setBiggiMinted, bm != null ? Number(bm) : null);

      const blockRows = await Promise.all(
        Array.from({ length: 10 }, async (_, i) => {
          const blockId = i + 1;
          const [helperPrice, helperMinted] = await Promise.all([
            safeCall(() => main.getCurrentBlockPrice?.(blockId), null),
            typeof main.getBlockMintCount === "function"
              ? safeCall(() => main.getBlockMintCount(blockId), null)
              : Promise.resolve(null),
          ]);
          const info =
            helperPrice == null || helperMinted == null
              ? await safeCall(() => main.blockInfos?.(i), null)
              : null;
          const blockPrice =
            helperPrice ?? info?.currentPrice ?? info?.[2] ?? null;
          const blockMinted =
            helperMinted ??
            (typeof main.blockMintCounts === "function"
              ? await safeCall(() => main.blockMintCounts(i), null)
              : null) ??
            info?.mintCount ??
            info?.[3] ??
            null;
          return {
            price: blockPrice != null ? toNumEth(blockPrice) : null,
            minted: blockMinted != null ? Number(blockMinted) : null,
          };
        }),
      );

      const prices = blockRows.map((row) => row.price);
      const minted = blockRows.map((row) => row.minted);
      applySetter(setBlockPrices, prices);
      applySetter(setBlockMintCounts, minted);

      const bgReader =
        typeof main.backgroundMintCounts === "function"
          ? (i) => main.backgroundMintCounts(i)
          : typeof main.getBackgroundMintCount === "function"
            ? (i) => main.getBackgroundMintCount(i)
            : null;

      let bgCounts = Array(10).fill(null);
      if (bgReader) {
        let bgIndexBase = 0;
        const bgProbe0 = await safeCall(() => bgReader(0), null);
        if (bgProbe0 == null) {
          const bgProbe1 = await safeCall(() => bgReader(1), null);
          if (bgProbe1 != null) bgIndexBase = 1;
        }
        bgCounts = await Promise.all(
          Array.from({ length: 10 }, (_, i) =>
            safeCall(() => bgReader(i + bgIndexBase), null),
          ),
        );
      }
      const normalizedBgCounts = bgCounts.map((count) =>
        count != null ? Number(count) : null,
      );
      applySetter(setBackgroundMintCounts, normalizedBgCounts);

      // Optional stats (not required for COLLECTION grid)
      applySetter(setRewardPool, null);
      applySetter(setMintVolumeMatic, null);
      if (walletAddress && Array.isArray(myNFTs) && setMyClaimable) {
        applySetter(setMyClaimable, null);
      }

      return { prices, minted, bgCounts: normalizedBgCounts };
    } catch (err) {
      console.warn("useStatsREWARDS fallback failed", err);
      return null;
    }
  }, [
    setTicketPrice,
    setTicketMinted,
    setBiggiMinted,
    setBlockPrices,
    setBlockMintCounts,
    setBackgroundMintCounts,
    setRewardPool,
    setMintVolumeMatic,
    walletAddress,
    myNFTs,
    setMyClaimable,
  ]);

  return { fetchStats };
}
