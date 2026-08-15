/* @refresh reload */
// src/context/StatsProvider.jsx
import * as React from "react";
import { formatEther } from "ethers";
import { useContracts } from "./ContractsProvider";
import {
  resolveTicketPriceWeiFromHub,
  getFrontendSnapshotLiteActive,
} from "@/shared/utils/contract";

const Ctx = React.createContext(null);

export function StatsProvider({ children }) {
  const { mainRead, readerRead } = useContracts();

  const rowIdxs = React.useMemo(() => Array.from({ length: 10 }, (_, i) => i), []);

  const [data, setData] = React.useState({
    ticketPrice: null, // number (POL)
    biggiMinted: 0, // number
    ticketMinted: 0, // number
    blockMintCounts: Array(10).fill(0),
    blockPrices: Array(10).fill(0),
    bgsMinted: Array(10).fill(0),
    charactersMinted: 0,
  });
  const [loading, setLoading] = React.useState(false);

  const detectBlockIndexBase = React.useCallback(async (main) => {
    if (!main) return 1;
    const silent = async (fn) => {
      try {
        return await fn();
      } catch {
        return null;
      }
    };

    const probes = [];
    if (typeof main.getCurrentBlockPrice === "function") {
      probes.push((i) => main.getCurrentBlockPrice(i));
    } else if (typeof main.getCurrentBlockPriceWei === "function") {
      probes.push((i) => main.getCurrentBlockPriceWei(i));
    }
    if (typeof main.blockInfos === "function") {
      probes.push((i) => main.blockInfos(i));
    }
    if (typeof main.getBlockMintCount === "function") {
      probes.push((i) => main.getBlockMintCount(i));
    } else if (typeof main.blockMintCounts === "function") {
      probes.push((i) => main.blockMintCounts(i));
    }

    let scoreBase0 = 0;
    let scoreBase1 = 0;

    for (const probe of probes) {
      const [at0, at9, at1, at10] = await Promise.all([
        silent(() => probe(0)),
        silent(() => probe(9)),
        silent(() => probe(1)),
        silent(() => probe(10)),
      ]);

      if (at0 != null && at9 != null) scoreBase0 += 1;
      if (at1 != null && at10 != null) scoreBase1 += 1;
    }

    if (scoreBase0 > scoreBase1) return 0;
    return 1;
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const reader = readerRead?.();
      if (reader) {
        try {
          // Primary path through Reader
          const snap = await getFrontendSnapshotLiteActive(reader);
          const ticketPriceWei = snap?.[0] ?? 0n;
          const ticketMintedBN = snap?.[1] ?? 0;
          const biggiMintedBN = snap?.[2] ?? 0;
          const blockPricesWeiArr = snap?.[3] ?? [];
          const blocksMintedArr = snap?.[4] ?? [];
          const bgsMintedArr = snap?.[5] ?? [];
          const charactersMintedBN = snap?.[6] ?? 0;

          setData({
            ticketPrice: Number(formatEther(ticketPriceWei)),
            biggiMinted: Number(biggiMintedBN),
            ticketMinted: Number(ticketMintedBN),
            blockMintCounts: Array.from(blocksMintedArr).map((x) => Number(x)),
            blockPrices: Array.from(blockPricesWeiArr).map((x) =>
              Number(formatEther(x)),
            ),
            bgsMinted: Array.from(bgsMintedArr).map((x) => Number(x)),
            charactersMinted: Number(charactersMintedBN),
          });
          return;
        } catch (err) {
          console.debug("StatsProvider.refresh reader snapshot failed", err);
        }
      }

      // Fallback via MAIN + helper for ticketPrice
      const main = mainRead?.();
      if (!main) throw new Error("Main contract unavailable");

      const [ticketPriceWei, biggiMintedBN, ticketMintedBN] = await Promise.all(
        [
          resolveTicketPriceWeiFromHub().catch(async () => {
            if (typeof main.ticketPrice === "function")
              return main.ticketPrice();
            return 0n;
          }),
          typeof main.biggiMinted === "function"
            ? main.biggiMinted().catch(() => 0)
            : Promise.resolve(0),
          typeof main.ticketMinted === "function"
            ? main.ticketMinted().catch(() => 0)
            : Promise.resolve(0),
        ],
      );

      const blockIndexBase = await detectBlockIndexBase(main);
      const readBlockIndex = (rowIdx) => rowIdx + blockIndexBase;

      const [blockPricesWei, blocksMinted] = await Promise.all([
        Promise.all(
          rowIdxs.map(async (rowIdx) => {
            const f = main.getCurrentBlockPrice || main.getCurrentBlockPriceWei;
            if (typeof f === "function") return f(readBlockIndex(rowIdx));
            return 0n;
          }),
        ).catch(() => Array(10).fill(0n)),
        Promise.all(
          rowIdxs.map(async (rowIdx) => {
            const f = main.getBlockMintCount || main.blockMintCounts;
            if (typeof f === "function") return f(readBlockIndex(rowIdx));
            return 0;
          }),
        ).catch(() => Array(10).fill(0)),
      ]);

      setData({
        ticketPrice: Number(formatEther(ticketPriceWei)),
        biggiMinted: Number(biggiMintedBN),
        ticketMinted: Number(ticketMintedBN),
        blockMintCounts: blocksMinted.map((x) => Number(x)),
        blockPrices: blockPricesWei.map((x) =>
          Number(formatEther(x)),
        ),
        bgsMinted: Array(10).fill(0),
        charactersMinted: 0,
      });
    } catch (e) {
      console.error("StatsProvider.refresh", e);
    } finally {
      setLoading(false);
    }
  }, [readerRead, mainRead, rowIdxs, detectBlockIndexBase]);

  return (
    <Ctx.Provider value={{ data, loading, refresh }}>{children}</Ctx.Provider>
  );
}

export function useStats() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useStats must be used inside <StatsProvider>");
  return v;
}
