import * as React from "react";
import "./Gallery.css";
import NftCard from "./NftCard";
import { useContracts } from "../providers/ContractsProvider";
import { useWeb3 } from "../providers/Web3Provider";
import { formatEther } from "ethers";
import { ADDR } from "@/shared/utils/addresses.js";
import { DEFAULT_BLOCKS, ROWS_BY_BLOCK } from "../shared/blocks";
import { getProviderForContract } from "../shared/utils/contract";
import { mergeGalleryItem } from "../shared/services/gallery/gallery.merge.js";
import { coerceBool } from "../shared/utils/boolean";
import {
  getAssetIdentity,
  getAssetTokenId,
  isAssetReferenceMatch,
} from "../shared/utils/assetIdentity.js";
import {
  isCanonicalTicketTokenId,
  toMainNftIndexFromTokenId,
} from "../shared/utils/biggiIdIndex";
import {
  queryLogsBatched,
  getSafeDeployBlock,
  isFullHistoryEnabled,
  loadWalletCache,
  saveWalletCache,
} from "../shared/utils/shared";
import {
  readJsonFromURI,
  resolveImageUrl,
  httpFromIpfs,
} from "../services/ipfs.js";

const PAGE_SIZE_DESKTOP = 12;
const PAGE_SIZE_MOBILE = 6;
const TOP_HIGHLIGHT_MS = 70_000;

// Smaller batch size to reduce RPC rejections on public endpoints.
const LOGS_BATCH = 300;
const CHAIN_FETCH_TIMEOUT_MS = (() => {
  const configured = Number(
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_GALLERY_CHAIN_FETCH_TIMEOUT_MS
      : 0,
  );
  if (Number.isFinite(configured) && configured > 0) {
    return Math.trunc(configured);
  }
  return 45_000;
})();
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
    String(contractAddress || "")
      .trim()
      .toLowerCase() || getGalleryContractCacheAddress();
  return `${prefix}:${SESSION_CACHE_VERSION}:${chainId}:${
    contract || "main"
  }:${encodeURIComponent(String(value || ""))}`;
};
const makeMemoryCacheKey = (contractAddress, value) =>
  `${String(contractAddress || "main").toLowerCase()}:${String(value || "")}`;

const RARITY_TIERS = ["legendary", "epic", "rare", "uncommon", "common"];
const RARITY_TIER_RANK = {
  legendary: 1,
  epic: 2,
  rare: 3,
  uncommon: 4,
  common: 5,
};
const BLOCK_NAME_SET = new Set(DEFAULT_BLOCKS);
const normalizeBlockName = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (BLOCK_NAME_SET.has(upper)) return upper;
  for (const name of DEFAULT_BLOCKS) {
    if (upper.includes(name)) return name;
  }
  return null;
};

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

