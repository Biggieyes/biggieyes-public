import * as React from "react";
import "./Gallery.css";
import NftCard from "./NftCard";
import { useContracts } from "../providers/ContractsProvider";
import { useWeb3 } from "../providers/Web3Provider";
import { formatEther } from "ethers";
import { ADDR } from "../utils/addresses.js";
import { getProviderForContract } from "../shared/utils/contract";
import {
  queryLogsBatched,
  getSafeDeployBlock,
  loadWalletCache,
  saveWalletCache,
} from "../shared/utils/shared";
import { getArchiveProvider } from "../web3/provider";
import {
  readJsonFromURI,
  resolveImageUrl,
  httpFromIpfs,
} from "../services/ipfs.js";

const PAGE_SIZE_DESKTOP = 12;
const PAGE_SIZE_MOBILE = 6;

// Smaller batch size to reduce RPC rejections on public endpoints.
const LOGS_BATCH = 300;
const PLACEHOLDER_IMAGE = "/images/Biggi.png";

// paralelní limit pro tokenURI / metadata fetch (snižuje šanci na RPC timeouts)
const METADATA_PARALLELISM = 10;
const METADATA_PARALLELISM_MOBILE = 6;

const tokenUriCache = new Map();
const metadataCache = new Map();
const imageCache = new Map();

const SESSION_CACHE_VERSION = "v3-mainnet";
const getGalleryContractCacheAddress = (contractLike = null) =>
  String(
    contractLike?.target ||
      contractLike?.address ||
      ADDR?.COLLECTION_VRF ||
      ADDR?.MAIN ||
      "",
  )
    .trim()
    .toLowerCase();
const makeSessionKey = (prefix, value, contractAddress = "") => {
  const chainId = Number(ADDR?.CHAIN_ID || 137) || 137;
  const contract =
    String(contractAddress || "").trim().toLowerCase() ||
    getGalleryContractCacheAddress();
  return `${prefix}:${SESSION_CACHE_VERSION}:${chainId}:${
    contract || "main"
  }:${encodeURIComponent(String(value || ""))}`;
};
const makeMemoryCacheKey = (contractAddress, value) =>
  `${String(contractAddress || "main").toLowerCase()}:${String(value || "")}`;

const loadSessionJson = (key) => {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveSessionJson = (key, value) => {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / storage errors
  }
};

const getParallelism = () => {
  try {
    if (typeof window !== "undefined") {
      if (window.matchMedia("(max-width: 700px)").matches)
        return METADATA_PARALLELISM_MOBILE;
    }
  } catch {
    // ignore
  }
  return METADATA_PARALLELISM;
};

const looksLikeTicketMeta = (meta) => {
  if (!meta) return false;
  const name = String(meta?.name || "").toLowerCase();
  const desc = String(meta?.description || "").toLowerCase();
  return (
    name.includes("ticket") ||
    desc.includes("ticket") ||
    desc.includes("redeem")
  );
};

const looksLikeNftMeta = (meta) => {
  if (!meta) return false;
  const attrs = Array.isArray(meta?.attributes) ? meta.attributes : [];
  return attrs.some((a) => {
    const t = String(a?.trait_type || "").toLowerCase();
    return t.includes("background") || t.includes("block") || t.includes("eye");
  });
};

const normalizeBaseUri = (uri) => {
  if (!uri) return null;
  const s = String(uri).trim();
  if (!s) return null;
  return s.endsWith("/") ? s : `${s}/`;
};

const isTicketUri = (uri, base) => {
  if (!uri || !base) return false;
  return String(uri).startsWith(base);
};

function toIdString(item) {
  if (!item) return "";
  if (item.tokenId != null) return String(item.tokenId);
  if (item.id != null) return String(item.id);
  return "";
}


/**
 * Resolve token IDs owned by address with preference for reader methods.
 * - mainContract: contract instance for main (ERC-721)
 * - address: owner address
 * - reader: optional reader contract instance (aggregator) — preferovat pokud dostupné
 */
