// src/context/InventoryProvider.jsx
import * as React from "react";
import { useContracts } from "./ContractsProvider";
import { readJsonFromURI, resolveImageUrl } from "../services/ipfs";
import { mergeAttrs, getCachedPriceAttrs } from "../services/prices";
import {
  queryLogsBatched,
  getSafeDeployBlock,
  isFullHistoryEnabled,
} from "../shared/utils/shared";
import { getProviderForContract } from "../shared/utils/contract";

const Ctx = React.createContext(null);
const FULL_HISTORY = isFullHistoryEnabled();

// Helper to collect held tokenIds from Transfer logs
async function getHeldTokenIds(c, addr) {
  const addrLC = addr.toLowerCase();
  const provider = getProviderForContract(c);
  if (!provider || typeof provider.getBlockNumber !== "function")
    throw new Error("Provider not available");
  const latest = await provider.getBlockNumber();
  const baseFrom = await getSafeDeployBlock(provider);
  const fromBlock = FULL_HISTORY
    ? baseFrom
    : Math.max(baseFrom, latest - 120_000);

  const toFilter = c.filters?.Transfer(null, addr, null);
  const fromFilter = c.filters?.Transfer(addr, null, null);

  const [toLogs, fromLogs] = await Promise.all([
    queryLogsBatched(c, toFilter, fromBlock, latest),
    queryLogsBatched(c, fromFilter, fromBlock, latest),
  ]);

  const all = [...toLogs, ...fromLogs].sort((a, b) =>
    a.blockNumber !== b.blockNumber
      ? a.blockNumber - b.blockNumber
      : a.logIndex - b.logIndex,
  );

  const held = new Set();
  for (const l of all) {
    const from = (l.args?.from || l.args?.[0])?.toLowerCase?.();
    const to = (l.args?.to || l.args?.[1])?.toLowerCase?.();
    const tid = (l.args?.tokenId || l.args?.[2])?.toString?.();
    if (!tid) continue;
    if (to === addrLC) held.add(tid);
    if (from === addrLC) held.delete(tid);
  }

  return Array.from(held);
}

export function InventoryProvider({ children }) {
  const { ticketHubRead, biggiMainReaderRead, chapterCollectionsRead } =
    useContracts();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  // Fetch tickets
  const fetchMyTickets = React.useCallback(
    async (addr) => {
      const c = await ticketHubRead();
      let ids = [];
      try {
        const reader = biggiMainReaderRead?.();
        ids =
          reader && typeof reader.findTicket === "function"
            ? await reader.findTicket(addr)
            : await getHeldTokenIds(c, addr);
      } catch (e) {
        console.error("Error while searching for tickets:", e);
        ids = await getHeldTokenIds(c, addr);
      }

      const metas = await Promise.all(
        ids.map(async (idBN) => {
          const id = idBN.toString?.() ?? idBN.toString();
          let meta = { name: `Ticket #${id}`, description: "Redeem to mint." };
          let image = "/images/Biggi.png";
          try {
            const uri = await c.tokenURI(idBN);
            const j = await readJsonFromURI(uri);
            if (j) {
              meta = j;
              const imgUrl = j?.image || j?.image_url;
              const resolved = await resolveImageUrl(imgUrl, uri);
              image = resolved || image;
            }
          } catch (e) {
            console.error(`Error while loading ticket metadata ${id}:`, e);
          }
          return {
            tokenId: id,
            image,
            meta,
            isTicket: true,
            contractAddress: c?.target || c?.address || null,
          };
        }),
      );
      return metas.filter(Boolean);
    },
    [biggiMainReaderRead, ticketHubRead],
  );

  // Fetch other NFTs
  const fetchOwnedNFTs = React.useCallback(
    async (addr) => {
      const collections = chapterCollectionsRead();
      const perCollection = await Promise.all(
        collections.map(async (entry) => {
          const c = entry.contract;
          let ids = [];
          try {
            ids = await getHeldTokenIds(c, addr);
          } catch (e) {
            console.error(
              `Error while searching chapter ${entry.chapterId} ${entry.collectionType} NFTs:`,
              e,
            );
            return [];
          }

          return Promise.all(
            ids.map(async (tid) => {
              let meta = {};
              let image = "/images/Biggi.png";
              try {
                const uri = await c.tokenURI(tid);
                const j = await readJsonFromURI(uri);
                const cached = getCachedPriceAttrs(tid, entry.address);
                const base = j || {};
                base.attributes = mergeAttrs(cached, base.attributes);
                meta = base;
                const imgUrl = j?.image || j?.image_url;
                const resolved = await resolveImageUrl(imgUrl, uri);
                image = resolved || image;
              } catch (e) {
                console.error(
                  `Error while loading chapter ${entry.chapterId} NFT metadata ${tid}:`,
                  e,
                );
              }
              return {
                tokenId: String(tid),
                image,
                meta,
                isTicket: false,
                chapterId: entry.chapterId,
                collectionType: entry.collectionType,
                contractAddress: entry.address,
              };
            }),
          );
        }),
      );

      return perCollection.flat().filter(Boolean);
    },
    [chapterCollectionsRead],
  );

  // Refresh inventory
  const refresh = React.useCallback(
    async (addr) => {
      if (!addr) return;
      setLoading(true);
      try {
        const [tickets, nfts] = await Promise.all([
          fetchMyTickets(addr),
          fetchOwnedNFTs(addr),
        ]);
        const map = new Map();
        for (const item of [...tickets, ...nfts]) {
          const key = `${String(item.contractAddress || "").toLowerCase()}:${item.tokenId}`;
          map.set(key, item);
        }
        setItems(Array.from(map.values()));
      } catch (e) {
        console.error("Error while loading the inventory:", e);
      } finally {
        setLoading(false);
      }
    },
    [fetchMyTickets, fetchOwnedNFTs],
  );

  // Memoize context value
  const ctxValue = React.useMemo(
    () => ({ items, loading, refresh }),
    [items, loading, refresh],
  );

  return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>;
}

export const useInventory = () => {
  return React.useContext(Ctx);
};
