import * as React from "react";
import { formatEther } from "ethers";
import {
  getReadOnlyMain,
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
      const snap = reader
        ? await getFrontendSnapshotLiteActive(reader)
        : null;
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
      if (!main) return null;

      const priceWei = await safeCall(() =>
        main.getTicketPrice?.().catch(() => main.ticketPrice?.()),
      );
      applySetter(setTicketPrice, toNumEth(priceWei));

      const tm = await safeCall(() => main.ticketMinted?.(), null);
      const bm = await safeCall(() => main.biggiMinted?.(), null);
      applySetter(setTicketMinted, tm != null ? Number(tm) : null);
      applySetter(setBiggiMinted, bm != null ? Number(bm) : null);

      const prices = [];
      const minted = [];
      for (let i = 1; i <= 10; i++) {
        const info = await safeCall(() => main.blockInfos?.(i), null);
        const blockPrice =
          info?.currentPrice ??
          info?.[2] ??
          (await safeCall(() => main.getCurrentBlockPrice?.(i), null));
        const blockMinted =
          info?.mintCount ??
          info?.[3] ??
          (await safeCall(() => main.blockMintCounts?.(i), null)) ??
          (await safeCall(() => main.getBlockMintCount?.(i), null));
        prices.push(blockPrice != null ? toNumEth(blockPrice) : null);
        minted.push(blockMinted != null ? Number(blockMinted) : null);
      }
      applySetter(setBlockPrices, prices);
      applySetter(setBlockMintCounts, minted);

      const bgCounts = [];
      for (let j = 0; j < 10; j++) {
        const count = await safeCall(
          () => main.backgroundMintCounts?.(j),
          null,
        );
        bgCounts.push(count != null ? Number(count) : null);
      }
      applySetter(setBackgroundMintCounts, bgCounts);

      // Optional stats (not required for COLLECTION grid)
      applySetter(setRewardPool, null);
      applySetter(setMintVolumeMatic, null);
      if (walletAddress && Array.isArray(myNFTs) && setMyClaimable) {
        applySetter(setMyClaimable, null);
      }

      return { prices, minted, bgCounts };
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
