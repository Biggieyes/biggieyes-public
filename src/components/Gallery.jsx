import * as React from "react";
import "./Gallery.css";
import NftCard from "./NftCard";
import { useContracts } from "../providers/ContractsProvider";
import { useWeb3 } from "../providers/Web3Provider";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { ADDR } from "../utils/addresses.js";
import {
  readJsonFromURI,
  resolveImageUrl,
  httpFromIpfs,
} from "../services/ipfs.js";

const PAGE_SIZE_DESKTOP = 12;
const PAGE_SIZE_MOBILE = 6;

// max šířka batch okna pro RPC (bezpečně pod 50k)
const LOGS_BATCH = 36_000;

// paralelní limit pro tokenURI / metadata fetch (snižuje šanci na RPC timeouts)
const METADATA_PARALLELISM = 12;

function toIdString(item) {
  if (!item) return "";
  if (item.tokenId != null) return String(item.tokenId);
  if (item.id != null) return String(item.id);
  return "";
}

async function getSafeDeployBlock(provider) {
  try {
    if (ADDR?.DEPLOY_BLOCK && Number.isFinite(Number(ADDR.DEPLOY_BLOCK))) {
      return Number(ADDR.DEPLOY_BLOCK);
    }
    if (!provider || typeof provider.getBlockNumber !== "function") return 0;
    const latest = await provider.getBlockNumber().catch(() => null);
    if (latest == null) {
      console.warn(
        "getSafeDeployBlock: provider.getBlockNumber failed, falling back to 0",
      );
      return 0;
    }
    return Math.max(0, latest - 49_999);
  } catch (e) {
    console.warn("getSafeDeployBlock: unexpected error", e);
    return 0;
  }
}

async function queryLogsBatched(
  contract,
  filter,
  fromBlock,
  toBlock,
  step = LOGS_BATCH,
) {
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
      // snaha o degradaci batchu při chybách (provider může odmítnout velké intervaly)
      console.warn(
        `queryLogsBatched: batch ${batch} failed, reducing. err: ${err?.message || err}`,
      );
      if (batch <= 1) throw new Error("queryFilter failed even at batch=1");
      batch = Math.max(1, Math.floor(batch / 2));
    }
  }
  return out;
}

/**
 * Resolve token IDs owned by address with preference for reader methods.
 * - mainContract: contract instance for main (ERC-721)
 * - address: owner address
 * - reader: optional reader contract instance (aggregator) — preferovat pokud dostupné
 */
async function resolveHeldTokenIds(mainContract, address, reader) {
  if (!mainContract || !address) return [];

  // 1) pokud máme reader, zkusíme více reader-methods (preferované — rychlejší a méně RPC)
  if (reader) {
    try {
      // běžné pojmenování v readeru v různých implementacích: getUserRewardTokenIds, getUserTokenIds, tokensOfOwner
      if (typeof reader.getUserRewardTokenIds === "function") {
        const res = await reader.getUserRewardTokenIds(address);
        if (Array.isArray(res) && res.length)
          return res.map((id) => BigInt(id));
      }
    } catch (e) {
      console.warn("reader.getUserRewardTokenIds failed, falling back", e);
    }
    try {
      if (typeof reader.getUserTokenIds === "function") {
        const res = await reader.getUserTokenIds(address);
        if (Array.isArray(res) && res.length)
          return res.map((id) => BigInt(id));
      }
    } catch (e) {
      console.warn("reader.getUserTokenIds failed, falling back", e);
    }
    try {
      if (typeof reader.tokensOfOwner === "function") {
        const res = await reader.tokensOfOwner(address);
        if (Array.isArray(res) && res.length)
          return res.map((id) => BigInt(id));
      }
    } catch (e) {
      console.warn("reader.tokensOfOwner failed, falling back", e);
    }
  }

  // 2) Zkusíme mainContract.tokensOfOwner (ERC-721 enumerability)
  try {
    if (typeof mainContract.tokensOfOwner === "function") {
      const ids = await mainContract.tokensOfOwner(address);
      return Array.isArray(ids)
        ? ids.map((id) => BigInt(id))
        : [];
    }
  } catch (e) {
    console.warn(
      "tokensOfOwner failed on mainContract, falling back to logs",
      e,
    );
  }

  // 3) Fallback přes logy (robustní, ale pomalejší)
  try {
    const provider = mainContract.provider;
    if (!provider || typeof provider.getBlockNumber !== "function") {
      console.warn("resolveHeldTokenIds: mainContract.provider not available");
      return [];
    }

    const latest = await provider.getBlockNumber().catch(() => null);
    if (latest == null) {
      console.warn(
        "resolveHeldTokenIds: provider.getBlockNumber failed, aborting log scan",
      );
      return [];
    }

    const fromBlock = await getSafeDeployBlock(provider);

    const toFilter = mainContract.filters.Transfer(null, address, null);
    const fromFilter = mainContract.filters.Transfer(address, null, null);

    const [toLogs, fromLogs] = await Promise.all([
      queryLogsBatched(mainContract, toFilter, fromBlock, latest),
      queryLogsBatched(mainContract, fromFilter, fromBlock, latest),
    ]);

    const ordered = [...toLogs, ...fromLogs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.logIndex - b.logIndex;
    });

    const owned = new Set();
    const lower = address.toLowerCase();
    for (const log of ordered) {
      const from = String(log.args?.from ?? log.args?.[0] ?? "").toLowerCase();
      const to = String(log.args?.to ?? log.args?.[1] ?? "").toLowerCase();
      const tokenId = (log.args?.tokenId ?? log.args?.[2])?.toString?.() || "";
      if (!tokenId) continue;
      if (to === lower) owned.add(tokenId);
      if (from === lower) owned.delete(tokenId);
    }
    return Array.from(owned).map((id) => BigInt(id));
  } catch (err) {
    console.error("resolveHeldTokenIds failed", err);
    // při problému s providerem: bezpečný fallback
    return [];
  }
}

