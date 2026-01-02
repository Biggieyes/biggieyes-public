// useGallery.js
import * as React from "react";
import { getReadOnlyContract } from "../utils/contract";
import { useIPFS } from "./useIPFS";
import { useUtils } from "./useUtils";
import { readGalleryCache, saveGalleryCache } from "../services/gallery/gallery.cache";

export function useGallery() {
  const { readJsonFromURI, resolveImageUrl } = useIPFS();
  const { mapLimit, mergeAttrs, getCachedPriceAttrs } = useUtils();

  const [galleryLoading, setGalleryLoading] = React.useState(false);

  const queryLogsBatched = React.useCallback(async (contract, filter, fromBlock, toBlock, step = 2000) => {
    const out = [];
    let start = fromBlock;
    let batch = step;
    while (start <= toBlock) {
      const end = Math.min(start + batch - 1, toBlock);
      try {
        const part = await contract.queryFilter(filter, start, end);
        if (part?.length) out.push(...part);
        start = end + 1;
        batch = step;
      } catch (err) {
        console.debug("queryLogsBatched chunk failed", err);
        if (batch <= 1) throw err;
        batch = Math.max(1, Math.floor(batch / 2));
        continue;
      }
    }
    return out;
  }, []);

  const fetchMyTickets = React.useCallback(async (addr) => {
    try {
      const contract = getReadOnlyContract();
      let ids = [];
      try {
        if (typeof contract.findTicket === "function") {
          ids = await contract.findTicket(addr);
        } else {
          // fallback: scan logs (simplified)
          const latest = await contract.provider.getBlockNumber();
          const FROM = Math.max(0, latest - 50000);
          const toFilter = contract.filters.Transfer(null, addr, null);
          const logs = await queryLogsBatched(contract, toFilter, FROM, latest);
          ids = logs.map((l) => l.args?.tokenId).filter(Boolean);
        }
      } catch (err) {
        console.debug("fetchMyTickets ticket query failed", err);
      }
      const metas = await mapLimit(ids, 4, async (idBN) => {
        const id = idBN.toString();
        let meta = { name: `Ticket #${id}`, description: "Redeem this ticket to mint a BiggiEyes NFT." };
        let image = "/images/Biggi.png";
        try {
          const uri = await contract.tokenURI(idBN);
          const j = await readJsonFromURI(uri);
          if (j) {
            meta = j;
            const imgUrl = j?.image || j?.image_url;
            image = resolveImageUrl(imgUrl, uri) || image;
          }
        } catch (err) {
          console.debug("fetchMyTickets tokenURI read failed", err);
        }
        return { tokenId: id, image, meta, isTicket: true };
      });
      return metas;
    } catch (e) {
      console.error("fetchMyTickets", e);
      return [];
    }
  }, [mapLimit, readJsonFromURI, resolveImageUrl, queryLogsBatched]);

  const fetchOwnedNFTsViaTransfers = React.useCallback(
    async (addr) => {
      const cacheRecord = readGalleryCache(addr);
      try {
        setGalleryLoading(true);
        const contract = getReadOnlyContract();
        const latest = await contract.provider.getBlockNumber();
        const FROM = Math.max(0, latest - 50000);

        const toFilter = contract.filters.Transfer(null, addr, null);
        const fromFilter = contract.filters.Transfer(addr, null, null);
        const [toLogs, fromLogs] = await Promise.all([
          queryLogsBatched(contract, toFilter, FROM, latest),
          queryLogsBatched(contract, fromFilter, FROM, latest),
        ]);

        const all = [...toLogs, ...fromLogs].sort((a, b) => {
          if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
          return a.logIndex - b.logIndex;
        });

        const held = new Set();
        const me = String(addr || "").toLowerCase();
        for (const l of all) {
          const from = String(l.args?.from ?? l.args?.[0] ?? "").toLowerCase();
          const to = String(l.args?.to ?? l.args?.[1] ?? "").toLowerCase();
          const tokenId = (l.args?.tokenId ?? l.args?.[2])?.toString?.() || "";
          if (!tokenId) continue;
          if (to === me) held.add(tokenId);
          if (from === me) held.delete(tokenId);
        }

        const tokenIds = Array.from(held);
        const metas = await mapLimit(tokenIds, 4, async (tid) => {
          let isT = false;
          try {
            isT = typeof contract?.isTicket === "function" ? await contract.isTicket(tid) : false;
          } catch (err) {
            console.debug("fetchOwnedNFTsViaTransfers isTicket check failed", err);
          }
          if (isT) return null;

          let meta = {};
          let image = "/images/Biggi.png";
          try {
            const uri = await contract.tokenURI(tid);
            const j = await readJsonFromURI(uri);

            const cached = getCachedPriceAttrs(tid);
            const base = j || {};
            base.attributes = mergeAttrs(base.attributes, cached);
            // enrichMetaWithPrices je v app core -> zde vracíme base, enrichment může udělat volající
            meta = base;

            const imgUrl = j?.image || j?.image_url;
            image = resolveImageUrl(imgUrl, uri) || image;
          } catch (err) {
            console.debug("fetchOwnedNFTsViaTransfers tokenURI read failed", err);
          }
          return { tokenId: String(tid), image, meta, isTicket: false };
        });

        const finalList = metas.filter(Boolean);
        if (finalList.length) {
          saveGalleryCache(addr, finalList);
          return finalList;
        }
        if (cacheRecord?.items?.length) return cacheRecord.items;
        return [];
      } catch (e) {
        console.error("fetchOwnedNFTsViaTransfers", e);
        if (cacheRecord?.items?.length) return cacheRecord.items;
        return [];
      } finally {
        setGalleryLoading(false);
      }
    },
    [mapLimit, queryLogsBatched, readJsonFromURI, resolveImageUrl, getCachedPriceAttrs, mergeAttrs]
  );

  return {
    galleryLoading,
    fetchMyTickets,
    fetchOwnedNFTsViaTransfers,
    queryLogsBatched,
  };
}
