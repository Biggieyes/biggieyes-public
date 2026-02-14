/* @refresh reload */
// src/context/StatsProvider.jsx
import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress } from "ethers";
import { useContracts } from "./ContractsProvider";
import {
  resolveTicketPriceWeiFromHub,
  getFrontendSnapshotLiteActive,
} from "@/shared/utils/contract";

const Ctx = React.createContext(null);

export function StatsProvider({ children }) {
  const { mainRead, readerRead } = useContracts();

  const idxs = React.useMemo(
    () => Array.from({ length: 10 }, (_, i) => i + 1),
    [],
  );

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

      const [blockPricesWei, blocksMinted] = await Promise.all([
        Promise.all(
          idxs.map(async (i) => {
            const f = main.getCurrentBlockPrice || main.getCurrentBlockPriceWei;
            if (typeof f === "function") return f(i);
            return 0n;
          }),
        ).catch(() => Array(10).fill(0n)),
        Promise.all(
          idxs.map(async (i) => {
            const f = main.blockMintCounts || main.getBlockMintCount;
            if (typeof f === "function") {
              try {
                return f(i - 1);
              } catch {
                return f(i);
              }
            }
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
  }, [readerRead, mainRead, idxs]);

  return (
    <Ctx.Provider value={{ data, loading, refresh }}>{children}</Ctx.Provider>
  );
}

export function useStats() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useStats must be used inside <StatsProvider>");
  return v;
}