/**
 * hydrateTokens: fetch tokenURI + metadata + image resolver + optional mint info from reader
 * - mainContract: contract instance
 * - reader: optional reader instance (pro mint info)
 * - tokenIds: array of BigNumber / string token ids
 *
 * Implementováno s řízenou paralelizací (chunking) aby se nezahltil RPC.
 */
async function hydrateTokens(mainContract, reader, tokenIds) {
  if (!mainContract || !tokenIds.length) return [];
  let ticketBaseUri = null;
  try {
    if (typeof mainContract.ticketBaseURI === "function") {
      const base = await mainContract.ticketBaseURI().catch(() => null);
      if (base) ticketBaseUri = String(base);
    }
  } catch {
    ticketBaseUri = null;
  }
  const coerceToBool = (val) => {
    if (typeof val === "boolean") return val;
    if (typeof val?.toNumber === "function") {
      try {
        return Boolean(val.toNumber());
      } catch {
        return Boolean(val);
      }
    }
    if (typeof val === "number") return Boolean(val);
    if (typeof val === "string") {
      const normalized = val.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
      const num = Number(val);
      return Number.isNaN(num) ? Boolean(val) : Boolean(num);
    }
    return Boolean(val);
  };
  const results = [];
  // chunk tokenIds pro omezení paralelismu
  for (let i = 0; i < tokenIds.length; i += METADATA_PARALLELISM) {
    const chunk = tokenIds.slice(i, i + METADATA_PARALLELISM);
    // zpracovat chunk paralelně
    const chunkRes = await Promise.all(
      chunk.map(async (id) => {
        try {
          // normalize id
          const idStr = String(id?.toString ? id.toString() : id);
          // tokenURI může revertovat pro některé tokeny — ošetříme to try/catch
          let uri = null;
          let metaUriUsed = null;
          try {
            if (typeof mainContract.tokenURI === "function") {
              uri = await mainContract.tokenURI(id).catch(() => null);
            }
          } catch (e) {
            uri = null;
          }

          let meta = null;
          let image = null;
          if (uri) {
            meta = await readJsonFromURI(uri).catch(() => null);
            if (meta) {
              metaUriUsed = uri;
              const imgCandidate = meta.image || meta.image_url;
              if (imgCandidate) {
                const resolved = await resolveImageUrl(imgCandidate, uri).catch(
                  () => null,
                );
                image = resolved || httpFromIpfs(imgCandidate);
              }
            }
          }

          let isTicket = false;
          try {
            if (reader) {
              const readerChecks = [
                "isTicketToken",
                "tokenIsTicket",
                "isTicket",
              ];
              for (const fn of readerChecks) {
                if (isTicket) break;
                if (typeof reader[fn] === "function") {
                  const res = await reader[fn](id).catch(() => null);
                  if (res != null) {
                    isTicket = coerceToBool(res);
                  }
                  if (isTicket) break;
                }
              }
            }
          } catch {
            // ignore reader ticket detection errors
          }

          if (!isTicket && typeof mainContract.isTicket === "function") {
            try {
              const res = await mainContract.isTicket(id).catch(() => null);
              if (res != null) {
                isTicket = coerceToBool(res);
              }
            } catch {
              // ignore isTicket fallback errors
            }
          }

          if (isTicket && !meta && ticketBaseUri) {
            const normalizedBase = ticketBaseUri.endsWith("/")
              ? ticketBaseUri
              : `${ticketBaseUri}/`;
            const guesses = [
              `${normalizedBase}${idStr}`,
              `${normalizedBase}${idStr}.json`,
            ];
            for (const guess of guesses) {
              if (meta) break;
              const candidate = await readJsonFromURI(guess).catch(() => null);
              if (candidate) {
                meta = candidate;
                metaUriUsed = guess;
              }
            }
            if (meta) {
              const imgCandidate = meta.image || meta.image_url;
              if (imgCandidate) {
                const resolved = await resolveImageUrl(
                  imgCandidate,
                  metaUriUsed || normalizedBase,
                ).catch(() => null);
                image = resolved || httpFromIpfs(imgCandidate);
              }
            }
          }

          if (isTicket && !meta) {
            meta = {
              name: `Ticket #${idStr}`,
              description: "Redeem this ticket to mint a Biggi NFT.",
            };
          }

          let mint = null;
          if (reader) {
            try {
              // reader může mít různé názvy pro získání mint dat — zkusíme několik možností bezpečně
              if (typeof reader.getMintDataByTokenId === "function") {
                const res = await reader.getMintDataByTokenId(id);
                const ticketWei = res?.[0] ?? 0;
                const blockWei = res?.[1] ?? 0;
                const finalWei = res?.[2] ?? 0;
                mint = {
                  ticketPrice: Number(formatEther(ticketWei)),
                  blockPrice: Number(formatEther(blockWei)),
                  finalPrice: Number(formatEther(finalWei)),
                };
              } else if (typeof reader.getMintData === "function") {
                // getMintData(index) může někdy přijít s indexem tokenId; pokusíme se bez crashu
                const res = await reader.getMintData(id).catch(() => null);
                if (res) {
                  const ticketWei = res?.[0] ?? 0;
                  const blockWei = res?.[1] ?? 0;
                  const finalWei = res?.[2] ?? 0;
                  mint = {
                    ticketPrice: Number(formatEther(ticketWei)),
                    blockPrice: Number(formatEther(blockWei)),
                    finalPrice: Number(formatEther(finalWei)),
                  };
                }
              }
            } catch {
              // ignore mint fetch errors
            }
          }

          if (!image) {
            image = "/images/Biggi.png";
          }

          return {
            tokenId: idStr,
            meta,
            image,
            mint,
            isTicket,
          };
        } catch (err) {
          console.error("Gallery hydrate token failed", err);
          const fallbackId = String(id);
          return {
            tokenId: fallbackId,
            meta: { name: `Token #${fallbackId}`, description: "" },
            image: "/images/Biggi.png",
            mint: null,
            isTicket: false,
          };
        }
      }),
    );
    results.push(...chunkRes);
    // malá pauza v případě, že provider je pomalý (strategické snížení pressure)
    // (nepovinné — odkomentuj pokud budeš mít stále timeouts)
    // await new Promise(r => setTimeout(r, 50));
  }
  return results;
}