async function resolveHeldTokenIds(mainContract, address, reader) {
  if (!mainContract || !address) return [];
  const contractAddr = mainContract?.target || mainContract?.address || "";

  const coerceBigIntId = (value) => {
    try {
      if (value == null) return null;
      if (typeof value === "bigint") return value;
      if (typeof value === "number") {
        if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
        return BigInt(value);
      }
      if (typeof value === "string") {
        const s = value.trim();
        if (!s) return null;
        if (/^\d+$/.test(s)) return BigInt(s);
        return null;
      }
      if (typeof value === "object") {
        // Some caches store full NFT objects; accept tokenId/id fields.
        const maybe = value?.tokenId ?? value?.id ?? null;
        if (maybe != null) return coerceBigIntId(maybe);
      }
      if (typeof value?.toString === "function") {
        return coerceBigIntId(value.toString());
      }
      return null;
    } catch {
      return null;
    }
  };
  const cached = loadWalletCache(address, { allowExpired: true }, contractAddr);
  const cachedIds =
    Array.isArray(cached) && cached.length
      ? cached.map(coerceBigIntId).filter((x) => x != null)
      : null;
  const saveIds = (ids) => {
    try {
      saveWalletCache(
        address,
        ids.map((id) => id.toString()),
        contractAddr,
      );
    } catch {
      // ignore cache errors
    }
    return ids;
  };

  const safeLogArg = (args, key, index) => {
    if (!args) return undefined;
    if (key) {
      try {
        const v = args[key];
        if (v != null) return v;
      } catch {
        // ignore
      }
    }
    if (typeof index === "number") {
      try {
        if (typeof args.length === "number" && args.length <= index)
          return undefined;
      } catch {
        // ignore
      }
      try {
        return args[index];
      } catch {
        // ignore out-of-range access
      }
    }
    return undefined;
  };

  const topicToAddress = (topic) => {
    if (!topic || typeof topic !== "string") return "";
    const hex = topic.startsWith("0x") ? topic.slice(2) : topic;
    if (hex.length < 40) return "";
    return `0x${hex.slice(hex.length - 40)}`;
  };

  const topicToBigInt = (topic) => {
    if (!topic || typeof topic !== "string") return null;
    try {
      return BigInt(topic);
    } catch {
      return null;
    }
  };

  // 1) pokud máme reader, zkusíme více reader-methods (preferované — rychlejší a méně RPC)
  if (reader) {
    try {
      // běžné pojmenování v readeru v různých implementacích: getUserRewardTokenIds, getUserTokenIds, tokensOfOwner
      if (typeof reader.getUserRewardTokenIds === "function") {
        const res = await reader.getUserRewardTokenIds(address);
        if (Array.isArray(res) && res.length)
          return saveIds(res.map(coerceBigIntId).filter((x) => x != null));
      }
    } catch (e) {
      console.warn("reader.getUserRewardTokenIds failed, falling back", e);
    }
    try {
      if (typeof reader.getUserTokenIds === "function") {
        const res = await reader.getUserTokenIds(address);
        if (Array.isArray(res) && res.length)
          return saveIds(res.map(coerceBigIntId).filter((x) => x != null));
      }
    } catch (e) {
      console.warn("reader.getUserTokenIds failed, falling back", e);
    }
    try {
      if (typeof reader.tokensOfOwner === "function") {
        const res = await reader.tokensOfOwner(address);
        if (Array.isArray(res) && res.length)
          return saveIds(res.map(coerceBigIntId).filter((x) => x != null));
      }
    } catch (e) {
      console.warn("reader.tokensOfOwner failed, falling back", e);
    }
  }

  // 2) Zkusíme mainContract.tokensOfOwner (ERC-721 enumerability)
  try {
    if (typeof mainContract.tokensOfOwner === "function") {
      const ids = await mainContract.tokensOfOwner(address);
      const mapped = Array.isArray(ids)
        ? ids.map((id) => coerceBigIntId(id)).filter((x) => x != null)
        : [];
      if (mapped.length) return saveIds(mapped);
      return mapped;
    }
  } catch (e) {
    console.warn(
      "tokensOfOwner failed on mainContract, falling back to logs",
      e,
    );
  }

  // 3) Fallback přes logy (robustní, ale pomalejší)
  try {
    const provider = getProviderForContract(mainContract);
    if (!provider || typeof provider.getBlockNumber !== "function") {
      console.warn("resolveHeldTokenIds: mainContract.provider not available");
      if (cachedIds && cachedIds.length) return cachedIds;
      return [];
    }

    const latest = await provider.getBlockNumber().catch(() => null);
    if (latest == null) {
      console.warn(
        "resolveHeldTokenIds: provider.getBlockNumber failed, aborting log scan",
      );
      if (cachedIds && cachedIds.length) return cachedIds;
      return [];
    }

    const fromBlock = await getSafeDeployBlock(provider);

    const toFilter = mainContract.filters.Transfer(null, address, null);
    const fromFilter = mainContract.filters.Transfer(address, null, null);

    let toLogs = [];
    let fromLogs = [];
    const logProvider = getArchiveProvider() || provider;
    const direct = await (async () => {
      try {
        if (!logProvider || typeof logProvider.getLogs !== "function")
          return null;
        const address = toFilter?.address || contractAddr;
        const [directTo, directFrom] = await Promise.all([
          logProvider.getLogs({
            address,
            topics: toFilter?.topics,
            fromBlock,
            toBlock: latest,
          }),
          logProvider.getLogs({
            address,
            topics: fromFilter?.topics,
            fromBlock,
            toBlock: latest,
          }),
        ]);
        return { toLogs: directTo, fromLogs: directFrom };
      } catch {
        return null;
      }
    })();
    if (direct) {
      ({ toLogs, fromLogs } = direct);
    } else {
      const opts = getArchiveProvider() ? { fullHistory: true } : undefined;
      [toLogs, fromLogs] = await Promise.all([
        queryLogsBatched(
          mainContract,
          toFilter,
          fromBlock,
          latest,
          LOGS_BATCH,
          opts,
        ),
        queryLogsBatched(
          mainContract,
          fromFilter,
          fromBlock,
          latest,
          LOGS_BATCH,
          opts,
        ),
      ]);
    }

    const ordered = [...toLogs, ...fromLogs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.logIndex - b.logIndex;
    });

    const owned = new Set();
    const lower = address.toLowerCase();
    for (const log of ordered) {
      const args = log.args;
      const topicFrom = topicToAddress(log?.topics?.[1]);
      const topicTo = topicToAddress(log?.topics?.[2]);
      const topicToken = topicToBigInt(log?.topics?.[3]);

      const from = String(
        (topicFrom || safeLogArg(args, "from", 0) || "") ?? "",
      ).toLowerCase();
      const to = String(
        (topicTo || safeLogArg(args, "to", 1) || "") ?? "",
      ).toLowerCase();

      const tokenIdRaw = topicToken ?? safeLogArg(args, "tokenId", 2);
      const tokenId = coerceBigIntId(tokenIdRaw);
      if (!tokenId) continue;
      const tokenIdStr = tokenId.toString();
      if (to === lower) owned.add(tokenIdStr);
      if (from === lower) owned.delete(tokenIdStr);
    }
    const ids = Array.from(owned)
      .map((id) => coerceBigIntId(id))
      .filter((x) => x != null);
    saveWalletCache(
      address,
      ids.map((id) => id.toString()),
      contractAddr,
    );
    return ids;
  } catch (err) {
    console.error("resolveHeldTokenIds failed", err);
    // při problému s providerem: bezpečný fallback
    if (cachedIds && cachedIds.length) return cachedIds;
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
  const contractCacheAddress = getGalleryContractCacheAddress(mainContract);
  let ticketBaseUri = null;
  try {
    if (typeof mainContract.ticketBaseURI === "function") {
      const base = await mainContract.ticketBaseURI().catch(() => null);
      if (base) ticketBaseUri = String(base);
    }
  } catch {
    ticketBaseUri = null;
  }
  const normalizedTicketBase = normalizeBaseUri(ticketBaseUri);
  const coerceToBool = (val) => {
    if (typeof val === "boolean") return val;
    if (typeof val?.toNumber === "function") {
      try {
        return Boolean(val.toNumber());
      } catch {
        return Boolean(val);
      }
    }
    if (typeof val === "bigint") return val !== 0n;
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
  const parallelism = getParallelism();
  for (let i = 0; i < tokenIds.length; i += parallelism) {
    const chunk = tokenIds.slice(i, i + parallelism);
    // zpracovat chunk paralelně
    const chunkRes = await Promise.all(
      chunk.map(async (id) => {
        try {
          // normalize id
          const idStr = String(id?.toString ? id.toString() : id);
          const tokenMemoryKey = makeMemoryCacheKey(
            contractCacheAddress,
            idStr,
          );
          // tokenURI může revertovat pro některé tokeny — ošetříme to try/catch
          let uri = null;
          let metaUriUsed = null;
          const uriCacheKey = makeSessionKey(
            "biggi_token_uri",
            idStr,
            contractCacheAddress,
          );
          uri = tokenUriCache.get(tokenMemoryKey) || loadSessionJson(uriCacheKey);
          if (!uri) {
            try {
              if (typeof mainContract.tokenURI === "function") {
                uri = await mainContract.tokenURI(id).catch(() => null);
              }
            } catch (e) {
              uri = null;
            }
            if (uri) {
              tokenUriCache.set(tokenMemoryKey, uri);
              saveSessionJson(uriCacheKey, uri);
            }
          }

          let meta = null;
          let image = null;
          if (uri) {
            const metaMemoryKey = makeMemoryCacheKey(contractCacheAddress, uri);
            const metaCacheKey = makeSessionKey(
              "biggi_meta",
              uri,
              contractCacheAddress,
            );
            meta =
              metadataCache.get(metaMemoryKey) || loadSessionJson(metaCacheKey);
            if (!meta) {
              meta = await readJsonFromURI(uri).catch(() => null);
              if (meta) {
                metadataCache.set(metaMemoryKey, meta);
                saveSessionJson(metaCacheKey, meta);
              }
            }
            if (meta) {
              metaUriUsed = uri;
              const imgCandidate = meta.image || meta.image_url;
              if (imgCandidate) {
                const imgCacheKey = makeSessionKey(
                  "biggi_img",
                  imgCandidate,
                  contractCacheAddress,
                );
                image =
                  imageCache.get(imgCandidate) ||
                  loadSessionJson(imgCacheKey);
                if (!image) {
                  const resolved = await resolveImageUrl(
                    imgCandidate,
                    uri,
                  ).catch(() => null);
                  image = resolved || httpFromIpfs(imgCandidate);
                  if (image) {
                    imageCache.set(imgCandidate, image);
                    saveSessionJson(imgCacheKey, image);
                  }
                }
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

          const uriLooksTicket = isTicketUri(uri, normalizedTicketBase);
          let metaLooksTicket = looksLikeTicketMeta(meta);
          let metaLooksNft = looksLikeNftMeta(meta);

          if (isTicket && metaLooksNft) {
            isTicket = false;
          }
          if (isTicket && uri && !uriLooksTicket) {
            isTicket = false;
          }

          if (!isTicket && (uriLooksTicket || metaLooksTicket)) {
            try {
              // force-refresh tokenURI after redeem (ticket -> NFT)
              const freshUri = await mainContract.tokenURI(id).catch(() => null);
              if (freshUri && freshUri !== uri) {
                uri = freshUri;
                tokenUriCache.set(tokenMemoryKey, uri);
                saveSessionJson(uriCacheKey, uri);
              }
            } catch {
              // ignore force-refresh failures
            }

            if (uri) {
              const metaMemoryKey = makeMemoryCacheKey(contractCacheAddress, uri);
              const metaCacheKey = makeSessionKey(
                "biggi_meta",
                uri,
                contractCacheAddress,
              );
              meta =
                metadataCache.get(metaMemoryKey) || loadSessionJson(metaCacheKey);
              if (!meta) {
                meta = await readJsonFromURI(uri).catch(() => null);
                if (meta) {
                  metadataCache.set(metaMemoryKey, meta);
                  saveSessionJson(metaCacheKey, meta);
                }
              }
              if (meta) {
                metaUriUsed = uri;
                const imgCandidate = meta.image || meta.image_url;
                if (imgCandidate) {
                  const imgCacheKey = makeSessionKey(
                    "biggi_img",
                    imgCandidate,
                    contractCacheAddress,
                  );
                  image =
                    imageCache.get(imgCandidate) ||
                    loadSessionJson(imgCacheKey);
                  if (!image) {
                    const resolved = await resolveImageUrl(
                      imgCandidate,
                      uri,
                    ).catch(() => null);
                    image = resolved || httpFromIpfs(imgCandidate);
                    if (image) {
                      imageCache.set(imgCandidate, image);
                      saveSessionJson(imgCacheKey, image);
                    }
                  }
                }
              }
            }

            metaLooksTicket = looksLikeTicketMeta(meta);
            metaLooksNft = looksLikeNftMeta(meta);

            if (!isTicket && metaLooksTicket && !metaLooksNft && uri) {
              try {
                const fresh = await readJsonFromURI(uri).catch(() => null);
                if (fresh) {
                  meta = fresh;
                  metaUriUsed = uri;
                  const metaMemoryKey = makeMemoryCacheKey(
                    contractCacheAddress,
                    uri,
                  );
                  metadataCache.set(metaMemoryKey, fresh);
                  saveSessionJson(
                    makeSessionKey("biggi_meta", uri, contractCacheAddress),
                    fresh,
                  );
                  metaLooksTicket = looksLikeTicketMeta(meta);
                  metaLooksNft = looksLikeNftMeta(meta);
                }
              } catch {
                // ignore force meta refresh errors
              }
            }
          }

          if (!isTicket && metaLooksTicket && !metaLooksNft) {
            meta = {
              ...(meta || {}),
              name: `Biggi NFT #${idStr}`,
              description: "Metadata is updating after redeem.",
            };
          } else if (!isTicket && !meta) {
            meta = {
              name: `Biggi NFT #${idStr}`,
              description: "Metadata is updating after redeem.",
            };
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

          if (!isTicket) {
            const finalTicket = looksLikeTicketMeta(meta);
            const finalNft = looksLikeNftMeta(meta);
            if (finalTicket && !finalNft) {
              meta = {
                ...(meta || {}),
                name: `Biggi NFT #${idStr}`,
                description: "Metadata is updating after redeem.",
              };
              image = "/images/Biggi.png";
            } else if (!meta) {
              meta = {
                name: `Biggi NFT #${idStr}`,
                description: "Metadata is updating after redeem.",
              };
              image = image || "/images/Biggi.png";
            }
          }

          if (
            !isTicket &&
            (!image || image === "/images/Biggi.png") &&
            uri &&
            /\.json(\?.*)?$/i.test(String(uri))
          ) {
            image = String(uri).replace(/\.json(\?.*)?$/i, ".png$1");
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
            contractAddress: mainContract?.target || mainContract?.address || null,
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
            contractAddress: mainContract?.target || mainContract?.address || null,
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
  const providedHasNft = React.useMemo(
    () =>
      providedItems.some((item) => item && !item.isTicket && !item.isPending),
    [providedItems],
  );
  const providedHasRichData = React.useMemo(
    () =>
      providedItems.some(
        (item) =>
          item &&
          !item.isTicket &&
          item.image &&
          item.image !== PLACEHOLDER_IMAGE &&
          item.meta &&
          Object.keys(item.meta).length > 0,
      ),
    [providedItems],
  );
  const shouldPreferProvided =
    providedItems.length > 0 && providedHasNft && providedHasRichData;

  const renderedItems = isConnected
    ? shouldPreferProvided
      ? providedItems
      : hydratedItems.length
        ? hydratedItems
        : providedItems
    : [];

  const mainContractAddress = React.useMemo(() => {
    if (!contracts) return ADDR?.MAIN ?? null;
    try {
      // contracts.mainRead returns a contract instance (or a function returning one)
      const maybe = contracts.mainRead?.();
      return maybe?.target ?? maybe?.address ?? ADDR?.MAIN ?? null;
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
      if (
        !isConnected ||
        shouldPreferProvided ||
        !address ||
        !contracts
      )
        return;
      setFetching(true);
      try {
        // contracts may expose factory functions or actual instances
        const main = contracts.mainRead?.();
        const main2 = contracts.main2Read?.();
        const reader = contracts.readerRead?.();

        if (!main && !main2) {
          console.warn("Gallery: main contracts not available");
          if (!cancelled) setHydratedItems([]);
          return;
        }

        const tokensOut = [];

        if (main) {
          const provider = getProviderForContract(main);
          if (!provider || typeof provider.getBlockNumber !== "function") {
            console.warn("Gallery: provider not available on MAIN contract");
          } else {
            const tokenIds = await resolveHeldTokenIds(main, address, reader);
            if (tokenIds.length) {
              const tokens = await hydrateTokens(main, reader, tokenIds);
              tokensOut.push(...tokens);
            }
          }
        }

        if (main2) {
          const provider = getProviderForContract(main2);
          if (!provider || typeof provider.getBlockNumber !== "function") {
            console.warn("Gallery: provider not available on MAIN2 contract");
          } else {
            const tokenIds2 = await resolveHeldTokenIds(main2, address, reader);
            if (tokenIds2.length) {
              const tokens2 = await hydrateTokens(main2, reader, tokenIds2);
              tokensOut.push(...tokens2);
            }
          }
        }

        if (!cancelled) {
          const seen = new Set();
          const deduped = tokensOut.filter((t) => {
            const key = `${String(t?.contractAddress || "").toLowerCase()}:${t?.tokenId}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setHydratedItems(deduped);
        }
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
  }, [
    isConnected,
    shouldPreferProvided,
    address,
    contracts,
    useProvidedOnly,
  ]);

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
        {pagedItems.map((item, index) => {
          const tokenId = toIdString(item);
          const dynamic = dynamicTraitsById[tokenId] || {};
          const key =
            tokenId ||
            `${String(item?.contractAddress || mainContractAddress || "unknown")}:${index}`;
          return (
            <NftCard
              key={key}
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

    </section>
  );
}