const withTimeout = async (promise, timeoutMs, label = "task") => {
  const ms = Number(timeoutMs) || 0;
  if (ms <= 0) return promise;

  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const looksLikeTicketMeta = (meta) => {
  if (!meta) return false;
  const name = String(meta?.name || "").toLowerCase();
  const desc = String(meta?.description || "").toLowerCase();
  return name.includes("ticket") || desc.includes("ticket");
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

const getAttributes = (meta) =>
  Array.isArray(meta?.attributes) ? meta.attributes : [];

const getAttrValue = (attrs, keys) => {
  if (!attrs.length) return null;
  const keySet = new Set(keys.map((k) => String(k).toLowerCase()));
  const hit = attrs.find((attr) =>
    keySet.has(String(attr?.trait_type ?? "").toLowerCase()),
  );
  return hit?.value ?? null;
};

const deriveRarityInfo = (item) => {
  const meta = item?.meta || null;
  const attrs = getAttributes(meta);

  const explicitRarityRaw = getAttrValue(attrs, ["rarity", "tier"]);
  const explicitRarity = explicitRarityRaw
    ? String(explicitRarityRaw).toLowerCase()
    : null;
  const normalizedRarity = RARITY_TIERS.includes(explicitRarity)
    ? explicitRarity
    : null;

  const blockValue = getAttrValue(attrs, [
    "block/eye color",
    "block",
    "eye color",
    "linked block",
    "block color",
  ]);
  const blockName = normalizeBlockName(blockValue);
  const blockRank =
    blockName && ROWS_BY_BLOCK?.[blockName]
      ? Number(ROWS_BY_BLOCK[blockName])
      : null;

  const rarity =
    item?.rarity ??
    normalizedRarity ??
    (blockRank
      ? blockRank <= 2
        ? "legendary"
        : blockRank <= 4
          ? "epic"
          : blockRank <= 6
            ? "rare"
            : blockRank <= 8
              ? "uncommon"
              : "common"
      : null);

  const rarityRank =
    item?.rarityRank ??
    blockRank ??
    (rarity && RARITY_TIER_RANK[rarity] ? RARITY_TIER_RANK[rarity] : null);

  return { rarity, rarityRank, blockName };
};

const classifyGalleryItem = (item, maxSupplyHint = 550) => {
  if (!item) return "unknown";
  if (item.isPending) return "ticket";

  const ticketFlag = item?.isTicket;
  if (ticketFlag === false) return "nft";
  if (ticketFlag === true) return "ticket";

  const tokenId = String(item?.tokenId ?? item?.id ?? "").trim();
  if (tokenId) {
    const mainIdx = toMainNftIndexFromTokenId(tokenId, {
      maxSupply: maxSupplyHint,
      allowLegacy: true,
    });
    if (mainIdx != null) return "nft";
    if (isCanonicalTicketTokenId(tokenId)) return "ticket";
  }

  const meta = item?.meta;
  const metaLooksNft = looksLikeNftMeta(meta);
  if (metaLooksNft) return "nft";
  const metaLooksTicket = looksLikeTicketMeta(meta);
  if (metaLooksTicket && !metaLooksNft) return "ticket";

  return "unknown";
};

const isTicketLike = (item, maxSupplyHint = 550) =>
  classifyGalleryItem(item, maxSupplyHint) === "ticket";

function toIdString(item) {
  return getAssetTokenId(item);
}

function toTokenIdBigInt(value) {
  try {
    if (value == null) return null;
    if (typeof value === "bigint") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      return BigInt(Math.trunc(value));
    }
    if (typeof value === "string") {
      const s = value.trim();
      if (!s) return null;
      if (/^\d+$/.test(s)) return BigInt(s);
      return null;
    }
    if (typeof value?.toString === "function") {
      return toTokenIdBigInt(value.toString());
    }
  } catch {
    return null;
  }
  return null;
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

  // 3) ERC-721 Enumerable fallback (faster than full log scans when available)
  try {
    if (
      typeof mainContract.balanceOf === "function" &&
      typeof mainContract.tokenOfOwnerByIndex === "function"
    ) {
      const balanceRaw = await withTimeout(
        mainContract.balanceOf(address),
        8_000,
        "gallery balanceOf",
      );
      const balanceNum = Number(balanceRaw?.toString?.() ?? balanceRaw ?? 0);
      if (Number.isFinite(balanceNum) && balanceNum >= 0) {
        const balance = Math.trunc(balanceNum);
        if (balance === 0) return [];
        const upper = Math.min(balance, 2_000);
        const out = [];
        const chunkSize = Math.max(4, getParallelism());
        for (let i = 0; i < upper; i += chunkSize) {
          const idxs = Array.from(
            { length: Math.min(chunkSize, upper - i) },
            (_, off) => i + off,
          );
          const part = await Promise.all(
            idxs.map(async (idx) => {
              try {
                return await withTimeout(
                  mainContract
                    .tokenOfOwnerByIndex(address, idx)
                    .catch(() => null),
                  8_000,
                  "gallery tokenOfOwnerByIndex",
                );
              } catch {
                return null;
              }
            }),
          );
          for (const id of part) {
            const parsed = coerceBigIntId(id);
            if (parsed != null) out.push(parsed);
          }
        }
        if (out.length) return saveIds(out);
      }
    }
  } catch (e) {
    console.warn(
      "balanceOf/tokenOfOwnerByIndex fallback failed, falling back to logs",
      e,
    );
  }

  // 4) Fallback přes logy (robustní, ale pomalejší)
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
    const opts = isFullHistoryEnabled() ? { fullHistory: true } : undefined;
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
          uri =
            tokenUriCache.get(tokenMemoryKey) || loadSessionJson(uriCacheKey);
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
                  imageCache.get(imgCandidate) || loadSessionJson(imgCacheKey);
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
                    isTicket = coerceBool(res);
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
                isTicket = coerceBool(res);
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
              const freshUri = await mainContract
                .tokenURI(id)
                .catch(() => null);
              if (freshUri && freshUri !== uri) {
                uri = freshUri;
                tokenUriCache.set(tokenMemoryKey, uri);
                saveSessionJson(uriCacheKey, uri);
              }
            } catch {
              // ignore force-refresh failures
            }

            if (uri) {
              const metaMemoryKey = makeMemoryCacheKey(
                contractCacheAddress,
                uri,
              );
              const metaCacheKey = makeSessionKey(
                "biggi_meta",
                uri,
                contractCacheAddress,
              );
              meta =
                metadataCache.get(metaMemoryKey) ||
                loadSessionJson(metaCacheKey);
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
              description: "Metadata is updating on-chain.",
            };
          } else if (!isTicket && !meta) {
            meta = {
              name: `Biggi NFT #${idStr}`,
              description: "Metadata is updating on-chain.",
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
                description: "Metadata is updating on-chain.",
              };
              image = "/images/Biggi.png";
            } else if (!meta) {
              meta = {
                name: `Biggi NFT #${idStr}`,
                description: "Metadata is updating on-chain.",
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
                const nftIndex = toMainNftIndexFromTokenId(id, {
                  maxSupply: 550,
                  allowLegacy: true,
                });
                const res =
                  nftIndex == null
                    ? null
                    : await reader.getMintData(nftIndex).catch(() => null);
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

          if (!mint && typeof mainContract?.getMintData === "function") {
            const nftIndex = toMainNftIndexFromTokenId(id, {
              maxSupply: 550,
              allowLegacy: true,
            });
            if (nftIndex != null) {
              const res = await mainContract
                .getMintData(nftIndex)
                .catch(() => null);
              if (res) {
                mint = {
                  ticketPrice: Number(formatEther(res?.[0] ?? 0)),
                  blockPrice: Number(formatEther(res?.[1] ?? 0)),
                  finalPrice: Number(formatEther(res?.[2] ?? 0)),
                };
              }
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
            contractAddress:
              mainContract?.target || mainContract?.address || null,
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
            contractAddress:
              mainContract?.target || mainContract?.address || null,
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
  loading = false,
  liveTicketPrice = null,
  activeTicketChapterId = null,
  activeTicketChapterCount = 0,
  dynamicTraitsById = {},
  topFirstId = null,
  onOpenDetails,
  onZoom,
  compact = false,
  useProvidedOnly = false,
}) {
  // fallback na adresu z kontextu peněženky
  const { account: ctxAccount, address: ctxAddressLegacy } = (() => {
    try {
      return useWeb3();
    } catch {
      return { account: "", address: "" };
    }
  })();
  const ctxAddress = ctxAccount || ctxAddressLegacy || "";

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
  const [ticketPage, setTicketPage] = React.useState(0);
  const [highlightId, setHighlightId] = React.useState("");
  const highlightTimerRef = React.useRef(null);
  const topFirstResetRef = React.useRef("");
  const topFirstVisibleRef = React.useRef({ id: "", visible: false });
  const [pinnedTopId, setPinnedTopId] = React.useState("");
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 768px)").matches
      : false,
  );

  const address =
    addressProp || ctxAddress ? String(addressProp || ctxAddress) : "";
  const isConnected = Boolean(address);

  const providedItems = Array.isArray(itemsProp) ? itemsProp : [];
  const maxSupplyHint = 550;
  const debugEnabled = Boolean(
    typeof import.meta !== "undefined" && import.meta.env?.DEV,
  );
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
  const providedHasIncomplete = React.useMemo(
    () =>
      providedItems.some((item) => {
        if (!item) return true;
        if (!item.meta || Object.keys(item.meta).length === 0) return true;
        if (!item.image || item.image === PLACEHOLDER_IMAGE) return true;
        if (item.isPending) return true;
        return false;
      }),
    [providedItems],
  );

  const mergedItems = React.useMemo(() => {
    if (!providedItems.length && !hydratedItems.length) return [];
    if (!providedItems.length) return hydratedItems;
    if (!hydratedItems.length) return providedItems;

    const map = new Map();
    for (const item of providedItems) {
      const key = getAssetIdentity(item);
      if (!key) continue;
      map.set(key, item);
    }
    for (const item of hydratedItems) {
      const key = getAssetIdentity(item);
      if (!key) continue;
      const prev = map.get(key);
      map.set(key, mergeGalleryItem(prev, item));
    }
    return Array.from(map.values());
  }, [providedItems, hydratedItems]);

  const renderedItems = isConnected ? mergedItems : [];

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
        (shouldPreferProvided && !providedHasIncomplete) ||
        !address ||
        !contracts
      )
        return;
      setFetching(true);
      try {
        const reader = contracts.readerRead?.();
        let collectionEntries = [];
        try {
          collectionEntries = contracts.chapterCollectionsRead?.() || [];
        } catch {
          collectionEntries = [];
        }
        if (!collectionEntries.length) {
          const main = contracts.mainRead?.();
          const main2 = contracts.main2Read?.();
          collectionEntries = [
            { contract: main, label: "MAIN", chapterId: 1 },
            { contract: main2, label: "MAIN2", chapterId: 1 },
          ].filter((entry) => entry.contract);
        }

        if (!collectionEntries.length) {
          console.warn("Gallery: main contracts not available");
          if (!cancelled) setHydratedItems([]);
          return;
        }

        const loadForContract = async (contract, label, contractReader) => {
          if (!contract) return [];
          const provider = getProviderForContract(contract);
          if (!provider || typeof provider.getBlockNumber !== "function") {
            console.warn(
              `Gallery: provider not available on ${label} contract`,
            );
            return [];
          }
          return withTimeout(
            (async () => {
              const tokenIds = await resolveHeldTokenIds(
                contract,
                address,
                contractReader,
              );
              if (!tokenIds.length) return [];
              return hydrateTokens(contract, contractReader, tokenIds);
            })(),
            CHAIN_FETCH_TIMEOUT_MS,
            `gallery ${String(label || "").toLowerCase()} fetch`,
          );
        };

        const labels = collectionEntries.map(
          (entry) =>
            entry.label ||
            `CHAPTER_${entry.chapterId}_${String(entry.collectionType || "collection").toUpperCase()}`,
        );
        const settled = [];
        for (let offset = 0; offset < collectionEntries.length; offset += 2) {
          const chunk = collectionEntries.slice(offset, offset + 2);
          const chunkResults = await Promise.allSettled(
            chunk.map((entry, index) =>
              loadForContract(
                entry.contract,
                labels[offset + index],
                entry.chapterId === 1 ? reader : null,
              ),
            ),
          );
          settled.push(...chunkResults);
        }

        const tokensOut = [];
        let hadFailures = false;
        let hadTimeout = false;
        settled.forEach((result, idx) => {
          if (result.status === "fulfilled") {
            if (Array.isArray(result.value) && result.value.length) {
              tokensOut.push(...result.value);
            }
            return;
          }
          hadFailures = true;
          const reason = result.reason;
          const message = String(reason?.message || reason || "");
          const tag = labels[idx] || `#${idx + 1}`;
          if (message.includes("timed out")) {
            hadTimeout = true;
            console.warn(`Gallery ${tag} fetch timed out`, reason);
          } else {
            console.error(`Gallery ${tag} fetch failed`, reason);
          }
        });

        if (!cancelled) {
          const seen = new Set();
          const deduped = tokensOut.filter((t) => {
            const key = `${String(t?.contractAddress || "").toLowerCase()}:${t?.tokenId}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          // Keep last successful data when all concurrent reads fail by timeout.
          if (deduped.length || (!hadFailures && !hadTimeout)) {
            setHydratedItems(deduped);
          }
        }
      } catch (err) {
        const isTimeout = String(err?.message || "").includes("timed out");
        if (isTimeout) {
          console.warn(
            "Gallery chain fetch timed out; keeping previous data",
            err,
          );
        } else {
          console.error("Gallery chain fetch failed", err);
        }
        if (!cancelled && !isTimeout) {
          setHydratedItems([]);
        }
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
    providedHasIncomplete,
    address,
    contracts,
    useProvidedOnly,
  ]);

  const pageSize = isMobile || compact ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;

  const ticketItems = React.useMemo(() => {
    const list = renderedItems.filter((item) =>
      isTicketLike(item, maxSupplyHint),
    );
    if (!list.length) return list;
    const topId = topFirstId != null ? String(topFirstId) : "";
    const sorted = [...list];
    sorted.sort((a, b) => {
      const aTop = topId && isAssetReferenceMatch(a, topId);
      const bTop = topId && isAssetReferenceMatch(b, topId);
      if (aTop && !bTop) return -1;
      if (bTop && !aTop) return 1;
      const aPending = Boolean(a?.isPending);
      const bPending = Boolean(b?.isPending);
      if (aPending !== bPending) return aPending ? -1 : 1;
      const idA = toTokenIdBigInt(a?.tokenId ?? a?.id);
      const idB = toTokenIdBigInt(b?.tokenId ?? b?.id);
      if (idA == null && idB == null) return 0;
      if (idA == null) return 1;
      if (idB == null) return -1;
      if (idA === idB) return 0;
      return idA > idB ? -1 : 1;
    });
    return sorted;
  }, [renderedItems, topFirstId, maxSupplyHint]);

  const nonTicketItemsSource = React.useMemo(
    () => renderedItems.filter((item) => !isTicketLike(item, maxSupplyHint)),
    [renderedItems, maxSupplyHint],
  );

  React.useEffect(() => {
    if (!isConnected || !debugEnabled) return;
    console.info("Gallery:render summary", {
      wallet: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "",
      providedItems: providedItems.length,
      renderedItems: renderedItems.length,
      nftItems: nonTicketItemsSource.length,
      ticketItems: ticketItems.length,
      sampleTokenIds: renderedItems
        .slice(0, 12)
        .map((it) => String(it?.tokenId ?? it?.id ?? "").trim())
        .filter(Boolean),
    });
  }, [
    debugEnabled,
    isConnected,
    address,
    providedItems,
    renderedItems,
    nonTicketItemsSource,
    ticketItems,
  ]);

  const processedItems = React.useMemo(() => {
    let list = nonTicketItemsSource;
    const topId = pinnedTopId != null ? String(pinnedTopId) : "";
    if (filterRarity !== "all") {
      const target = String(filterRarity).toLowerCase();
      list = list.filter(
        (item) =>
          String(deriveRarityInfo(item)?.rarity ?? "").toLowerCase() === target,
      );
    }
    const sorted = [...list];
    if (sortBy === "default") {
      sorted.sort((a, b) => {
        const aPending = Boolean(a?.isPending);
        const bPending = Boolean(b?.isPending);
        if (aPending !== bPending) return aPending ? -1 : 1;
        const idA = toTokenIdBigInt(a?.tokenId ?? a?.id);
        const idB = toTokenIdBigInt(b?.tokenId ?? b?.id);
        if (idA == null && idB == null) return 0;
        if (idA == null) return 1;
        if (idB == null) return -1;
        if (idA === idB) return 0;
        return idA > idB ? -1 : 1;
      });
    } else if (sortBy === "name") {
      sorted.sort((a, b) => {
        const nameA = a?.name || a?.meta?.name || `#${a?.tokenId ?? ""}`;
        const nameB = b?.name || b?.meta?.name || `#${b?.tokenId ?? ""}`;
        return nameA.localeCompare(nameB);
      });
    } else if (sortBy === "rarity") {
      sorted.sort((a, b) => {
        const rankA =
          deriveRarityInfo(a)?.rarityRank ?? Number.MAX_SAFE_INTEGER;
        const rankB =
          deriveRarityInfo(b)?.rarityRank ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        const idA = toTokenIdBigInt(a?.tokenId ?? a?.id);
        const idB = toTokenIdBigInt(b?.tokenId ?? b?.id);
        if (idA == null && idB == null) return 0;
        if (idA == null) return 1;
        if (idB == null) return -1;
        if (idA === idB) return 0;
        return idA > idB ? -1 : 1;
      });
    } else if (sortBy === "token") {
      sorted.sort((a, b) => {
        const idA = toTokenIdBigInt(a?.tokenId ?? a?.id);
        const idB = toTokenIdBigInt(b?.tokenId ?? b?.id);
        if (idA == null && idB == null) return 0;
        if (idA == null) return 1;
        if (idB == null) return -1;
        if (idA === idB) return 0;
        return idA < idB ? -1 : 1;
      });
    }
    if (topId) {
      const topIndex = sorted.findIndex((item) =>
        isAssetReferenceMatch(item, topId, mainContractAddress),
      );
      if (topIndex > 0) {
        const [topItem] = sorted.splice(topIndex, 1);
        sorted.unshift(topItem);
      }
    }
    return sorted;
  }, [
    nonTicketItemsSource,
    filterRarity,
    sortBy,
    pinnedTopId,
    mainContractAddress,
  ]);

  React.useEffect(() => {
    setPage(0);
  }, [sortBy, filterRarity]);

  React.useEffect(() => {
    const id = topFirstId != null ? String(topFirstId) : "";
    if (!id) return;
    if (topFirstResetRef.current === id) return;
    topFirstResetRef.current = id;
    setPage(0);
    setSortBy("default");
    setFilterRarity("all");
  }, [topFirstId]);

  React.useEffect(() => {
    const id = topFirstId != null ? String(topFirstId) : "";
    if (!id) {
      topFirstVisibleRef.current = { id: "", visible: false };
      setPinnedTopId("");
      return;
    }
    const isVisible = processedItems.some((item) =>
      isAssetReferenceMatch(item, id, mainContractAddress),
    );
    const prev = topFirstVisibleRef.current;
    const becameVisible = isVisible && (prev.id !== id || !prev.visible);
    topFirstVisibleRef.current = { id, visible: isVisible };
    if (becameVisible) {
      setHighlightId(id);
      setPinnedTopId(id);
    }
  }, [topFirstId, processedItems, mainContractAddress]);

  React.useEffect(() => {
    if (!highlightId) return;
    const activeId = String(highlightId);
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightId((prev) => (String(prev) === activeId ? "" : prev));
      highlightTimerRef.current = null;
    }, TOP_HIGHLIGHT_MS);
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, [highlightId]);

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
  const totalNfts = nonTicketItemsSource.length;
  const totalTickets = ticketItems.length;
  const ticketPageSize =
    compact || isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;
  const totalTicketPages = Math.max(
    1,
    Math.ceil(ticketItems.length / ticketPageSize),
  );
  const pagedTicketItems = React.useMemo(() => {
    const start = ticketPage * ticketPageSize;
    return ticketItems.slice(start, start + ticketPageSize);
  }, [ticketItems, ticketPage, ticketPageSize]);

  React.useEffect(() => {
    setTicketPage((previous) => Math.min(previous, totalTicketPages - 1));
  }, [totalTicketPages]);
  const pendingTickets = React.useMemo(
    () => ticketItems.reduce((sum, item) => sum + (item?.isPending ? 1 : 0), 0),
    [ticketItems],
  );
  const redeemableTickets = React.useMemo(() => {
    if (activeTicketChapterCount !== 1 || activeTicketChapterId == null)
      return 0;
    return ticketItems.reduce(
      (sum, item) =>
        sum +
        (!item?.isPending && Number(item?.chapterId) === activeTicketChapterId
          ? 1
          : 0),
      0,
    );
  }, [ticketItems, activeTicketChapterCount, activeTicketChapterId]);
  const showSummaryLoading =
    (fetching || loading) && renderedItems.length === 0;

  const rarityCounts = React.useMemo(() => {
    const counts = {};
    nonTicketItemsSource.forEach((item) => {
      const rarity = deriveRarityInfo(item)?.rarity ?? "unknown";
      counts[rarity] = (counts[rarity] ?? 0) + 1;
    });
    return counts;
  }, [nonTicketItemsSource]);
  const rarityRows = React.useMemo(
    () =>
      Object.entries(rarityCounts).sort(([a], [b]) => {
        const rankA = RARITY_TIER_RANK[a] ?? Number.MAX_SAFE_INTEGER;
        const rankB = RARITY_TIER_RANK[b] ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return a.localeCompare(b);
      }),
    [rarityCounts],
  );
  const renderCard = (item, index, inMainGrid = false) => {
    const { rarity, rarityRank } = deriveRarityInfo(item);
    const enriched =
      (item?.rarity == null && rarity != null) ||
      (item?.rarityRank == null && rarityRank != null)
        ? {
            ...item,
            rarity: item?.rarity ?? rarity,
            rarityRank: item?.rarityRank ?? rarityRank,
          }
        : item;
    const tokenId = toIdString(item);
    const assetKey = getAssetIdentity(item, mainContractAddress);
    const dynamic =
      dynamicTraitsById[assetKey] || dynamicTraitsById[tokenId] || {};
    const isHighlight =
      highlightId &&
      tokenId &&
      isAssetReferenceMatch(item, highlightId, mainContractAddress);
    const isPromoted =
      inMainGrid && page === 0 && index === 0 && Boolean(isHighlight);
    const key = assetKey || `${mainContractAddress || "unknown"}:${index}`;
    return (
      <NftCard
        key={key}
        nft={enriched}
        liveTicketPrice={liveTicketPrice}
        activeTicketChapterId={activeTicketChapterId}
        activeTicketChapterCount={activeTicketChapterCount}
        dynamicTraits={dynamic}
        onOpenDetails={onOpenDetails}
        onZoom={onZoom}
        fallbackContractAddress={mainContractAddress}
        highlight={Boolean(isHighlight)}
        promoted={Boolean(isPromoted)}
      />
    );
  };

  return (
    <section className="gallery">
      <header className="gallery__header">
        <div className="gallery__header-main">
          <div className="gallery__header-meta">
            <span
              className={`gallery__connection ${isConnected ? "is-connected" : "is-disconnected"}`}
            >
              <span className="gallery__connection-dot" aria-hidden="true" />
              {isConnected ? "Wallet connected" : "Wallet disconnected"}
            </span>
          </div>
          <h2 className="gallery__title">My Biggi COLLECTION</h2>
          <p className="gallery__subtitle">
            NFTs and tickets owned by the connected wallet on Polygon mainnet.
          </p>
        </div>
        <div className="gallery__header-actions-shell">
          <div className="gallery__header-actions-title">Gallery controls</div>
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
        </div>
      </header>

      <div className="gallery__summary">
        <div className="gallery__summary-item gallery__summary-item--metric">
          <span>Total Assets</span>
          <strong>
            {showSummaryLoading ? (
              <span className="gallery__loading-label">Loading...</span>
            ) : (
              totalOwned
            )}
          </strong>
        </div>
        <div className="gallery__summary-item gallery__summary-item--nft gallery__summary-item--metric">
          <span>NFTs</span>
          <strong>
            {showSummaryLoading ? (
              <span className="gallery__loading-label">Loading...</span>
            ) : (
              totalNfts
            )}
          </strong>
          <small>
            {showSummaryLoading
              ? "Fetching metadata..."
              : filterRarity === "all"
                ? "All rarities"
                : `Filter: ${filterRarity}`}
          </small>
        </div>
        <div className="gallery__summary-item gallery__summary-item--ticket gallery__summary-item--metric">
          <span>Tickets</span>
          <strong>
            {showSummaryLoading ? (
              <span className="gallery__loading-label">Loading...</span>
            ) : (
              totalTickets
            )}
          </strong>
          <small>
            {showSummaryLoading
              ? "Checking status..."
              : activeTicketChapterCount === 0
                ? "No chapter is active"
                : activeTicketChapterCount > 1
                  ? "Chapter configuration conflict"
                  : totalTickets > 0
                    ? `${redeemableTickets} redeemable | ${pendingTickets} pending`
                    : "No tickets in wallet"}
          </small>
        </div>
        <div className="gallery__summary-item">
          <span>Rarities</span>
          {rarityRows.length ? (
            <div className="gallery__rarity-list">
              {rarityRows.map(([rarity, count]) => (
                <span
                  key={rarity}
                  className={`gallery__rarity-pill gallery__rarity-pill--${rarity}`}
                >
                  {rarity}: {count}
                </span>
              ))}
            </div>
          ) : (
            <strong>--</strong>
          )}
        </div>
      </div>

      {ticketItems.length > 0 && (
        <section className="gallery__ticket-panel" aria-label="Wallet tickets">
          <div className="gallery__ticket-head">
            <h3>Tickets in wallet</h3>
            <span>
              {showSummaryLoading
                ? "Loading..."
                : `${totalTickets} total / page ${ticketPage + 1}/${totalTicketPages}`}
            </span>
          </div>
          <div className="gallery__grid gallery__grid--tickets">
            {pagedTicketItems.map((item, index) =>
              renderCard(item, index, false),
            )}
          </div>
          {totalTicketPages > 1 ? (
            <footer className="gallery__pager">
              <button
                type="button"
                className="gallery__pager-btn"
                onClick={() => setTicketPage((value) => Math.max(0, value - 1))}
                disabled={ticketPage === 0}
              >
                Prev
              </button>
              <span className="gallery__pager-status">
                Page {ticketPage + 1} of {totalTicketPages}
              </span>
              <button
                type="button"
                className="gallery__pager-btn"
                onClick={() =>
                  setTicketPage((value) =>
                    Math.min(totalTicketPages - 1, value + 1),
                  )
                }
                disabled={ticketPage >= totalTicketPages - 1}
              >
                Next
              </button>
            </footer>
          ) : null}
        </section>
      )}

      <div
        className={`gallery__grid${showSummaryLoading ? " is-loading" : ""}`}
      >
        {!isConnected && (
          <div className="gallery__placeholder">
            <h3>Connect Wallet</h3>
            <p>Connect MetaMask to load your Biggi NFTs.</p>
          </div>
        )}
        {isConnected && showSummaryLoading && (
          <div className="gallery__placeholder">Loading COLLECTION...</div>
        )}
        {isConnected && !showSummaryLoading && renderedItems.length === 0 && (
          <div className="gallery__placeholder">
            <h3>No NFTs detected</h3>
            <p>
              Mint a Biggi NFT or connect a different wallet to see your
              COLLECTION here.
            </p>
          </div>
        )}
        {isConnected &&
          !showSummaryLoading &&
          renderedItems.length > 0 &&
          nonTicketItemsSource.length === 0 &&
          ticketItems.length > 0 && (
            <div className="gallery__placeholder">
              <h3>No revealed NFTs yet</h3>
              <p>
                Wallet data loaded. Tickets become redeemable when their chapter
                is active.
              </p>
            </div>
          )}
        {isConnected &&
          !showSummaryLoading &&
          renderedItems.length > 0 &&
          nonTicketItemsSource.length > 0 &&
          processedItems.length === 0 && (
            <div className="gallery__placeholder">
              <h3>No NFTs match current filter</h3>
              <p>
                Clear rarity filters to display all available NFTs in this
                wallet.
              </p>
            </div>
          )}
        {pagedItems.map((item, index) => renderCard(item, index, true))}
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