export default function Gallery({
  address: addressProp,
  items: itemsProp = [],
  dynamicTraitsById = {},
  onOpenDetails,
  onZoom,
  compact = false,
  useProvidedOnly = false,
}) {
  // fallback na adresu z kontextu peněženky
  const { address: ctxAddress } = (() => {
    try {
      return useWeb3();
    } catch {
      return { address: "" };
    }
  })();

  let contracts;
  try {
    contracts = useContracts();
  } catch {
    contracts = null;
  }

  const [hydratedItems, setHydratedItems] = React.useState([]);
  const [fetching, setFetching] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("default");
  const [filterRarity, setFilterRarity] = React.useState("all");
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 768px)").matches
      : false,
  );

  const address =
    addressProp || ctxAddress ? String(addressProp || ctxAddress) : "";
  const isConnected = Boolean(address);

  const providedItems = Array.isArray(itemsProp) ? itemsProp : [];
  const renderedItems = isConnected
    ? providedItems.length
      ? providedItems
      : hydratedItems
    : [];

  const mainContractAddress = React.useMemo(() => {
    if (!contracts) return ADDR?.MAIN ?? null;
    try {
      // contracts.mainRead returns a contract instance (or a function returning one)
      const maybe = contracts.mainRead?.();
      return maybe?.address ?? ADDR?.MAIN ?? null;
    } catch {
      return ADDR?.MAIN ?? null;
    }
  }, [contracts]);

  React.useEffect(() => {
    if (!isConnected) setHydratedItems([]);
    setPage(0);
  }, [isConnected]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const listener = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", listener);
    else mq.addListener(listener);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", listener);
      else mq.removeListener(listener);
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const loadFromChain = async () => {
      if (useProvidedOnly) return;
      if (!isConnected || providedItems.length || !address || !contracts)
        return;
      setFetching(true);
      try {
        // contracts may expose factory functions or actual instances
        const main = contracts.mainRead?.();
        const reader = contracts.readerRead?.();

        if (!main) {
          console.warn("Gallery: main contract not available");
          if (!cancelled) setHydratedItems([]);
          return;
        }

        // ensure provider exists and is functional
        const provider = main.provider;
        if (!provider || typeof provider.getBlockNumber !== "function") {
          console.warn("Gallery: provider not available on main contract");
          if (!cancelled) setHydratedItems([]);
          return;
        }

        // Try to resolve held token ids — prefer reader if present
        const tokenIds = await resolveHeldTokenIds(main, address, reader);
        if (!tokenIds.length) {
          if (!cancelled) setHydratedItems([]);
          return;
        }

        // hydrate metadata in controlled parallelism, pass reader for mint info
        const tokens = await hydrateTokens(main, reader, tokenIds);
        if (!cancelled) setHydratedItems(tokens);
      } catch (err) {
        console.error("Gallery chain fetch failed", err);
        if (!cancelled) setHydratedItems([]);
      } finally {
        if (!cancelled) setFetching(false);
      }
    };
    loadFromChain();
    return () => {
      cancelled = true;
    };
  }, [isConnected, providedItems, address, contracts, useProvidedOnly]);

  const pageSize = isMobile || compact ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;

  const processedItems = React.useMemo(() => {
    let list = renderedItems;
    if (filterRarity !== "all") {
      list = list.filter(
        (item) =>
          String(item?.rarity ?? "").toLowerCase() ===
          String(filterRarity).toLowerCase(),
      );
    }
    const sorted = [...list];
    if (sortBy === "name") {
      sorted.sort((a, b) => {
        const nameA = a?.name || a?.meta?.name || `#${a?.tokenId ?? ""}`;
        const nameB = b?.name || b?.meta?.name || `#${b?.tokenId ?? ""}`;
        return nameA.localeCompare(nameB);
      });
    } else if (sortBy === "rarity") {
      sorted.sort(
        (a, b) =>
          (a?.rarityRank ?? Number.MAX_SAFE_INTEGER) -
          (b?.rarityRank ?? Number.MAX_SAFE_INTEGER),
      );
    } else if (sortBy === "token") {
      sorted.sort((a, b) => Number(a?.tokenId ?? 0) - Number(b?.tokenId ?? 0));
    }
    return sorted;
  }, [renderedItems, filterRarity, sortBy]);

  React.useEffect(() => {
    setPage(0);
  }, [sortBy, filterRarity]);

  const totalPages = Math.max(1, Math.ceil(processedItems.length / pageSize));

  React.useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages - 1));
  }, [totalPages]);

  const pagedItems = React.useMemo(() => {
    const start = page * pageSize;
    return processedItems.slice(start, start + pageSize);
  }, [processedItems, page, pageSize]);

  const handlePrev = () => setPage((prev) => Math.max(0, prev - 1));
  const handleNext = () =>
    setPage((prev) => Math.min(totalPages - 1, prev + 1));

  const totalOwned = renderedItems.length;

  const rarityCounts = React.useMemo(() => {
    const counts = {};
    renderedItems.forEach((item) => {
      const rarity = item?.rarity ?? "unknown";
      counts[rarity] = (counts[rarity] ?? 0) + 1;
    });
    return counts;
  }, [renderedItems]);

  return (
    <section className="gallery">
      <header className="gallery__header">
        <div>
          <h2 className="gallery__title">My Biggi COLLECTION</h2>
          <p className="gallery__subtitle">
            Browse every Biggi token linked to your wallet. Sort, filter, and
            inspect detailed metadata pulled directly from the smart contracts.
          </p>
        </div>
        <div className="gallery__header-actions">
          <div className="gallery__select">
            <label htmlFor="gallery-sort">Sort</label>
            <select
              id="gallery-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="default">Newest</option>
              <option value="token">Token ID</option>
              <option value="name">Name</option>
              <option value="rarity">Rarity</option>
            </select>
          </div>
          <div className="gallery__select">
            <label htmlFor="gallery-filter">Rarity</label>
            <select
              id="gallery-filter"
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value)}
            >
              <option value="all">All</option>
              <option value="legendary">Legendary</option>
              <option value="epic">Epic</option>
              <option value="rare">Rare</option>
              <option value="uncommon">Uncommon</option>
              <option value="common">Common</option>
            </select>
          </div>
          <button
            type="button"
            className="gallery__info-btn"
            onClick={() => setInfoOpen(true)}
          >
            Info
          </button>
        </div>
      </header>

      <div className="gallery__summary">
        <div className="gallery__summary-item">
          <span>Wallet</span>
          <strong>
            {address
              ? `${address.slice(0, 6)}...${address.slice(-4)}`
              : "Not connected"}
          </strong>
        </div>
        <div className="gallery__summary-item">
          <span>Total Owned</span>
          <strong>{fetching ? "Loading..." : totalOwned}</strong>
        </div>
        <div className="gallery__summary-item">
          <span>Rarities</span>
          <strong>
            {Object.keys(rarityCounts).length
              ? Object.entries(rarityCounts)
                  .map(([rarity, count]) => `${rarity}: ${count}`)
                  .join(" | ")
              : "--"}
          </strong>
        </div>
        <div className="gallery__summary-item">
          <span>Page</span>
          <strong>
            {page + 1} / {totalPages}
          </strong>
        </div>
      </div>

      <div className={`gallery__grid${fetching ? " is-loading" : ""}`}>
        {!isConnected && (
          <div className="gallery__placeholder">
            <h3>Connect Wallet</h3>
            <p>Connect MetaMask to load your Biggi NFTs.</p>
          </div>
        )}
        {isConnected && fetching && !renderedItems.length && (
          <div className="gallery__placeholder">Loading COLLECTION...</div>
        )}
        {isConnected && !fetching && renderedItems.length === 0 && (
          <div className="gallery__placeholder">
            <h3>No NFTs detected</h3>
            <p>
              Mint a Biggi NFT or connect a different wallet to see your
              COLLECTION here.
            </p>
          </div>
        )}
        {pagedItems.map((item) => {
          const tokenId = toIdString(item);
          const dynamic = dynamicTraitsById[tokenId] || {};
          return (
            <NftCard
              key={tokenId || Math.random()}
              nft={item}
              dynamicTraits={dynamic}
              onOpenDetails={onOpenDetails}
              onZoom={onZoom}
              fallbackContractAddress={mainContractAddress}
            />
          );
        })}
      </div>

      {totalPages > 1 && (
        <footer className="gallery__pager">
          <button
            type="button"
            className="gallery__pager-btn"
            onClick={handlePrev}
            disabled={page === 0}
          >
            Prev
          </button>
          <span className="gallery__pager-status">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="gallery__pager-btn"
            onClick={handleNext}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </footer>
      )}

      {infoOpen && (
        <div
          className="gallery__dialog-backdrop"
          onClick={() => setInfoOpen(false)}
        >
          <div className="gallery__dialog" onClick={(e) => e.stopPropagation()}>
            <div className="gallery__dialog-header">
              <h3>Gallery Tips</h3>
              <button type="button" onClick={() => setInfoOpen(false)}>
                Close
              </button>
            </div>
            <div className="gallery__dialog-body">
              <ul>
                <li>
                  Sort by name, token ID, or rarity to reorganise your view.
                </li>
                <li>Filter rarities to focus on legendary or rare pieces.</li>
                <li>
                  Open any card to review mint-time prices and full metadata.
                </li>
                <li>
                  The import button saves the NFT to MetaMask via{" "}
                  <code>wallet_watchAsset</code>.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


