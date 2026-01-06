import * as React from "react";
import { ethers } from "ethers";
import { getReadOnlyMain as getReadOnlyContract } from "../utils/contract";
import { ADDR } from "../utils/addresses";
import {
  loadWalletCache,
  saveWalletCache,
  getSafeDeployBlock,
  queryLogsBatched,
  mapLimit,
  BACKGROUND_NAMES,
  BACKGROUND_BONUSES,
} from "../utils/shared";
import { readJsonFromURI, resolveImageUrl } from "../utils/ipfs";
import {
  mergeAttrs,
  getCachedPriceAttrs,
  canonBackgroundName,
  backgroundIndexFromAny,
} from "../utils/metadata";
import {
  readGalleryCache,
  saveGalleryCache,
} from "../services/gallery/gallery.cache";
import { mergeGalleryLists } from "../services/gallery/gallery.merge";

const TOKEN_URI_CACHE_LIMIT = 800;
const tokenUriCache = new Map();

function cacheSet(map, key, value, limit) {
  if (!key) return;
  if (!map.has(key) && map.size >= limit) {
    const firstKey = map.keys().next().value;
    if (firstKey != null) map.delete(firstKey);
  }
  map.set(key, value);
}

async function getTokenUriCached(contract, tokenId) {
  const key = String(tokenId);
  if (tokenUriCache.has(key)) return tokenUriCache.get(key);
  const uri = await contract.tokenURI(tokenId);
  cacheSet(tokenUriCache, key, uri, TOKEN_URI_CACHE_LIMIT);
  return uri;
}

