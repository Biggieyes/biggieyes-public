// src/context/InventoryProvider.jsx
import * as React from "react";
import { ethers } from "ethers";
import { useContracts } from "./ContractsProvider";
import { readJsonFromURI, resolveImageUrl } from "../services/ipfs";
import { mergeAttrs, getCachedPriceAttrs } from "../services/prices";

const Ctx = React.createContext(null);
const DEPLOY_BLOCK = 27105502;

// Helper to collect held tokenIds from Transfer logs
async function getHeldTokenIds(c, addr) {
  const addrLC = addr.toLowerCase();
  const latest = await c.provider.getBlockNumber();

  const toFilter = c.filters?.Transfer(null, addr, null);
  const fromFilter = c.filters?.Transfer(addr, null, null);

  const [toLogs, fromLogs] = await Promise.all([
    c.queryFilter(toFilter, DEPLOY_BLOCK, latest),
    c.queryFilter(fromFilter, DEPLOY_BLOCK, latest),
  ]);

  const all = [...toLogs, ...fromLogs].sort((a, b) =>
    a.blockNumber !== b.blockNumber ? a.blockNumber - b.blockNumber : a.logIndex - b.logIndex
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
  const { mainRO } = useContracts();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  // Fetch tickets
  const fetchMyTickets = React.useCallback(
    async (addr) => {
      const c = await mainRO();
      let ids = [];
      try {
        if (typeof c.findTicket === "function") {
          ids = await c.findTicket(addr);
        } else {
          ids = await getHeldTokenIds(c, addr);
        }
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
          let isT = false;
          try {
            isT = await c.isTicket(idBN);
          } catch {}
          if (!isT) return null;
          return { tokenId: id, image, meta, isTicket: true };
        })
      );
      return metas.filter(Boolean);
    },
    [mainRO]
  );

  // Fetch other NFTs
  const fetchOwnedNFTs = React.useCallback(
    async (addr) => {
      const c = await mainRO();
      let ids = [];
      try {
        ids = await getHeldTokenIds(c, addr);
      } catch (e) {
        console.error("Error while searching for NFTs:", e);
        return [];
      }

      const metas = await Promise.all(
        ids.map(async (tid) => {
          let isT = false;
          try {
            isT = await c.isTicket(tid);
          } catch {}
          if (isT) return null;

          let meta = {};
          let image = "/images/Biggi.png";
          try {
            const uri = await c.tokenURI(tid);
            const j = await readJsonFromURI(uri);
            const cached = getCachedPriceAttrs(tid);
            const base = j || {};
            base.attributes = mergeAttrs(base.attributes, cached);
            meta = base;
            const imgUrl = j?.image || j?.image_url;
            const resolved = await resolveImageUrl(imgUrl, uri);
            image = resolved || image;
          } catch (e) {
            console.error(`Error while loading NFT metadata ${tid}:`, e);
          }
          return { tokenId: String(tid), image, meta, isTicket: false };
        })
      );

      return metas.filter(Boolean);
    },
    [mainRO]
  );

  // Refresh inventory
  const refresh = React.useCallback(
    async (addr) => {
      if (!addr) return;
      setLoading(true);
      try {
        const [tickets, nfts] = await Promise.all([fetchMyTickets(addr), fetchOwnedNFTs(addr)]);
        const map = new Map();
        for (const t of tickets) map.set(t.tokenId, t);
        for (const n of nfts) map.set(n.tokenId, n);
        setItems(Array.from(map.values()));
      } catch (e) {
        console.error("Error while loading the inventory:", e);
      } finally {
        setLoading(false);
      }
    },
    [fetchMyTickets, fetchOwnedNFTs]
  );

  // Memoize context value
  const ctxValue = React.useMemo(() => ({ items, loading, refresh }), [items, loading, refresh]);

  return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>;
}

export const useInventory = () => {
  return React.useContext(Ctx);
};