export function useWalletAssets(params) {
  const {
    setMyNFTs,
    setGalleryLoading,
    setGalleryNotice,
    setLastMinted,
    setDynamicTraitsById,
    vrfPending,
    topFirstId,
    pendingTicketId,
    redeemStartBlock,
    redeemStartedAt,
    enrichMetaWithPrices,
  } = params;
  const walletFetchRef = React.useRef({ inFlight: null, addr: null });
  const findTicketsViaLogs = React.useCallback(async (contract, addr) => {
    const latest = await contract.provider.getBlockNumber();
    const FROM = await getSafeDeployBlock(contract.provider);

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
    const onlyTickets = [];
    for (const tid of tokenIds) {
      try {
        const isT =
          typeof contract?.isTicket === "function"
            ? await contract.isTicket(tid)
            : false;
        if (isT) onlyTickets.push(ethers.BigNumber.from(tid));
      } catch (err) {
        console.debug("findTicketsViaLogs isTicket check failed", err);
      }
    }
    return onlyTickets;
  }, []);

  const fetchMyTickets = React.useCallback(
    async (addr) => {
      try {
        const contract = getReadOnlyContract();

        let ids = [];
        try {
          if (typeof contract.findTicket === "function") {
            ids = await contract.findTicket(addr);
          } else {
            ids = await findTicketsViaLogs(contract, addr);
          }
        } catch (err) {
          console.debug("fetchMyTickets findTicket fallback triggered", err);
          ids = await findTicketsViaLogs(contract, addr);
        }

        const metas = await mapLimit(ids, 4, async (idBN) => {
          const id = idBN.toString();
          let meta = {
            name: `Ticket #${id}`,
            description: "Redeem this ticket to mint a BiggiEyes NFT.",
          };
          let image = "/images/Biggi.png";
          try {
            const uri = await getTokenUriCached(contract, idBN);
            const j = await readJsonFromURI(uri);
            if (j) {
              meta = j;
              const imgUrl = j?.image || j?.image_url;
              image = resolveImageUrl(imgUrl, uri) || image;
            }
          } catch (err) {
            console.debug("fetchMyTickets tokenURI failed", err);
          }
          return { tokenId: id, image, meta, isTicket: true };
        });

        return metas;
      } catch (e) {
        console.error("fetchMyTickets", e);
        return [];
      }
    },
    [findTicketsViaLogs],
  );

  const fetchOwnedNFTsViaOwnerScan = React.useCallback(
    async (addr) => {
      try {
        const contract = getReadOnlyContract();
        const cacheAddr = contract?.address || ADDR.MAIN;
        const cached = loadWalletCache(addr, { allowExpired: true }, cacheAddr);
        if (cached?.length) return cached;

        const lower = String(addr || "").toLowerCase();
        let totalMinted = 0;
        try {
          if (typeof contract.biggiMinted === "function") {
            totalMinted = Number((await contract.biggiMinted()).toString());
          } else if (typeof contract.totalSupply === "function") {
            totalMinted = Number((await contract.totalSupply()).toString());
          }
        } catch (err) {
          console.debug(
            "fetchOwnedNFTsViaOwnerScan total supply lookup failed",
            err,
          );
        }
        if (!totalMinted || totalMinted <= 0) return [];

        const indices = Array.from(
          { length: totalMinted },
          (_, idx) => idx + 1,
        );
        const owned = await mapLimit(indices, 2, async (tokenId) => {
          try {
            const owner = await contract.ownerOf(tokenId);
            if (!owner || owner.toLowerCase() !== lower) return null;

            let isTicket = false;
            try {
              isTicket =
                typeof contract.isTicket === "function"
                  ? await contract.isTicket(tokenId)
                  : false;
            } catch (err) {
              console.debug(
                "fetchOwnedNFTsViaOwnerScan owner scan isTicket failed",
                err,
              );
            }
            if (isTicket) return null;

            let meta = {};
            let image = "/images/Biggi.png";
            try {
              const uri = await getTokenUriCached(contract, tokenId);
              const j = await readJsonFromURI(uri);
              const cached = getCachedPriceAttrs(tokenId);
              const base = j || {};
              base.attributes = mergeAttrs(base.attributes, cached);
              meta = await enrichMetaWithPrices(contract, tokenId, base);
              const imgUrl = j?.image || j?.image_url;
              image = resolveImageUrl(imgUrl, uri) || image;
            } catch (err) {
              console.debug(
                "fetchOwnedNFTsViaOwnerScan owner tokenURI failed",
                err,
              );
            }

            return { tokenId: String(tokenId), image, meta, isTicket: false };
          } catch (err) {
            console.debug("fetchOwnedNFTsViaOwnerScan worker failed", err);
            return null;
          }
        });

        const filtered = owned.filter(Boolean);
        saveWalletCache(addr, filtered, cacheAddr);
        return filtered;
      } catch (err) {
        console.error("fetchOwnedNFTsViaOwnerScan", err);
        return [];
      }
    },
    [enrichMetaWithPrices],
  );

  const fetchOwnedNFTsViaTransfers = React.useCallback(
    async (addr, ticketCount = 0) => {
      try {
        const contract = getReadOnlyContract();
        const cacheAddr = contract?.address || ADDR.MAIN;
        const latest = await contract.provider.getBlockNumber();
        const FROM = await getSafeDeployBlock(contract.provider);

        const toFilter = contract.filters.Transfer(null, addr, null);
        const fromFilter = contract.filters.Transfer(addr, null, null);
        const [toLogs, fromLogs] = await Promise.all([
          queryLogsBatched(contract, toFilter, FROM, latest),
          queryLogsBatched(contract, fromFilter, FROM, latest),
        ]);

        const all = [...toLogs, ...fromLogs].sort((a, b) => {
          if (a.blockNumber !== b.blockNumber)
            return a.blockNumber - b.blockNumber;
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
            isT =
              typeof contract?.isTicket === "function"
                ? await contract.isTicket(tid)
                : false;
          } catch (err) {
            console.debug(
              "fetchOwnedNFTsViaTransfers ticket check failed",
              err,
            );
          }
          if (isT) return null;

          let meta = {};
          let image = "/images/Biggi.png";
          try {
            const uri = await getTokenUriCached(contract, tid);
            const j = await readJsonFromURI(uri);

            const cached = getCachedPriceAttrs(tid);
            const base = j || {};
            base.attributes = mergeAttrs(base.attributes, cached);
            meta = await enrichMetaWithPrices(contract, tid, base);

            const imgUrl = j?.image || j?.image_url;
            image = resolveImageUrl(imgUrl, uri) || image;
          } catch (err) {
            console.debug(
              "fetchOwnedNFTsViaTransfers token metadata failed",
              err,
            );
          }
          return { tokenId: String(tid), image, meta, isTicket: false };
        });

        const resolved = metas.filter(Boolean);

        try {
          if (typeof contract.balanceOf === "function") {
            const balRaw = await contract.balanceOf(addr);
            const expectedTotal = Number(balRaw?.toString?.() || balRaw || 0);
            const expected = Number.isFinite(expectedTotal)
              ? Math.max(0, expectedTotal - Number(ticketCount || 0))
              : null;
            if (Number.isFinite(expected) && expected > resolved.length) {
              const fallback = await fetchOwnedNFTsViaOwnerScan(addr);
              if (fallback.length >= resolved.length) return fallback;
            }
          }
        } catch (err) {
          console.debug(
            "fetchOwnedNFTsViaTransfers balance fallback failed",
            err,
          );
        }

        saveWalletCache(addr, resolved, cacheAddr);
        return resolved;
      } catch (e) {
        console.error("fetchOwnedNFTsViaTransfers", e);
        return fetchOwnedNFTsViaOwnerScan(addr);
      }
    },
    [fetchOwnedNFTsViaOwnerScan, enrichMetaWithPrices],
  );

  const orderWithTopFirst = React.useCallback(
    (finalList, prev) => {
      const pending = prev.find((x) => x.isPending);
      if (vrfPending && pending) {
        const dedup = finalList.filter(
          (x) => !x.isPending && x.tokenId !== pending.tokenId,
        );
        return [pending, ...dedup];
      }
      if (topFirstId) {
        const top = finalList.find((x) => x.tokenId === topFirstId);
        const rest = finalList.filter((x) => x.tokenId !== topFirstId);
        return top ? [top, ...rest] : finalList;
      }
      return finalList;
    },
    [vrfPending, topFirstId],
  );

  const mergeWithTopFirst = React.useCallback(
    (finalList) => {
      return setMyNFTs((prev) => orderWithTopFirst(finalList, prev));
    },
    [orderWithTopFirst, setMyNFTs],
  );

  const primeFromCache = React.useCallback(
    (cachedItems) => {
      if (!cachedItems?.length) return;
      setMyNFTs((prev) => {
        if (prev?.length) return prev;
        return orderWithTopFirst(cachedItems, prev);
      });
    },
    [orderWithTopFirst, setMyNFTs],
  );

  const fetchWalletAssets = React.useCallback(
    async (addr) => {
      if (!addr) return [];
      const cacheContract = getReadOnlyContract();
      const cacheAddr = cacheContract?.address || ADDR.MAIN;
      if (
        walletFetchRef.current.inFlight &&
        walletFetchRef.current.addr === addr
      ) {
        return walletFetchRef.current.inFlight;
      }

      const cachedRecord = readGalleryCache(addr, cacheAddr);
      const cachedItemsRaw = cachedRecord?.items || [];
      const cachedItems = pendingTicketId
        ? cachedItemsRaw.filter(
            (item) =>
              String(item?.tokenId ?? item?.id ?? "") !==
              String(pendingTicketId),
          )
        : cachedItemsRaw;
      const hasCached = cachedItems.length > 0;
      let usedCacheFallback = false;

      if (hasCached) {
        primeFromCache(cachedItems);
      }

      const showSpinner = !hasCached;
      const exec = (async () => {
        if (showSpinner) setGalleryLoading(true);
        try {
          const tickets = await fetchMyTickets(addr);
          const nfts = await fetchOwnedNFTsViaTransfers(addr, tickets.length);
          const ticketIdSet = new Set(
            tickets.map((t) => String(t?.tokenId ?? "")),
          );
          const byId = new Map();
          for (const t of tickets) byId.set(t.tokenId, t);
          for (const n of nfts) byId.set(n.tokenId, n);
          const final = Array.from(byId.values());
          let merged = final;
          if (hasCached) {
            let onChainCount = null;
            try {
              const contract = getReadOnlyContract();
              const balRaw = await contract.balanceOf(addr);
              const parsed = Number(balRaw?.toString?.() || balRaw || 0);
              if (Number.isFinite(parsed)) onChainCount = parsed;
            } catch {
              onChainCount = null;
            }

            const canTrustTickets =
              ticketIdSet.size > 0 ||
              (Number.isFinite(onChainCount) && onChainCount <= nfts.length);
            const needsCacheMerge =
              onChainCount == null || onChainCount > final.length;
            if (needsCacheMerge) {
              const filteredCache = cachedItems.filter((item) => {
                if (!item) return false;
                if (item.isPlaceholder || item.isPending) return false;
                if (item.isTicket && canTrustTickets) {
                  const key = String(item.tokenId ?? item.id ?? "");
                  return ticketIdSet.has(key);
                }
                return true;
              });
              merged = mergeGalleryLists(filteredCache, final);
              usedCacheFallback = true;
              if (merged.length === 0) {
                merged = final.length ? final : filteredCache;
              }
            }
          }
          const shouldProbeRecent =
            redeemStartedAt &&
            Date.now() - Number(redeemStartedAt) < 15 * 60 * 1000;
          if (shouldProbeRecent) {
            let addedFromEvents = false;
            try {
              const contract = getReadOnlyContract();
              const existingIds = new Set(
                merged.map((item) => String(item?.tokenId ?? item?.id ?? "")),
              );
              const latest = await contract.provider.getBlockNumber();
              const fromBase = Number.isFinite(Number(redeemStartBlock))
                ? Math.max(0, Number(redeemStartBlock) - 2000)
                : Math.max(0, latest - 20_000);
              const mintFilter = contract.filters.NFTMinted(addr);
              const mintLogs = await queryLogsBatched(
                contract,
                mintFilter,
                fromBase,
                latest,
                5000,
              );
              const mintedIds = mintLogs
                .map(
                  (l) =>
                    l.args?.tokenId?.toString?.() || l.args?.[1]?.toString?.(),
                )
                .filter(Boolean);
              const uniqueIds = Array.from(new Set(mintedIds)).reverse();
              if (uniqueIds.length) {
                const recentAdds = [];
                for (const id of uniqueIds) {
                  if (existingIds.has(id)) continue;
                  let meta = {};
                  let image = "/images/Biggi.png";
                  try {
                    const uri = await getTokenUriCached(contract, id);
                    const j = await readJsonFromURI(uri);
                    meta = await enrichMetaWithPrices(contract, id, j || {});
                    const imgUrl = j?.image || j?.image_url;
                    image = resolveImageUrl(imgUrl, uri) || image;
                  } catch {
                    // ignore
                  }
                  recentAdds.push({
                    tokenId: String(id),
                    image,
                    meta,
                    isTicket: false,
                  });
                  existingIds.add(String(id));
                }
                if (recentAdds.length) {
                  merged = [...recentAdds, ...merged];
                  addedFromEvents = true;
                }
              }
            } catch (err) {
              console.debug("recent mint probe failed", err);
            }
            if (!addedFromEvents) {
              try {
                const existingIds = new Set(
                  merged.map((item) => String(item?.tokenId ?? item?.id ?? "")),
                );
                const contract = getReadOnlyContract();
                let total = 0;
                try {
                  total = Number(
                    (
                      await contract.biggiMinted?.().catch(() => null)
                    )?.toString?.() || 0,
                  );
                } catch {
                  // ignore
                }
                if (!total && typeof contract.totalSupply === "function") {
                  try {
                    total = Number(
                      (await contract.totalSupply())?.toString?.() || 0,
                    );
                  } catch {
                    // ignore
                  }
                }
                if (total > 0) {
                  const maxLookback = 6;
                  const startId = Math.max(1, total - maxLookback + 1);
                  const recentAdds = [];
                  for (let tokenId = total; tokenId >= startId; tokenId -= 1) {
                    const key = String(tokenId);
                    if (existingIds.has(key)) continue;
                    let owner = "";
                    try {
                      owner = await contract.ownerOf(tokenId);
                    } catch {
                      continue;
                    }
                    if (
                      String(owner || "").toLowerCase() !==
                      String(addr).toLowerCase()
                    )
                      continue;
                    let isT = false;
                    try {
                      isT =
                        typeof contract.isTicket === "function"
                          ? await contract.isTicket(tokenId)
                          : false;
                    } catch {
                      // ignore
                    }
                    if (isT) continue;

                    let meta = {};
                    let image = "/images/Biggi.png";
                    try {
                      const uri = await getTokenUriCached(contract, tokenId);
                      const j = await readJsonFromURI(uri);
                      meta = await enrichMetaWithPrices(
                        contract,
                        tokenId,
                        j || {},
                      );
                      const imgUrl = j?.image || j?.image_url;
                      image = resolveImageUrl(imgUrl, uri) || image;
                    } catch {
                      // ignore
                    }
                    recentAdds.push({
                      tokenId: key,
                      image,
                      meta,
                      isTicket: false,
                    });
                    existingIds.add(key);
                  }
                  if (recentAdds.length) {
                    merged = [...recentAdds, ...merged];
                  }
                }
              } catch (err) {
                console.debug("recent mint fallback failed", err);
              }
            }
          }

          mergeWithTopFirst(merged);
          saveGalleryCache(addr, merged, cacheAddr);
          if (typeof setGalleryNotice === "function") {
            setGalleryNotice(
              usedCacheFallback ? "RPC/IPFS failed, showing cached NFTs." : "",
            );
          }
          return merged;
        } catch {
          if (hasCached) {
            usedCacheFallback = true;
            mergeWithTopFirst(cachedItems);
            if (typeof setGalleryNotice === "function") {
              setGalleryNotice("RPC/IPFS failed, showing cached NFTs.");
            }
            return cachedItems;
          }
          if (typeof setGalleryNotice === "function") {
            setGalleryNotice("Gallery load failed.");
          }
          return [];
        } finally {
          setGalleryLoading(false);
        }
      })();

      walletFetchRef.current = { inFlight: exec, addr };
      try {
        return await exec;
      } finally {
        if (walletFetchRef.current.inFlight === exec) {
          walletFetchRef.current = { inFlight: null, addr: null };
        }
      }
    },
    [
      fetchMyTickets,
      fetchOwnedNFTsViaTransfers,
      mergeWithTopFirst,
      primeFromCache,
      setGalleryLoading,
      setGalleryNotice,
      pendingTicketId,
      redeemStartBlock,
      redeemStartedAt,
      enrichMetaWithPrices,
    ],
  );

  const fetchLastMinted = React.useCallback(async () => {
    try {
      const contract = getReadOnlyContract();
      const total = Number(await contract.biggiMinted());
      if (total === 0) {
        setLastMinted({
          tokenId: "-",
          image: "/images/Biggi.png",
          blockName: "-",
          backgroundName: "-",
        });
        return;
      }
      const latest = await contract.provider.getBlockNumber();
      const filter = contract.filters.NFTMinted();
      const from = Math.max(
        await getSafeDeployBlock(contract.provider),
        latest - 60_000,
      );
      const logs = await queryLogsBatched(contract, filter, from, latest);
      const last = logs[logs.length - 1];
      if (!last) return;

      const tokenId = last.args.tokenId.toString();
      const uri = await getTokenUriCached(contract, tokenId);
      const meta = await readJsonFromURI(uri);
      let image =
        resolveImageUrl(meta?.image || meta?.image_url, uri) ||
        "/images/Biggi.png";

      let blockName = "-";
      let backgroundName = "-";
      if (meta?.attributes) {
        const blockAttr =
          meta.attributes.find((a) =>
            ["Eye Color", "Eyes", "Block/Eye Color"].includes(a.trait_type),
          ) ||
          meta.attributes.find(
            (a) => a.trait_type === "Block" || a.trait_type === "Block ID",
          );
        if (blockAttr) blockName = blockAttr.value;
        const bgAttr = meta.attributes.find((a) =>
          ["Background", "Background Color"].includes(a.trait_type),
        );
        if (bgAttr)
          backgroundName = canonBackgroundName(bgAttr.value) || bgAttr.value;
      }

      setLastMinted({ tokenId, image, blockName, backgroundName });
    } catch (e) {
      console.error("fetchLastMinted", e);
      setLastMinted({
        tokenId: "-",
        image: "/images/Biggi.png",
        blockName: "-",
        backgroundName: "-",
      });
    }
  }, [setLastMinted]);

  const fetchDynamicTraitsFor = React.useCallback(
    async (nft, enrichMetaWithPricesFn) => {
      try {
        if (!nft || !nft.tokenId) return;
        const tokenId = String(nft.tokenId);

        if (nft.meta && nft.meta.mintTicket && nft.meta.mintBlock) return;
        if (nft.meta && nft.meta.dynamicTraitsLoaded) return;
        if (nft.dynamicTraitsLoaded) return;
        if (nft.meta && nft.meta.mintFinal) return;
        if (nft.meta && nft.meta.mintBlock) return;
        if (nft.meta && nft.meta.mintTicket) return;

        if (nft.meta && nft.meta.dynamicTraitsLoaded) return;
        if (nft.meta && nft.meta.mintTicket) return;

        if (
          setDynamicTraitsById &&
          typeof setDynamicTraitsById === "function"
        ) {
          if (setDynamicTraitsById((prev) => prev[tokenId])) return;
        }

        const contract = getReadOnlyContract();

        const fmt = (n) =>
          typeof n === "number" && !Number.isNaN(n)
            ? `${n.toFixed(4)} POL`
            : "";

        let meta = nft.meta;
        if (!meta) {
          try {
            const uri = await getTokenUriCached(contract, nft.tokenId);
            const url = uri.startsWith("ipfs://")
              ? `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`
              : uri;
            const resp = await fetch(url, { cache: "no-cache" });
            if (resp.ok) meta = await resp.json();
          } catch (err) {
            console.debug("fetchDynamicTraitsFor metadata fetch failed", err);
          }
        }
        const attrs = Array.isArray(meta?.attributes) ? meta.attributes : [];
        const getAttr = (names) =>
          attrs.find((a) =>
            names.some((n) => String(a?.trait_type || "").toLowerCase() === n),
          );

        let blockId = null;
        const blockIdAttr = getAttr(["block id", "block"]);
        if (blockIdAttr && !isNaN(Number(blockIdAttr.value))) {
          blockId = Math.min(10, Math.max(1, Number(blockIdAttr.value)));
        }
        if (!blockId) {
          const eyeAttr = getAttr(["block/eye color", "eye color", "eyes"]);
          if (eyeAttr && eyeAttr.value) {
            const idx = backgroundIndexFromAny(eyeAttr.value);
            if (idx) blockId = idx;
          }
        }
        if (!blockId) blockId = 1;

        let bonusPct = 0;
        const bgAttr = getAttr(["background", "background color"]);
        if (bgAttr && bgAttr.value) {
          const canon = canonBackgroundName(bgAttr.value);
          const bgIdx = canon ? BACKGROUND_NAMES.indexOf(canon) : -1;
          if (bgIdx !== -1) bonusPct = BACKGROUND_BONUSES[bgIdx] || 0;
        }

        let mintBlockNumber = null;
        try {
          const tokenIdBN = ethers.BigNumber.from(tokenId);
          const mintFilter = contract.filters.Transfer(
            "0x0000000000000000000000000000000000000000",
            null,
            tokenIdBN,
          );
          const latestBlock = await contract.provider.getBlockNumber();
          const FROM = await getSafeDeployBlock(contract.provider);
          const mintLogs = await queryLogsBatched(
            contract,
            mintFilter,
            FROM,
            latestBlock,
          );
          if (mintLogs && mintLogs.length) {
            mintBlockNumber = mintLogs[0].blockNumber;
          }
        } catch (err) {
          console.debug("fetchDynamicTraitsFor mint logs failed", err);
        }

        let mintTicket = null;
        let mintBlock = null;
        let mintFinal = null;

        if (mintBlockNumber != null) {
          try {
            const tpPast = await contract.getTicketPrice({
              blockTag: mintBlockNumber,
            });
            mintTicket = Number(ethers.utils.formatEther(tpPast));
          } catch (err) {
            console.debug("fetchDynamicTraitsFor ticket price failed", err);
          }

          try {
            const bpPast = await contract.getCurrentBlockPrice(blockId, {
              blockTag: mintBlockNumber,
            });
            mintBlock = Number(ethers.utils.formatEther(bpPast));
          } catch (err) {
            console.debug("fetchDynamicTraitsFor block price failed", err);
          }

          if (mintBlock != null) {
            mintFinal = mintBlock * (1 + (bonusPct || 0) / 100);
          }
        }

        const dynamicData = {
          mintTicket: fmt(mintTicket),
          mintBlock: fmt(mintBlock),
          mintFinal:
            mintFinal != null
              ? `${mintFinal.toFixed(4)} POL (${bonusPct}% bonus)`
              : "",
          ticketPrice: undefined,
          blockPrice: undefined,
          finalPrice: undefined,
        };

        if (setDynamicTraitsById) {
          setDynamicTraitsById((prev) => ({
            ...prev,
            [tokenId]: dynamicData,
          }));
        }

        if (meta && enrichMetaWithPricesFn) {
          const enriched = await enrichMetaWithPricesFn(
            contract,
            tokenId,
            meta,
          );
          setMyNFTs((prev) =>
            prev.map((n) =>
              n.tokenId === tokenId
                ? { ...n, meta: enriched, dynamicTraitsLoaded: true }
                : n,
            ),
          );
        }
      } catch (e) {
        console.error("fetchDynamicTraitsFor error", e);
      }
    },
    [setDynamicTraitsById, setMyNFTs],
  );

  return {
    fetchMyTickets,
    fetchOwnedNFTsViaTransfers,
    fetchOwnedNFTsViaOwnerScan,
    fetchWalletAssets,
    fetchLastMinted,
    fetchDynamicTraitsFor,
  };
}
