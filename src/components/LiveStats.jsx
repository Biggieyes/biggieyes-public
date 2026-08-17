// src/components/LiveStats.jsx
import * as React from "react";
import {
  BrowserProvider,
  Contract,
  ZeroAddress,
  formatEther,
  formatUnits,
} from "ethers";
import { BiggiLpPriceFeed } from "@/config/abi/index.js";
import {
  getTokenREWARDSRO,
  getDistributorRO,
  getROProvider,
  getReaderRO,
  getReadOnlyMain,
  getReadOnlyChapterMain,
  getReadOnlyChapterMain2,
  resetROProvider,
  getPairRO,
  getReadOnlyLiquidityContract,
  getTokenRO,
  getInjectedProvider,
  ADDR,
} from "@/shared/utils/contract";
import { CORE_CHAPTERS } from "@/shared/utils/addresses.js";
import { toMainNftIndexFromTokenId } from "@/shared/utils/biggiIdIndex";
import {
  getPreferredRpc,
  getRpcUrls,
  markRpcRateLimited,
  setPreferredRpc,
} from "@/shared/utils/rpcConfig";
import { isRateLimitedRpcError } from "@/shared/utils/rpcErrors";
import { fetchDistributorSnapshot } from "@/shared/services/tokenomics/distributor.reader";
import { httpFromIpfs, readJsonFromURI, resolveImageUrl } from "@/shared/services/ipfs";
import { buildBlockImagePath } from "@/shared/utils/images";
import { DEFAULT_BLOCKS, BASE_PRICES } from "@/shared/blocks";
import { getCachedPriceAttrs } from "@/shared/utils/metadata";
import ModalPortal from "./common/ModalPortal";
import WeeklyCountdown from "./WeeklyCountdown";
import useWeeklyCountdown from "../hooks/useWeeklyCountdown";
import {
  buildLiveStatsAssetIdentity,
  selectLiveStatsImage,
} from "./liveStatsImageState.js";
import "./LiveStatsPools.css";
import "./InfoTables.css";

const OKLINK_BASE = "https://www.oklink.com/polygon/address/";

const BlocksWidget = React.lazy(() => import("./BlocksWidget"));
const BackgroundsWidget = React.lazy(() => import("./BackgroundsWidget"));
const LiveChatLoadError = () => (
  <section className="live-chat-panel">
    <div className="live-chat-panel__error">
      Live Chat module failed to load. Refresh the page or restart `dev:netlify`.
    </div>
  </section>
);
const LiveChatPanel = React.lazy(() =>
  import("./LiveChatPanel").catch((error) => {
    console.error("LiveStats: failed to load LiveChatPanel module", error);
    return { default: LiveChatLoadError };
  }),
);

// ---- minimal ABI for write ops ----
const TOKEN_REWARDS_MIN_ABI = [
  "function claim(uint256[] tokenIds) external",
  "function getBlockWeights() view returns(uint8[11])",
  "function unitReward() view returns(uint256)",
  "function tokenMeta() view returns(string name_,string symbol_,uint8 decimals_)",
];

const BACKGROUND_BONUSES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const COLLECTION_INFO_ROWS = [
  {
    concept: "Total minted / Tickets minted",
    detail:
      "Core supply counters for revealed NFTs and mint tickets in the current collection.",
    tone: "mint",
  },
  {
    concept: "Ticket price / Reward pool / Mint volume",
    detail:
      "Live economic values in POL that summarize ticket cost, reward funding, and aggregate mint flow.",
    tone: "core",
  },
  {
    concept: "Avg / Highest / Lowest block price",
    detail:
      "Distribution snapshot of current block prices derived from on-chain block pricing state.",
    tone: "live",
  },
  {
    concept: "Blocks minted / BG minted",
    detail:
      "Counts of minted outcomes by eye-block and by background dimension used in pricing mechanics.",
    tone: "link",
  },
  {
    concept: "Block prices table",
    detail:
      "Per-block comparison of Base vs Live price and Delta to make dynamic price movement transparent.",
    tone: "base",
  },
  {
    concept: "Background bonuses table",
    detail:
      "Per-background minted counts, one-time bonus percentage, and corresponding block price delta.",
    tone: "bonus",
  },
  {
    concept: "My weekly BIGGI",
    detail:
      "Wallet-specific estimate of weekly BIGGI units from owned NFTs and current on-chain reward settings.",
    tone: "supply",
  },
];

// ===== ethers v5/v6 safe helpers =====
const isBigNumber = (value) =>
  Boolean(value && typeof value === "object" && value._isBigNumber);

const toBigNumberish = (value) => {
  if (value == null) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") return value;
  if (isBigNumber(value)) return value.toString();
  if (typeof value?.toString === "function") return value.toString();
  return 0n;
};

const _formatUnits = (val, dec) => {
  try {
    return formatUnits(toBigNumberish(val), dec);
  } catch {
    return "0";
  }
};
const _formatEther = (val) => {
  try {
    return formatEther(val);
  } catch {
    try {
      return formatEther(toBigNumberish(val));
    } catch {
      if (typeof val === "bigint") return (Number(val) / 1e18).toString();
      return "0";
    }
  }
};
const _bn = (v) => {
  try {
    return BigInt(v);
  } catch {
    try {
      return BigInt(v);
    } catch {
      return 0n;
    }
  }
};
const _mul = (a, b) => _bn(a) * _bn(b);

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

const traitValueFromMeta = (meta, names) => {
  const attrs = Array.isArray(meta?.attributes) ? meta.attributes : [];
  for (const attr of attrs) {
    const key = String(attr?.trait_type || "").toLowerCase();
    if (names.includes(key)) {
      const value = String(attr?.value ?? "").trim();
      if (value) return value;
    }
  }
  return "";
};

const parsePriceNumber = (value) => {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? value : null;
  }
  if (typeof value === "bigint") {
    const formatted = Number(_formatEther(value));
    return Number.isFinite(formatted) && formatted > 0 ? formatted : null;
  }
  if (isBigNumber(value)) {
    const formatted = Number(_formatEther(value));
    return Number.isFinite(formatted) && formatted > 0 ? formatted : null;
  }
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;
    if (/^\d{10,}$/.test(raw)) {
      const formatted = Number(_formatEther(raw));
      if (Number.isFinite(formatted) && formatted > 0) return formatted;
    }
    const match = raw.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  if (typeof value?.toString === "function") {
    return parsePriceNumber(value.toString());
  }
  return null;
};

const readPriceFromMeta = (meta, traitNames = [], directValues = []) => {
  const normalizedNames = traitNames.map((name) =>
    String(name || "").trim().toLowerCase(),
  );
  const attrValue = traitValueFromMeta(meta, normalizedNames);
  const fromAttr = parsePriceNumber(attrValue);
  if (fromAttr != null) return fromAttr;

  for (const candidate of directValues) {
    const parsed = parsePriceNumber(candidate);
    if (parsed != null) return parsed;
  }
  return null;
};

const toDisplayLastMinted = (payload) => {
  const tokenId = String(payload?.tokenId ?? payload?.id ?? "").trim() || "-";
  const image = String(payload?.image || "").trim();
  const blockName = String(payload?.blockName || "").trim() || "-";
  const backgroundName = String(payload?.backgroundName || "").trim() || "-";
  const contractAddress = String(payload?.contractAddress || "")
    .trim()
    .toLowerCase();
  const chapterId = Number(payload?.chapterId || 0) || null;
  return {
    tokenId,
    image,
    blockName,
    backgroundName,
    contractAddress,
    chapterId,
  };
};

const normalizeLiveStatsImage = (raw) => {
  const input = String(raw || "").trim();
  if (!input) return "";
  try {
    const normalized = httpFromIpfs(input);
    return String(normalized || input).trim();
  } catch {
    return input;
  }
};

const BACKGROUND_CODE_BY_NAME = Object.freeze({
  ORANGE: "O",
  BLACK: "B",
  WHITE: "W",
  BROWN: "BR",
  BLUE: "BL",
  GREEN: "G",
  VIOLET: "V",
  RED: "R",
  PINK: "P",
  RAINBOW: "RB",
});

const BLOCK_IMAGE_BASES = Object.freeze({
  ORANGE:
    "https://biggieyes.mypinata.cloud/ipfs/bafybeihs2zmll4beazspdqf5cr4hufmcqlby2cdwkwjfd4kyhl2rp27ohq/",
  BLACK:
    "https://biggieyes.mypinata.cloud/ipfs/bafybeiexwu2aiocaw4jh4yihywdkabbp2u7v2vf7wydhqcgehcispvjhfy/",
  WHITE:
    "https://biggieyes.mypinata.cloud/ipfs/bafybeicqja4j6wmdm2jbomtloggwafe4kluokgp5qhdr2pkrgxju6tpyl4/",
  BROWN:
    "https://biggieyes.mypinata.cloud/ipfs/bafybeibbqjofkkvldzfmmi5tfzucrmbd56ba3i5pfivywqb7g25wa7677m/",
  BLUE:
    "https://biggieyes.mypinata.cloud/ipfs/bafybeieuk5o3mktitbutdzyymacz27me5zntkybk3zhndjvsfuqa6osj4m/",
  GREEN:
    "https://biggieyes.mypinata.cloud/ipfs/bafybeihgbvpuomieigi3eenho6fzbbtwpvw7lfqbpbriojenvutufn6opa/",
  VIOLET:
    "https://biggieyes.mypinata.cloud/ipfs/bafybeibs3xyn3wdsssxubow5wqh4vyg4dkumshqza6ppssiqqrbo4chq3a/",
  RED:
    "https://biggieyes.mypinata.cloud/ipfs/bafybeifuhvp33jihz2xzr45vwme2drg7uxe5sukabttx4eqqupdbfmmebi/",
  PINK:
    "https://biggieyes.mypinata.cloud/ipfs/bafybeihkz72p25huca3b463o7q7yp4xnv2l4lejyzckodolqij6m5ofw2a/",
  RAINBOW:
    "https://biggieyes.mypinata.cloud/ipfs/bafybeibda5h7lwnalrugm4fek63pqsndvm4nyesm3t77tuegziloqgna3i/",
});

const trimSlash = (val) => String(val || "").replace(/\/+$/, "");

const normalizeBgCode = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (BACKGROUND_CODE_BY_NAME[raw]) return BACKGROUND_CODE_BY_NAME[raw];
  const allowed = new Set(Object.values(BACKGROUND_CODE_BY_NAME));
  if (allowed.has(raw)) return raw;
  return "";
};

const normalizeBackgroundName = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "-") return "";
  if (BACKGROUND_CODE_BY_NAME[raw]) return raw;
  const byCode = Object.entries(BACKGROUND_CODE_BY_NAME).find(
    ([, code]) => code === raw,
  );
  if (byCode?.[0]) return byCode[0];
  return raw;
};

const normalizeBlockForImage = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "-") return "";
  if (DEFAULT_BLOCKS.includes(raw)) return raw;
  return raw;
};

const stripRetryParam = (url) =>
  String(url || "")
    .replace(/([?&])r=\d+(&?)/g, "$1")
    .replace(/[?&]$/, "");

const isUsableLiveStatsImage = (raw) => {
  const normalized = normalizeLiveStatsImage(raw);
  if (!normalized) return false;
  const lowered = normalized.toLowerCase();
  if (lowered === "/images/biggi.png") return false;
  if (lowered.includes("biggi_random_mint_ticket")) return false;
  return true;
};

const LAST_IMAGE_TOKEN_CACHE_LIMIT = 64;
const liveStatsImageByToken = new Map();
const LIVE_STATS_IMAGE_CACHE_VERSION = "v3-core-series";
const LIVE_STATS_CACHE_CHAIN_ID = Number(ADDR?.CHAIN_ID || 137) || 137;
const LIVE_STATS_CACHE_CONTRACT = String(ADDR?.MAIN || ADDR?.COLLECTION_VRF || "")
  .trim()
  .toLowerCase();
const LIVE_STATS_CACHE_SCOPE = `${LIVE_STATS_IMAGE_CACHE_VERSION}_${LIVE_STATS_CACHE_CHAIN_ID}${
  LIVE_STATS_CACHE_CONTRACT ? `_${LIVE_STATS_CACHE_CONTRACT}` : ""
}`;
const LIVE_STATS_IMAGE_CACHE_PREFIX = `biggi_live_stats_image_${LIVE_STATS_CACHE_SCOPE}_`;
const LIVE_STATS_IMAGE_LAST_KEY = `biggi_live_stats_image_last_${LIVE_STATS_CACHE_SCOPE}`;

const canUseLiveStatsStorage = () =>
  typeof window !== "undefined" && Boolean(window.localStorage);

const persistLiveStatsImageForToken = (tokenId, image) => {
  try {
    if (!canUseLiveStatsStorage()) return;
    const key = String(tokenId || "").trim();
    const src = String(image || "").trim();
    if (!key || key === "-" || !src) return;
    window.localStorage.setItem(`${LIVE_STATS_IMAGE_CACHE_PREFIX}${key}`, src);
    window.localStorage.setItem(
      LIVE_STATS_IMAGE_LAST_KEY,
      JSON.stringify({ tokenId: key, image: src }),
    );
  } catch {
    // ignore storage errors
  }
};

const readPersistedLiveStatsImageForToken = (tokenId) => {
  try {
    if (!canUseLiveStatsStorage()) return "";
    const key = String(tokenId || "").trim();
    if (!key || key === "-") return "";
    const raw = window.localStorage.getItem(`${LIVE_STATS_IMAGE_CACHE_PREFIX}${key}`);
    const normalized = normalizeLiveStatsImage(raw);
    return isUsableLiveStatsImage(normalized) ? normalized : "";
  } catch {
    return "";
  }
};

const readPersistedLastLiveStatsImage = () => {
  try {
    if (!canUseLiveStatsStorage()) return { tokenId: "", image: "" };
    const raw = window.localStorage.getItem(LIVE_STATS_IMAGE_LAST_KEY);
    if (!raw) return { tokenId: "", image: "" };
    const parsed = JSON.parse(raw);
    const tokenId = String(parsed?.tokenId || "").trim();
    const image = normalizeLiveStatsImage(parsed?.image);
    if (!tokenId || !isUsableLiveStatsImage(image)) {
      return { tokenId: "", image: "" };
    }
    return { tokenId, image };
  } catch {
    return { tokenId: "", image: "" };
  }
};

const cacheLiveStatsImageForToken = (tokenId, rawImage) => {
  const key = String(tokenId || "").trim();
  if (!key || key === "-") return;
  if (!isUsableLiveStatsImage(rawImage)) return;
  const image = normalizeLiveStatsImage(rawImage);
  if (!image) return;
  if (liveStatsImageByToken.has(key)) liveStatsImageByToken.delete(key);
  liveStatsImageByToken.set(key, image);
  while (liveStatsImageByToken.size > LAST_IMAGE_TOKEN_CACHE_LIMIT) {
    const oldest = liveStatsImageByToken.keys().next().value;
    if (oldest == null) break;
    liveStatsImageByToken.delete(oldest);
  }
  persistLiveStatsImageForToken(key, image);
};

const getCachedLiveStatsImageForToken = (tokenId) => {
  const key = String(tokenId || "").trim();
  if (!key || key === "-") return "";
  const hit = liveStatsImageByToken.get(key);
  const inMemory = String(hit || "").trim();
  if (inMemory) return inMemory;
  const persisted = readPersistedLiveStatsImageForToken(key);
  if (!persisted) return "";
  if (liveStatsImageByToken.has(key)) liveStatsImageByToken.delete(key);
  liveStatsImageByToken.set(key, persisted);
  return persisted;
};

const buildLastMintedImageCandidates = ({
  primaryImage,
  tokenId,
  blockName,
  backgroundName,
}) => {
  const out = [];
  const push = (raw) => {
    const normalized = normalizeLiveStatsImage(raw);
    if (!isUsableLiveStatsImage(normalized)) return;
    const key = stripRetryParam(normalized).toLowerCase();
    if (!key) return;
    if (out.some((item) => stripRetryParam(item).toLowerCase() === key)) return;
    out.push(normalized);
  };

  push(primaryImage);

  const token = String(tokenId || "").trim();
  const block = normalizeBlockForImage(blockName);
  const bgCode = normalizeBgCode(backgroundName);
  if (/^\d+$/.test(token) && block && bgCode) {
    const fileName = `Biggi_${token}_${block}_${bgCode}.png`;
    const remoteBase = trimSlash(BLOCK_IMAGE_BASES[block] || "");
    if (remoteBase) push(`${remoteBase}/${fileName}`);
    push(buildBlockImagePath(block, fileName));
  }

  return out;
};

const parseTokenUriPartsForImage = (uri) => {
  const m = String(uri || "").match(/Biggi_(\d+)_([A-Z]+)_([A-Z]+)\.json/i);
  if (!m) return null;
  return {
    mainId: m[1],
    blockName: String(m[2] || "").toUpperCase(),
    bgCode: String(m[3] || "").toUpperCase(),
  };
};

function LiveStats({
  lastImage,
  lastNftId,
  lastBlockName,
  lastBackgroundName,
  lastContractAddress = "",
  lastChapterId = null,
  biggiMinted,
  maxSupply,
  ticketMinted,
  maxTickets,
  ticketPrice,
  blockMintCounts,
  blockNames,
  blockPrices,
  backgroundMintCounts,
  rewardPool,
  myClaimable,
  items = [],
  walletAddress = "",
  blocksMinted,
  currentBlockPrices,
  bgsMinted,
  mintVolumeMatic = null,
  epochStart = null,
  userLastClaimTs = null,
  weekSeconds = 7 * 24 * 60 * 60,
  fetchChainNowTs = null,
  lastFinalPrice = null,
  compact = false,
  // lpPrice,
  // setLpPrice,
}) {
  const normalizedItems = React.useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    if (!arr.length) return arr;
    return arr.map((it) => {
      if (!it) return it;
      const meta = it?.meta;
      const metaLooksTicket = looksLikeTicketMeta(meta);
      const metaLooksNft = looksLikeNftMeta(meta);
      let isTicket = it?.isTicket;
      if (metaLooksNft) {
        isTicket = false;
      } else if ((isTicket == null) && metaLooksTicket && !metaLooksNft) {
        isTicket = true;
      } else if (isTicket != null) {
        isTicket = Boolean(isTicket);
      }
      if (
        isTicket === it?.isTicket ||
        (it?.isTicket == null && isTicket == null)
      ) {
        return it;
      }
      return { ...it, isTicket };
    });
  }, [items]);

  const walletLastMintedFallback = React.useMemo(() => {
    const arr = Array.isArray(normalizedItems) ? normalizedItems : [];
    const nftItems = arr.filter((it) => it && !it.isTicket && !it.isPending);
    if (!nftItems.length) return null;

    const isUsableImage = (raw) => {
      const image = String(raw || "").trim();
      if (!image) return false;
      const lowered = image.toLowerCase();
      if (lowered === "/images/biggi.png") return false;
      if (lowered.includes("biggi_random_mint_ticket")) return false;
      return true;
    };

    // Prefer the UI order provided by AppCore (already reconciled around latest redeem),
    // and only then fall back to "first available NFT with usable image".
    const fallbackItem =
      nftItems.find((item) => isUsableImage(item?.image)) || nftItems[0];
    const blockName =
      String(fallbackItem?.blockName || "").trim() ||
      traitValueFromMeta(fallbackItem?.meta, [
        "eye color",
        "eyes",
        "block/eye color",
        "block",
        "block id",
        "linked block",
        "block name",
      ]) ||
      "-";
    const backgroundName =
      String(fallbackItem?.backgroundName || "").trim() ||
      traitValueFromMeta(fallbackItem?.meta, ["background", "background color"]) ||
      "-";

    return toDisplayLastMinted({
      tokenId: fallbackItem?.tokenId ?? fallbackItem?.id,
      image: fallbackItem?.image,
      blockName,
      backgroundName,
      contractAddress: fallbackItem?.contractAddress,
      chapterId: fallbackItem?.chapterId,
    });
  }, [normalizedItems]);

  const walletNftsByTokenId = React.useMemo(() => {
    const out = new Map();
    const arr = Array.isArray(normalizedItems) ? normalizedItems : [];
    for (const item of arr) {
      if (!item || item.isTicket || item.isPending) continue;
      const tokenId = String(item?.tokenId ?? item?.id ?? "").trim();
      if (!tokenId) continue;
      const current = out.get(tokenId) || [];
      current.push(item);
      out.set(tokenId, current);
    }
    return out;
  }, [normalizedItems]);

  const chainLastMinted = React.useMemo(
    () =>
      toDisplayLastMinted({
        image: lastImage,
        tokenId: lastNftId,
        blockName: lastBlockName,
        backgroundName: lastBackgroundName,
        contractAddress: lastContractAddress,
        chapterId: lastChapterId,
      }),
    [
      lastImage,
      lastNftId,
      lastBlockName,
      lastBackgroundName,
      lastContractAddress,
      lastChapterId,
    ],
  );

  const chainTokenWalletFallback = React.useMemo(() => {
    const chainTokenId = String(chainLastMinted.tokenId || "").trim();
    if (!chainTokenId || chainTokenId === "-") return null;
    const candidates = walletNftsByTokenId.get(chainTokenId) || [];
    const chainContract = String(chainLastMinted.contractAddress || "")
      .trim()
      .toLowerCase();
    const item = chainContract
      ? candidates.find(
          (candidate) =>
            String(candidate?.contractAddress || "").toLowerCase() ===
            chainContract,
        )
      : candidates.length === 1
        ? candidates[0]
        : null;
    if (!item) return null;

    const blockName =
      String(item?.blockName || "").trim() ||
      traitValueFromMeta(item?.meta, [
        "eye color",
        "eyes",
        "block/eye color",
        "block",
        "block id",
        "linked block",
        "block name",
      ]) ||
      "-";
    const backgroundName =
      String(item?.backgroundName || "").trim() ||
      traitValueFromMeta(item?.meta, ["background", "background color"]) ||
      "-";

    return toDisplayLastMinted({
      tokenId: chainTokenId,
      image: item?.image,
      blockName,
      backgroundName,
      contractAddress: item?.contractAddress,
      chapterId: item?.chapterId,
    });
  }, [chainLastMinted, walletNftsByTokenId]);

  const effectiveLastMinted = React.useMemo(() => {
    const chainImageRaw = String(chainLastMinted.image || "").trim();
    const chainImageLower = chainImageRaw.toLowerCase();
    const chainHasImage =
      Boolean(chainImageRaw) &&
      chainImageLower !== "/images/biggi.png" &&
      !chainImageLower.includes("biggi_random_mint_ticket");
    const chainHasTraits =
      chainLastMinted.blockName !== "-" &&
      chainLastMinted.backgroundName !== "-";
    const chainHasToken = chainLastMinted.tokenId !== "-";
    const chainComplete = chainHasImage && chainHasTraits && chainHasToken;

    if (chainComplete) return chainLastMinted;

    if (chainTokenWalletFallback) {
      return {
        tokenId: chainLastMinted.tokenId,
        image: chainHasImage
          ? chainLastMinted.image
          : chainTokenWalletFallback.image || "",
        blockName:
          chainLastMinted.blockName !== "-"
            ? chainLastMinted.blockName
            : chainTokenWalletFallback.blockName,
        backgroundName:
          chainLastMinted.backgroundName !== "-"
            ? chainLastMinted.backgroundName
            : chainTokenWalletFallback.backgroundName,
        contractAddress:
          chainLastMinted.contractAddress ||
          chainTokenWalletFallback.contractAddress,
        chapterId:
          chainLastMinted.chapterId || chainTokenWalletFallback.chapterId,
      };
    }

    if (walletLastMintedFallback) return walletLastMintedFallback;
    return chainLastMinted;
  }, [chainLastMinted, chainTokenWalletFallback, walletLastMintedFallback]);

  const effectiveTokenId = String(effectiveLastMinted.tokenId || "").trim();
  const effectiveImageIdentity = buildLiveStatsAssetIdentity(
    effectiveLastMinted.contractAddress,
    effectiveTokenId,
  );

  const normalizedLastImage = React.useMemo(
    () => normalizeLiveStatsImage(effectiveLastMinted.image),
    [effectiveLastMinted.image],
  );
  const [resolvedLastImage, setResolvedLastImage] = React.useState("");
  React.useEffect(() => {
    setResolvedLastImage("");
  }, [effectiveLastMinted.contractAddress, effectiveLastMinted.tokenId]);

  React.useEffect(() => {
    const tokenId = effectiveImageIdentity;
    if (!tokenId || tokenId === "-" || !/^\d+$/.test(tokenId)) return;
    if (normalizedLastImage) return;
    if (resolvedLastImage) return;

    let cancelled = false;
    (async () => {
      try {
        const provider = getROProvider();
        const mainAddr =
          effectiveLastMinted.contractAddress || ADDR?.MAIN;
        if (!provider || !mainAddr) return;
        const contract = new Contract(
          mainAddr,
          ["function tokenURI(uint256 tokenId) view returns (string)"],
          provider,
        );
        const uri = await contract.tokenURI(tokenId).catch(() => null);
        if (!uri) return;

        const meta = await readJsonFromURI(uri).catch(() => null);
        const imgField = meta?.image || meta?.image_url || "";
        let resolved =
          (await resolveImageUrl(imgField, uri).catch(() => null)) ||
          normalizeLiveStatsImage(httpFromIpfs(imgField));

        if (!resolved) {
          const parsed = parseTokenUriPartsForImage(uri);
          if (parsed?.mainId && parsed?.blockName && parsed?.bgCode) {
            const fileName = `Biggi_${parsed.mainId}_${parsed.blockName}_${parsed.bgCode}.png`;
            const remoteBase = trimSlash(BLOCK_IMAGE_BASES[parsed.blockName] || "");
            if (remoteBase) {
              resolved = `${remoteBase}/${fileName}`;
            } else {
              resolved = buildBlockImagePath(parsed.blockName, fileName);
            }
          }
        }

        const normalized = normalizeLiveStatsImage(resolved);
        if (!cancelled && normalized) {
          setResolvedLastImage(normalized);
        }
      } catch {
        // ignore best-effort image resolve failures
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveLastMinted.contractAddress,
    effectiveLastMinted.tokenId,
    normalizedLastImage,
    resolvedLastImage,
  ]);

  const effectivePrimaryImage = normalizedLastImage || resolvedLastImage;
  const lastImageCandidates = React.useMemo(
    () =>
      buildLastMintedImageCandidates({
        primaryImage: effectivePrimaryImage,
        tokenId: effectiveLastMinted.tokenId,
        blockName: effectiveLastMinted.blockName,
        backgroundName: effectiveLastMinted.backgroundName,
      }),
    [
      effectivePrimaryImage,
      effectiveLastMinted.tokenId,
      effectiveLastMinted.blockName,
      effectiveLastMinted.backgroundName,
    ],
  );

  const [lastImageSrc, setLastImageSrc] = React.useState(
    lastImageCandidates[0] || "",
  );
  const [lastImageLoaded, setLastImageLoaded] = React.useState(false);
  const [lastImageFailed, setLastImageFailed] = React.useState(false);
  const lastImageRetryRef = React.useRef(0);
  const persistedStableRef = React.useRef(readPersistedLastLiveStatsImage());
  const lastStableImageRef = React.useRef(persistedStableRef.current.image || "");
  const lastStableTokenRef = React.useRef(persistedStableRef.current.tokenId || "");
  const lastPrimaryBaseRef = React.useRef("");
  const lastPrimaryTokenRef = React.useRef("");
  const [isOffline, setIsOffline] = React.useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  React.useEffect(() => {
    const next = String(lastImageCandidates[0] || "").trim();
    if (!next) {
      lastPrimaryBaseRef.current = "";
      lastPrimaryTokenRef.current = "";
      lastImageRetryRef.current = 0;
      setLastImageSrc("");
      setLastImageLoaded(false);
      setLastImageFailed(false);
      return;
    }
    const nextBase = stripRetryParam(next).toLowerCase();
    const tokenId = String(effectiveLastMinted.tokenId || "").trim();
    const prevBase = String(lastPrimaryBaseRef.current || "").toLowerCase();
    const prevToken = String(lastPrimaryTokenRef.current || "").trim();
    if (prevBase === nextBase && prevToken === tokenId) return;
    lastPrimaryBaseRef.current = nextBase;
    lastPrimaryTokenRef.current = tokenId;
    lastImageRetryRef.current = 0;
    setLastImageSrc(next);
    setLastImageLoaded(false);
    setLastImageFailed(false);
  }, [effectiveImageIdentity, lastImageCandidates]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);
    handleStatus();
    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  const displayLastImageSrc = React.useMemo(() => {
    const direct = String(lastImageSrc || "").trim();
    const stableToken = String(lastStableTokenRef.current || "").trim();
    const stableSrc = String(lastStableImageRef.current || "").trim();
    const cached = getCachedLiveStatsImageForToken(effectiveImageIdentity);
    const firstCandidate = String(lastImageCandidates[0] || "").trim();
    return selectLiveStatsImage({
      tokenId: effectiveImageIdentity,
      directImage: direct,
      directTokenId: lastPrimaryTokenRef.current,
      stableImage: stableSrc,
      stableTokenId: stableToken,
      cachedImage: cached,
      firstCandidate,
    });
  }, [effectiveImageIdentity, lastImageCandidates, lastImageSrc]);

  React.useEffect(() => {
    if (!effectiveTokenId || effectiveTokenId === "-") return;
    const primary = String(lastImageCandidates[0] || "").trim();
    if (!primary) return;
    cacheLiveStatsImageForToken(effectiveImageIdentity, primary);
  }, [effectiveImageIdentity, effectiveTokenId, lastImageCandidates]);

  const lastImageIsIpfs = React.useMemo(() => {
    const raw =
      `${String(normalizedLastImage || "")} ${String(displayLastImageSrc || "")}`
        .toLowerCase();
    return (
      raw.includes("ipfs://") ||
      raw.includes("/ipfs/") ||
      raw.includes("ipns://") ||
      raw.includes("/ipns/") ||
      raw.includes("pinata") ||
      raw.includes("mypinata") ||
      raw.includes("ipfs")
    );
  }, [displayLastImageSrc, normalizedLastImage]);

  const showLastImageFallback =
    lastImageIsIpfs &&
    (lastImageFailed || (!lastImageLoaded && isOffline));
  const hasLastToken = effectiveTokenId !== "-";
  const hasLastImage =
    hasLastToken && isUsableLiveStatsImage(displayLastImageSrc);

  React.useEffect(() => {
    if (!lastImageFailed || !lastImageIsIpfs) return;
    if (lastImageRetryRef.current >= 2) return;
    const base = String(displayLastImageSrc || lastImageCandidates[0] || "").trim();
    if (!base) return;
    const timer = setTimeout(() => {
      lastImageRetryRef.current += 1;
      const withoutRetry = stripRetryParam(base);
      const sep = withoutRetry.includes("?") ? "&" : "?";
      setLastImageSrc(`${withoutRetry}${sep}r=${Date.now()}`);
      setLastImageFailed(false);
      setLastImageLoaded(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    displayLastImageSrc,
    lastImageCandidates,
    lastImageFailed,
    lastImageIsIpfs,
  ]);

  // LP price state
  const [lpPrice, setLpPrice] = React.useState(null);
  // Fetch LP price from on-chain feed
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const prov = getROProvider();
        const feedAddr = ADDR.LP_PRICE_FEED;
        if (feedAddr) {
          const feed = new Contract(feedAddr, BiggiLpPriceFeed, prov);
          const round = await feed.latestRoundData().catch(() => null);
          const dec = await feed.decimals().catch(() => 18);
          if (!alive) return;
          if (round && round.answer != null) {
            const price = Number(_formatUnits(round.answer, dec));
            if (Number.isFinite(price)) setLpPrice(price);
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Zobrazen� LP ceny v UI (p��klad, uprav dle skute�n�ho layoutu):
  // <div>LP token price: {lpPrice != null ? lpPrice + ' POL' : '--'}</div>
  const [showBlocks, setShowBlocks] = React.useState(false);
  const [showBgStats, setShowBgStats] = React.useState(false);
  const [showREWARDS, setShowREWARDS] = React.useState(false);
  const [showCollectionInfo, setShowCollectionInfo] = React.useState(false);
  const [weeklyOpen, setWeeklyOpen] = React.useState(false);
  const weeklyBtnRef = React.useRef(null);

  const [poolsOpen, setPoolsOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [modalViewportTop, setModalViewportTop] = React.useState(0);
  const [modalViewportHeight, setModalViewportHeight] = React.useState(() =>
    typeof window !== "undefined" ? window.innerHeight || 0 : 0,
  );
  const modalViewportTopRef = React.useRef(0);
  const [pools, setPools] = React.useState(null);
  const weekDuration = weekSeconds || 7 * 24 * 60 * 60;
  const {
    displayed: weeklyDisplayed,
    loading: weeklyLoading,
    error: weeklyError,
    isClaiming: weeklyIsClaiming,
    claimSuccess: weeklyClaimSuccess,
    syncWeeklyInfo,
    handleClaim: weeklyHandleClaim,
  } = useWeeklyCountdown({
    epochStart,
    fetchChainNowTs,
    weekSeconds,
  });

  const computePhoneViewport = React.useCallback(() => {
    if (typeof window === "undefined") return Boolean(compact);

    const narrowViewport = window.matchMedia("(max-width: 700px)").matches;
    if (narrowViewport) return true;

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const touchPoints = Number(window.navigator?.maxTouchPoints || 0);
    const likelyPhoneOrTablet = coarsePointer || touchPoints > 0;
    const width = Number(window.innerWidth) || 0;
    const height = Number(window.innerHeight) || 0;
    const landscape = width > height;
    const shortLandscapeViewport = height > 0 && height <= 500;

    return Boolean(compact) || (likelyPhoneOrTablet && landscape && shortLandscapeViewport);
  }, [compact]);

  const [isPhone, setIsPhone] = React.useState(() => computePhoneViewport());
  const [isTiny, setIsTiny] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 480px)").matches
      : false,
  );
  const desktopFullscreen = !isPhone;
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq700 = window.matchMedia("(max-width: 700px)");
    const mq480 = window.matchMedia("(max-width: 480px)");
    const mqPointer = window.matchMedia("(pointer: coarse)");
    const updateViewportFlags = () => {
      setIsPhone(computePhoneViewport());
      setIsTiny(mq480.matches);
    };

    const addMqlListener = (mql, listener) => {
      try {
        mql.addEventListener("change", listener);
      } catch {
        mql.addListener(listener);
      }
    };

    const removeMqlListener = (mql, listener) => {
      try {
        mql.removeEventListener("change", listener);
      } catch {
        mql.removeListener(listener);
      }
    };

    addMqlListener(mq700, updateViewportFlags);
    addMqlListener(mq480, updateViewportFlags);
    addMqlListener(mqPointer, updateViewportFlags);
    window.addEventListener("resize", updateViewportFlags);
    window.addEventListener("orientationchange", updateViewportFlags);

    updateViewportFlags();
    return () => {
      removeMqlListener(mq700, updateViewportFlags);
      removeMqlListener(mq480, updateViewportFlags);
      removeMqlListener(mqPointer, updateViewportFlags);
      window.removeEventListener("resize", updateViewportFlags);
      window.removeEventListener("orientationchange", updateViewportFlags);
    };
  }, [computePhoneViewport]);

  // Additional on-chain-derived state (contract-focused changes only)
  const [poolFromContract, setPoolFromContract] = React.useState(null);
  const [weightsFromContract, setWeightsFromContract] = React.useState(null);
  const [unitRewardWei, setUnitRewardWei] = React.useState(null);
  const [tokenSymbol, setTokenSymbol] = React.useState("BIGGI");
  const [tokenDecimals, setTokenDecimals] = React.useState(18);

  // new: read some potentially useful derived chain values if available
  const [lastFinalFromChain, setLastFinalFromChain] = React.useState(null);
  const [blockPricesFromChain, setBlockPricesFromChain] = React.useState(null);
  const [lastMintPriceData, setLastMintPriceData] = React.useState({
    ticketPrice: null,
    blockPrice: null,
    finalPrice: null,
  });
  const readRpcRotateAtRef = React.useRef(0);

  const handleReadRpcFailure = React.useCallback((err, scope = "LiveStats") => {
    const isRateLimited = isRateLimitedRpcError(err);
    const status = Number(
      err?.status ??
        err?.data?.httpStatus ??
        err?.error?.data?.httpStatus ??
        err?.info?.error?.data?.httpStatus ??
        0,
    );
    const msg = String(
      err?.reason ||
        err?.shortMessage ||
        err?.message ||
        err?.error?.message ||
        err?.info?.error?.message ||
        "",
    ).toLowerCase();
    const transientNetwork =
      msg.includes("failed to fetch") ||
      msg.includes("network error") ||
      msg.includes("request failed") ||
      msg.includes("timed out") ||
      msg.includes("timeout") ||
      [408, 425, 429, 500, 502, 503, 504].includes(status);
    if (!isRateLimited && !transientNetwork) return false;

    const now = Date.now();
    // Avoid rotate storms when multiple effects fail in the same render frame.
    if (now - Number(readRpcRotateAtRef.current || 0) < 4_000) return true;
    readRpcRotateAtRef.current = now;

    const toHost = (url) => {
      const raw = String(url || "").trim();
      if (!raw) return "";
      try {
        return new URL(raw).host || raw;
      } catch {
        return raw;
      }
    };

    let current = null;
    let next = null;
    try {
      current = getPreferredRpc();
      if (current) markRpcRateLimited(current);
      const urls = getRpcUrls();
      if (Array.isArray(urls) && urls.length) {
        const idx = current ? urls.indexOf(current) : -1;
        next = idx >= 0 ? urls[(idx + 1) % urls.length] : urls[0];
        if (next) setPreferredRpc(next);
      }
    } catch {
      // ignore rpc-rotation helper failures
    }

    try {
      resetROProvider();
    } catch {
      // ignore provider reset failures
    }

    const fromHost = toHost(current);
    const toHostName = toHost(next);
    const routeInfo =
      fromHost || toHostName
        ? ` (rpc ${fromHost || "?"} -> ${toHostName || "?"})`
        : "";
    const reasonLabel = isRateLimited ? "rate-limited" : "network-failure";
    console.warn(`${scope}: RPC ${reasonLabel}, rotating read RPC${routeInfo}.`);
    return true;
  }, []);

  React.useEffect(() => {
    const tokenId = String(effectiveLastMinted.tokenId || "").trim();
    if (!tokenId || tokenId === "-" || !/^\d+$/.test(tokenId)) {
      setLastMintPriceData({
        ticketPrice: null,
        blockPrice: null,
        finalPrice: null,
      });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        let next = {
          ticketPrice: null,
          blockPrice: null,
          finalPrice: null,
        };

        const cachedAttrs = getCachedPriceAttrs(
          tokenId,
          effectiveLastMinted.contractAddress,
        );
        if (Array.isArray(cachedAttrs) && cachedAttrs.length) {
          const cachedMeta = { attributes: cachedAttrs };
          next = {
            ticketPrice: readPriceFromMeta(cachedMeta, ["ticket price"]),
            blockPrice: readPriceFromMeta(cachedMeta, ["block price"]),
            finalPrice: readPriceFromMeta(cachedMeta, ["final price"]),
          };
        }

        const provider = (() => {
          try {
            return getROProvider();
          } catch {
            return null;
          }
        })();

        const collection = CORE_CHAPTERS.flatMap((chapter) => [
          { ...chapter, collectionType: "vrf", address: chapter.main },
          { ...chapter, collectionType: "public", address: chapter.main2 },
        ]).find(
          (entry) =>
            String(entry.address).toLowerCase() ===
            String(effectiveLastMinted.contractAddress || "").toLowerCase(),
        );
        const reader =
          (!collection ||
            (collection.chapterId === 1 &&
              collection.collectionType === "vrf")) &&
          provider
          ? (() => {
              try {
                return getReaderRO(provider);
              } catch {
                return null;
              }
            })()
          : null;
        const main = provider
          ? (() => {
              try {
                if (collection?.collectionType === "public") {
                  return getReadOnlyChapterMain2(
                    collection.chapterId,
                    provider,
                  );
                }
                if (collection?.chapterId) {
                  return getReadOnlyChapterMain(
                    collection.chapterId,
                    provider,
                  );
                }
                return getReadOnlyMain(provider);
              } catch {
                return null;
              }
            })()
          : null;

        const mergeMintData = (res) => {
          if (!res) return;
          const ticketPrice = parsePriceNumber(res?.[0] ?? null);
          const blockPrice = parsePriceNumber(res?.[1] ?? null);
          const finalPrice = parsePriceNumber(res?.[2] ?? null);
          if (ticketPrice != null) next.ticketPrice = ticketPrice;
          if (blockPrice != null) next.blockPrice = blockPrice;
          if (finalPrice != null) next.finalPrice = finalPrice;
        };
        const mainIndex = toMainNftIndexFromTokenId(tokenId, {
          maxSupply: Number(maxSupply) || 550,
          allowLegacy: true,
        });
        const tokenIdArg = BigInt(tokenId);
        const mainIndexArg = mainIndex != null ? BigInt(mainIndex) : null;

        if (reader && typeof reader.getMintDataByTokenId === "function") {
          mergeMintData(
            await reader.getMintDataByTokenId(tokenIdArg).catch(() => null),
          );
        }

        if (
          (next.ticketPrice == null ||
            next.blockPrice == null ||
            next.finalPrice == null) &&
          reader &&
          typeof reader.getMintData === "function"
        ) {
          mergeMintData(
            await reader
              .getMintData(mainIndexArg != null ? mainIndexArg : tokenIdArg)
              .catch(() => null),
          );
        }

        if (
          (next.ticketPrice == null ||
            next.blockPrice == null ||
            next.finalPrice == null) &&
          main &&
          typeof main.getMintData === "function"
        ) {
          mergeMintData(
            await main
              .getMintData(mainIndexArg != null ? mainIndexArg : tokenIdArg)
              .catch(() => null),
          );
        }

        if (next.blockPrice == null && main) {
          const blockPriceCandidates = [
            "getCurrentBlockPriceByTokenId",
            "currentBlockPriceByTokenId",
          ];
          for (const fn of blockPriceCandidates) {
            if (typeof main?.[fn] !== "function") continue;
            const parsed = parsePriceNumber(
              await main[fn](tokenId).catch(() => null),
            );
            if (parsed != null) {
              next.blockPrice = parsed;
              break;
            }
          }
        }

        if (
          (next.ticketPrice == null ||
            next.blockPrice == null ||
            next.finalPrice == null) &&
          main &&
          typeof main.tokenURI === "function"
        ) {
          const uri = await main.tokenURI(tokenId).catch(() => null);
          const meta = uri ? await readJsonFromURI(uri).catch(() => null) : null;
          if (meta) {
            if (next.ticketPrice == null) {
              next.ticketPrice = readPriceFromMeta(
                meta,
                ["ticket price", "current ticket price"],
                [
                  meta?.ticketPrice,
                  meta?.ticket_price,
                  meta?.mintTicket,
                  meta?.mint?.ticketPrice,
                  meta?.mint?.ticket_price,
                ],
              );
            }
            if (next.blockPrice == null) {
              next.blockPrice = readPriceFromMeta(
                meta,
                ["block price"],
                [
                  meta?.blockPrice,
                  meta?.block_price,
                  meta?.mintBlock,
                  meta?.mint?.blockPrice,
                  meta?.mint?.block_price,
                ],
              );
            }
            if (next.finalPrice == null) {
              next.finalPrice = readPriceFromMeta(
                meta,
                ["final price"],
                [
                  meta?.finalPrice,
                  meta?.final_price,
                  meta?.mintFinal,
                  meta?.mint?.finalPrice,
                  meta?.mint?.final_price,
                ],
              );
            }
          }
        }

        if (next.finalPrice == null && next.blockPrice != null) {
          next.finalPrice = next.blockPrice;
        }

        if (!cancelled) {
          setLastMintPriceData(next);
        }
      } catch (err) {
        const handled = handleReadRpcFailure(err, "LiveStats last mint prices");
        if (!handled) {
          console.warn("LiveStats: failed reading last mint prices", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveLastMinted.contractAddress,
    effectiveLastMinted.tokenId,
    handleReadRpcFailure,
  ]);

  const effectiveBlockPrices = React.useMemo(() => {
    const normalize = (arr) =>
      Array.isArray(arr)
        ? arr.map((v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          })
        : [];
    const hasAnyValue = (arr) =>
      Array.isArray(arr) &&
      arr.some((v) => Number.isFinite(Number(v)) && Number(v) > 0);

    // Prefer prices coming from MAIN/snapshot props.
    // Liquidity-derived array is only a last-resort fallback.
    if (hasAnyValue(currentBlockPrices)) return normalize(currentBlockPrices);
    if (hasAnyValue(blockPrices)) return normalize(blockPrices);
    if (hasAnyValue(blockPricesFromChain)) return normalize(blockPricesFromChain);
    return [];
  }, [blockPricesFromChain, currentBlockPrices, blockPrices]);

  const effectiveBlockMintCounts = blocksMinted ?? blockMintCounts ?? [];
  const effectiveBackgroundMintCounts = bgsMinted ?? backgroundMintCounts ?? [];
  const safeBlockNames = Array.isArray(blockNames) ? blockNames : [];

  const onlyTickets = React.useMemo(() => {
    const arr = Array.isArray(normalizedItems) ? normalizedItems : [];
    return arr.length > 0 && arr.every((it) => it?.isTicket);
  }, [normalizedItems]);
  const hasConnectedWallet = Boolean(String(walletAddress || "").trim());

  const resetAll = React.useCallback(() => {
    setShowBlocks(false);
    setShowBgStats(false);
    setShowREWARDS(false);
    setShowCollectionInfo(false);
  }, []);

  const openBlocks = React.useCallback(() => {
    resetAll();
    setShowBlocks(true);
  }, [resetAll]);

  const openBackgrounds = React.useCallback(() => {
    resetAll();
    setShowBgStats(true);
  }, [resetAll]);

  const openREWARDS = React.useCallback(() => {
    resetAll();
    setShowREWARDS(true);
  }, [resetAll]);

  React.useEffect(() => {
    if (!showREWARDS) setShowCollectionInfo(false);
  }, [showREWARDS]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleEscapeBack = (event) => {
      if (event.key !== "Escape") return;
      let handled = false;
      if (showCollectionInfo) {
        setShowCollectionInfo(false);
        handled = true;
      } else if (showBlocks || showBgStats || showREWARDS) {
        resetAll();
        handled = true;
      } else if (weeklyOpen) {
        setWeeklyOpen(false);
        handled = true;
      } else if (poolsOpen) {
        setPoolsOpen(false);
        handled = true;
      } else if (chatOpen) {
        setChatOpen(false);
        handled = true;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleEscapeBack);
    return () => window.removeEventListener("keydown", handleEscapeBack);
  }, [
    showCollectionInfo,
    showBlocks,
    showBgStats,
    showREWARDS,
    weeklyOpen,
    poolsOpen,
    chatOpen,
    resetAll,
  ]);

  const weeklyCountdownInfo = React.useMemo(
    () => ({
      ...weeklyDisplayed,
      loading: weeklyLoading,
      error: weeklyError,
    }),
    [weeklyDisplayed, weeklyLoading, weeklyError],
  );

  const computedREWARDSPool = React.useMemo(() => {
    if (typeof rewardPool === "number" && !Number.isNaN(rewardPool))
      return rewardPool;
    if (typeof poolFromContract === "number" && !Number.isNaN(poolFromContract))
      return poolFromContract;
    return null;
  }, [rewardPool, poolFromContract]);

  // Read token REWARDS metadata (weights, unitReward, token meta) — robust, contract-only changes
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let r = null;
        try {
          r = getTokenREWARDSRO();
        } catch {
          r = null;
        }
        if (!r) return;

        const calls = [];
        calls.push(
          typeof r.getBlockWeights === "function"
            ? r.getBlockWeights()
            : Promise.resolve(null),
        );
        calls.push(
          typeof r.unitReward === "function"
            ? r.unitReward()
            : Promise.resolve(null),
        );
        calls.push(
          typeof r.tokenMeta === "function"
            ? r.tokenMeta()
            : Promise.resolve(null),
        );

        const [wArr, unitWei, meta] = await Promise.all(calls);
        if (!alive) return;

        if (wArr && Array.isArray(wArr)) {
          const w = Array.from(wArr)
            .slice(1)
            .map((n) => Number(n || 0));
          setWeightsFromContract(w.length === 10 ? w : null);
        }

        if (unitWei != null) setUnitRewardWei(unitWei);
        const sym = meta?.symbol_ ?? meta?.[1] ?? null;
        const dec = meta?.decimals_ ?? meta?.[2] ?? null;
        if (sym && typeof sym === "string") setTokenSymbol(sym);
        if (Number.isFinite(Number(dec))) setTokenDecimals(Number(dec));
      } catch (e) {
        // silent fallback — not critical
        const handled = handleReadRpcFailure(
          e,
          "LiveStats token REWARDS metadata",
        );
        if (!handled) {
          console.warn("LiveStats: failed reading token REWARDS metadata", e);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [handleReadRpcFailure]);

  const WEIGHTS = React.useMemo(() => {
    if (
      Array.isArray(weightsFromContract) &&
      weightsFromContract.length === 10
    ) {
      return weightsFromContract;
    }
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  }, [weightsFromContract]);

  // Try to fetch a weekly REWARDS pool from the liquidity/readers (contract-focused)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const liq = (() => {
          try {
            return getReadOnlyLiquidityContract();
          } catch {
            return null;
          }
        })();
        if (!liq) return;

        const candidates = [
          "weeklyPool",
          "currentWeekPool",
          "getWeeklyPool",
          "weekPool",
          "poolForCurrentWeek",
          "rewardPool",
          "currentRewardPool",
          // reader fallback names
        ];
        for (const fn of candidates) {
          const f = liq?.[fn];
          if (typeof f === "function") {
            try {
              const wei = await f();
              const n = Number(_formatEther(wei));
              if (!cancelled && Number.isFinite(n)) {
                setPoolFromContract(n);
                break;
              }
            } catch {
              // try next
            }
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // New: attempt to read last final price from on-chain reader/liquidity contract
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const liq = (() => {
          try {
            return getReadOnlyLiquidityContract();
          } catch {
            return null;
          }
        })();
        if (!liq) return;

        const candidates = [
          "lastFinalPrice",
          "finalPrice",
          "getFinalPrice",
          "lastPrice",
          "finalPriceWei",
          "getFinalPriceWei",
        ];
        for (const fn of candidates) {
          const f = liq?.[fn];
          if (typeof f === "function") {
            try {
              const val = await f();
              if (val != null) {
                // normalize large-weis to numeric POL-ish
                let num = null;
                try {
                  num = Number(_formatEther(val));
                } catch {
                  const s = String(val ?? "");
                  const parsed = Number(s);
                  if (Number.isFinite(parsed)) num = parsed;
                }
                if (!cancelled && Number.isFinite(num) && num > 0) {
                  setLastFinalFromChain(num);
                  break;
                }
              }
            } catch {
              // try next
            }
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // New: attempt to read block price array from on-chain reader/liquidity contract
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const liq = (() => {
          try {
            return getReadOnlyLiquidityContract();
          } catch {
            return null;
          }
        })();
        if (!liq) return;

        const candidates = [
          "getCurrentBlockPrices",
          "currentBlockPrices",
          "blockPrices",
          "getBlockPrices",
        ];
        for (const fn of candidates) {
          const f = liq?.[fn];
          if (typeof f === "function") {
            try {
              const res = await f();
              if (res && (Array.isArray(res) || typeof res === "object")) {
                // attempt to normalize into numeric array
                const arr = Array.isArray(res) ? res : Array.from(res);
                const nums = arr.map((v) => {
                  try {
                    return Number(_formatEther(v));
                  } catch {
                    const n = Number(v);
                    return Number.isFinite(n) ? n : null;
                  }
                });
                const anyValid = nums.some((n) => Number.isFinite(n));
                if (!cancelled && anyValid) {
                  setBlockPricesFromChain(
                    nums.map((n) => (Number.isFinite(n) ? n : null)),
                  );
                  break;
                }
              }
            } catch {
              // try next
            }
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pools refresh (defensive contract usage)
  const refreshPools = React.useCallback(async () => {
    try {
      const r = (() => {
        try {
          return getDistributorRO();
        } catch {
          return null;
        }
      })();
      const prov = (() => {
        try {
          return getROProvider();
        } catch {
          return null;
        }
      })();

      if (!r || !prov) throw new Error("Distributor or provider not available");

        const resolveCollectionRewards = async () => {
          if (typeof r.collectionRewards === "function")
            return r.collectionRewards();
          if (typeof r.COLLECTIONREWARDS === "function")
            return r.COLLECTIONREWARDS();
          return ADDR.COLLECTION_REWARDS || ZeroAddress;
        };
        const resolveCommunityCenter = async () => {
          if (typeof r.communityCenter === "function")
            return r.communityCenter();
          if (typeof r.COMMUNITYCENTER === "function")
            return r.COMMUNITYCENTER();
          return (
            ADDR.COMMUNITY_CENTER ||
            ADDR.COMMUNITYCENTER ||
            ZeroAddress
          );
        };

        const [
          totalReceived,
          receivedForMain,
          reserveAddr,
          collREWARDSAddr,
          BUYBACKAddr,
          treasuryAddr,
          COMMUNITYCENTERAddr,
        ] = await Promise.all([
          typeof r.totalReceived === "function"
            ? r.totalReceived()
            : Promise.resolve(0n),
          (async () => {
            const readReceived =
              typeof r.receivedByAddress === "function"
                ? (address) => r.receivedByAddress(address)
                : typeof r.receivedByCOLLECTION === "function"
                  ? (address) => r.receivedByCOLLECTION(address)
                  : null;
            if (!readReceived) return 0n;
            const addresses = CORE_CHAPTERS.flatMap((chapter) => [
              chapter.main,
              chapter.main2,
            ]);
            const values = await Promise.all(
              addresses.map((address) =>
                readReceived(address).catch(() => 0n),
              ),
            );
            return values.reduce(
              (sum, value) => sum + BigInt(value?.toString?.() || "0"),
              0n,
            );
          })(),
        typeof r.reserve === "function"
          ? r.reserve()
          : Promise.resolve(ADDR.RESERVE || ZeroAddress),
          resolveCollectionRewards(),
          typeof r.buybackAgent === "function"
            ? r.buybackAgent()
            : typeof r.BUYBACKAgent === "function"
              ? r.BUYBACKAgent()
              : Promise.resolve(ADDR.BUYBACK_AGENT || ZeroAddress),
          typeof r.treasury === "function"
            ? r.treasury()
            : Promise.resolve(ADDR.TREASURY || ZeroAddress),
          resolveCommunityCenter(),
        ]);

      const targets = [
        { key: "reserve", name: "Reserve", addr: reserveAddr },
        { key: "BUYBACK", name: "Buyback Agent", addr: BUYBACKAddr },
        { key: "treasury", name: "Treasury", addr: treasuryAddr },
        { key: "community", name: "Community Center", addr: COMMUNITYCENTERAddr },
        { key: "REWARDS", name: "Collection Rewards", addr: collREWARDSAddr },
      ];

      let allocations = {};
      try {
        const distSnapshot = await fetchDistributorSnapshot({
          provider: prov,
        }).catch(() => null);
        if (distSnapshot) {
          allocations = {
            reserve: distSnapshot.pendingReserve ?? null,
            BUYBACK: distSnapshot.pendingBUYBACK ?? null,
            treasury: distSnapshot.pendingTreasury ?? null,
            community:
              distSnapshot.pendingCOMMUNITYCENTER ??
              distSnapshot.pendingCommunity ??
              null,
            REWARDS: distSnapshot.pendingCOLLECTIONREWARDS ?? null,
          };
        }
      } catch {
        allocations = {};
      }

        const communityNativeBalance = COMMUNITYCENTERAddr
          ? await prov.getBalance(COMMUNITYCENTERAddr).catch(() => 0n)
          : 0n;

      const balancesArr = await Promise.all(
        targets.map((t) => {
            if (t.key === "community") return Promise.resolve(communityNativeBalance);
            return prov.getBalance(t.addr).catch(() => 0n);
          }),
        );

      const balances = {};
      targets.forEach((t, i) => {
        balances[t.key] = balancesArr[i];
      });

      const distBal = await prov
        .getBalance(ADDR.DISTRIBUTOR)
        .catch(() => 0n);

      // ===== token + LP balances =====
      let tokenMeta = {
        addr: ADDR.BIGGI || ADDR.BIGGI_TOKEN || null,
        symbol: tokenSymbol || "BIGGI",
        decimals: Number.isFinite(Number(tokenDecimals))
          ? Number(tokenDecimals)
          : 18,
      };
      let tokenBalances = [];
      let lpStats = null;

      const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
        "function totalSupply() view returns (uint256)",
      ];

      try {
        if (tokenMeta.addr) {
          const token = new Contract(tokenMeta.addr, erc20Abi, prov);
          const [dec, sym] = await Promise.all([
            token.decimals().catch(() => null),
            token.symbol().catch(() => null),
          ]);
          if (Number.isFinite(Number(dec))) tokenMeta.decimals = Number(dec);
          if (typeof sym === "string" && sym) tokenMeta.symbol = sym;

          const tokenTargets = [
            { key: "reserve", name: "Reserve", addr: ADDR.RESERVE },
            { key: "treasury", name: "Treasury", addr: ADDR.TREASURY },
            { key: "buyback", name: "Buyback Agent", addr: ADDR.BUYBACK_AGENT },
            { key: "tokenRewards", name: "Token Rewards", addr: ADDR.TOKEN_REWARDS },
            {
              key: "collectionRewards",
              name: "Collection Rewards",
              addr: ADDR.COLLECTION_REWARDS,
            },
            { key: "nftRewards", name: "NFT Rewards", addr: ADDR.NFT_REWARDS },
            {
              key: "community",
              name: "Community Center",
              addr: ADDR.COMMUNITY_CENTER || ADDR.COMMUNITYCENTER,
            },
            {
              key: "liquidityVault",
              name: "Liquidity Vault",
              addr: ADDR.LIQUIDITY_VAULT,
            },
            {
              key: "liquidityManager",
              name: "Liquidity Manager",
              addr: ADDR.LM,
            },
            { key: "distributor", name: "Distributor", addr: ADDR.DISTRIBUTOR },
          ];

          const tokenBalanceArr = await Promise.all(
            tokenTargets.map((t) =>
              t.addr ? token.balanceOf(t.addr).catch(() => null) : null,
            ),
          );

          tokenBalances = tokenTargets.map((t, i) => ({
            ...t,
            balance: tokenBalanceArr[i],
          }));
        }
      } catch (err) {
        const handled = handleReadRpcFailure(err, "refreshPools token balances");
        if (!handled) {
          console.warn("refreshPools: token balances failed", err);
        }
      }

      try {
        const lpAddr = ADDR.PAIR || null;
        if (lpAddr) {
          const lp = new Contract(lpAddr, erc20Abi, prov);
          const [dec, sym, totalSupply] = await Promise.all([
            lp.decimals().catch(() => null),
            lp.symbol().catch(() => null),
            lp.totalSupply().catch(() => null),
          ]);
          const lpDecimals = Number.isFinite(Number(dec)) ? Number(dec) : 18;
          const lpSymbol = typeof sym === "string" && sym ? sym : "LP";
          const lpHolders = [
            {
              key: "liquidityVault",
              name: "Liquidity Vault",
              addr: ADDR.LIQUIDITY_VAULT,
            },
            { key: "treasury", name: "Treasury", addr: ADDR.TREASURY },
            { key: "reserve", name: "Reserve", addr: ADDR.RESERVE },
          ];
          const lpBalanceArr = await Promise.all(
            lpHolders.map((t) =>
              t.addr ? lp.balanceOf(t.addr).catch(() => null) : null,
            ),
          );
          lpStats = {
            addr: lpAddr,
            symbol: lpSymbol,
            decimals: lpDecimals,
            totalSupply,
            balances: lpHolders.map((t, i) => ({
              ...t,
              balance: lpBalanceArr[i],
            })),
          };
        }
      } catch (err) {
        const handled = handleReadRpcFailure(err, "refreshPools LP stats");
        if (!handled) {
          console.warn("refreshPools: LP stats failed", err);
        }
      }

      setPools({
        distributor: ADDR.DISTRIBUTOR,
        distributorBal: distBal,
        totalReceived,
        receivedForMain,
        targets,
        allocations,
        balances,
        tokenMeta,
        tokenBalances,
        lpStats,
      });
    } catch (e) {
      const handled = handleReadRpcFailure(e, "refreshPools");
      if (!handled) {
        console.error("refreshPools error", e);
        setPools(null);
      }
    }
  }, [tokenDecimals, tokenSymbol, handleReadRpcFailure]);

  // BIGGI ECOSYSTEM METRICS (unchanged intent, contract reads robustified)
  const [biggiPrice, setBiggiPrice] = React.useState(null);
  const [priceQuoteSymbol, setPriceQuoteSymbol] = React.useState("POL");
  const [biggiChange24h, setBiggiChange24h] = React.useState(null);
  const [biggiSupply, setBiggiSupply] = React.useState(null);
  const [circulatingSupply, setCirculatingSupply] = React.useState(null);
  const [tradableSupply, setTradableSupply] = React.useState(null);
  const biggiMcap = React.useMemo(() => {
    const supplyForMarketCap =
      typeof circulatingSupply === "number" ? circulatingSupply : null;
    if (
      typeof biggiPrice === "number" &&
      typeof supplyForMarketCap === "number"
    ) {
      return biggiPrice * supplyForMarketCap;
    }
    return null;
  }, [biggiPrice, circulatingSupply]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const prov = (() => {
          try {
            return getROProvider();
          } catch {
            return null;
          }
        })();
        if (!prov) return;

        const tokenAddr =
          (ADDR && (ADDR.BIGGI || ADDR.TOKEN || ADDR.BIGGI_TOKEN)) || null;

        if (tokenAddr) {
          const erc20Abi = [
            "function totalSupply() view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)",
          ];
          const token = new Contract(tokenAddr, erc20Abi, prov);

          const [supBn, dec, sym] = await Promise.all([
            token.totalSupply().catch(() => null),
            token.decimals().catch(() => null),
            token.symbol().catch(() => null),
          ]);

          if (!alive) return;

          if (sym && typeof sym === "string") {
            setTokenSymbol(sym);
          }
          if (Number.isFinite(Number(dec))) {
            setTokenDecimals(Number(dec));
          }
          if (supBn && Number.isFinite(Number(dec))) {
            const sup = Number(_formatUnits(supBn, Number(dec)));
            if (Number.isFinite(sup)) setBiggiSupply(sup);
          }
        }

        const priceOracleAddr =
          (ADDR && (ADDR.BIGGI_PRICE_ORACLE || ADDR.PRICE_ORACLE)) || null;

        if (priceOracleAddr) {
          const oracleAbi = [
            "function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)",
            "function decimals() view returns (uint8)",
          ];
          const oracle = new Contract(priceOracleAddr, oracleAbi, prov);
          const [round, dec] = await Promise.all([
            oracle.latestRoundData().catch(() => null),
            oracle.decimals().catch(() => 8),
          ]);
          if (!alive) return;
          if (round && round.answer != null) {
            const p = Number(_formatUnits(round.answer, Number(dec)));
            if (Number.isFinite(p)) setBiggiPrice(p);
          }
          // setBiggiChange24h(xxx);
        }
      } catch (e) {
        const handled = handleReadRpcFailure(e, "LiveStats token metrics");
        if (!handled) {
          console.warn("LiveStats: failed reading token metrics", e);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [handleReadRpcFailure]);

  React.useEffect(() => {
    let alive = true;
    if (
      biggiSupply == null ||
      typeof biggiSupply !== "number" ||
      biggiSupply === 0
    ) {
      setCirculatingSupply(null);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const provider = (() => {
          try {
            return getROProvider();
          } catch {
            return null;
          }
        })();
        if (!provider) return;

        const token = (() => {
          try {
            return getTokenRO(provider);
          } catch {
            return null;
          }
        })();
        if (!token || typeof token.balanceOf !== "function") return;

        const lockedAddrs = [
          ADDR.RESERVE,
          ADDR.TOKEN_REWARDS,
          ADDR.DRIP_DISTRIBUTOR,
        ].filter(Boolean);
        if (!lockedAddrs.length) return;

        const decimalsForLocked = Number.isFinite(Number(tokenDecimals))
          ? Number(tokenDecimals)
          : 18;

        const balances = await Promise.all(
          lockedAddrs.map((addr) =>
            token.balanceOf(addr).catch(() => 0n),
          ),
        );
        if (!alive) return;

        const locked = balances.reduce((sum, bn) => {
          const n = Number(
            _formatUnits(bn ?? 0n, decimalsForLocked),
          );
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        if (!Number.isFinite(locked)) return;

        const circulating = Math.max(0, biggiSupply - locked);
        if (!alive) return;
        setCirculatingSupply(circulating);
      } catch (err) {
        const handled = handleReadRpcFailure(
          err,
          "LiveStats circulating supply",
        );
        if (!handled) {
          console.warn("LiveStats: failed to compute circulating supply", err);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [biggiSupply, tokenDecimals, handleReadRpcFailure]);

  // DEX price fallback (robust contract usage) - computes price against any quote token, respects decimals, updates quote symbol
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!ADDR?.PAIR) return;
        const pair = (() => {
          try {
            return getPairRO();
          } catch {
            return null;
          }
        })();
        if (!pair || typeof pair.getReserves !== "function") return;

        const [r0, r1] = await pair.getReserves();
        const [t0, t1] = await Promise.all([pair.token0(), pair.token1()]);

        const biggiAddr = (ADDR.BIGGI || ADDR.BIGGI_TOKEN || "").toLowerCase();
        const addr0 = String(t0 || "").toLowerCase();
        const addr1 = String(t1 || "").toLowerCase();
        if (!biggiAddr || !addr0 || !addr1) return;

        const erc20Meta = async (addr) => {
          try {
            const abi = [
              "function decimals() view returns (uint8)",
              "function symbol() view returns (string)",
            ];
            const erc = new Contract(addr, abi, getROProvider());
            const [dec, sym] = await Promise.all([
              erc.decimals().catch(() => 18),
              erc.symbol().catch(() => ""),
            ]);
            return {
              decimals: Number(dec) || 18,
              symbol: typeof sym === "string" && sym.length ? sym : "",
            };
          } catch {
            return { decimals: 18, symbol: "" };
          }
        };

        const [m0, m1] = await Promise.all([erc20Meta(t0), erc20Meta(t1)]);
        if (cancel) return;

        const normalizeQuoteSymbol = (sym) => {
          const s = String(sym || "").toUpperCase();
          if (!s) return "POL";
          if (["WETH", "WMATIC", "WPOL", "W-POL"].includes(s)) return "POL";
          return sym;
        };

        let price = null;
        let dexTradable = null;
        if (addr0 === biggiAddr) {
          const base = Number(_formatUnits(r0, m0.decimals));
          const quote = Number(_formatUnits(r1, m1.decimals));
          if (Number.isFinite(base) && base >= 0) {
            dexTradable = base;
          }
          if (
            Number.isFinite(base) &&
            base > 0 &&
            Number.isFinite(quote) &&
            quote > 0
          ) {
            price = quote / base;
            if (m1.symbol) setPriceQuoteSymbol(normalizeQuoteSymbol(m1.symbol));
          }
        } else if (addr1 === biggiAddr) {
          const base = Number(_formatUnits(r1, m1.decimals));
          const quote = Number(_formatUnits(r0, m0.decimals));
          if (Number.isFinite(base) && base >= 0) {
            dexTradable = base;
          }
          if (
            Number.isFinite(base) &&
            base > 0 &&
            Number.isFinite(quote) &&
            quote > 0
          ) {
            price = quote / base;
            if (m0.symbol) setPriceQuoteSymbol(normalizeQuoteSymbol(m0.symbol));
          }
        }

        if (!cancel) {
          if (Number.isFinite(dexTradable) && dexTradable >= 0) {
            setTradableSupply(dexTradable);
          } else {
            setTradableSupply(null);
          }
          if (Number.isFinite(price) && price > 0) {
            setBiggiPrice(price);
          }
        }
      } catch (e) {
        const handled = handleReadRpcFailure(e, "LiveStats DEX price");
        if (!handled) {
          console.warn("LiveStats: failed reading DEX price", e);
          if (!cancel) setTradableSupply(null);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [handleReadRpcFailure]);

  // Layout
  const BOX = isPhone ? (isTiny ? 110 : 130) : 150;
  const PADDING = isPhone
    ? isTiny
      ? "14px 12px 12px 12px"
      : "24px 16px 18px 16px"
    : "38px 44px 32px 44px";
  const boxFontSize = isTiny ? "0.78em" : isPhone ? "0.9em" : "1.02em";
  const boxBigFontSize = isTiny ? "1.06em" : isPhone ? "1.22em" : "1.42em";
  const infoCardFontSize = isTiny ? "0.54em" : isPhone ? "0.64em" : "0.74em";
  const infoCardBigFontSize = isTiny ? "0.96em" : isPhone ? "1.12em" : "1.24em";
  const tokenomicsLabelFontSize = isTiny ? "0.68em" : isPhone ? "0.78em" : "0.86em";
  const marketCapBoxLabelFontSize = isTiny ? "0.6em" : isPhone ? "0.7em" : "0.78em";
  const marketCapBoxValueFontSize = isTiny ? "0.72em" : isPhone ? "0.82em" : "0.92em";
  const marketCapBoxBigValueFontSize = isTiny ? "0.92em" : isPhone ? "1.04em" : "1.16em";
  const mobileMaxWidth = isPhone ? (isTiny ? 320 : 420) : undefined;
  const statsBoxWidth = isPhone ? (isTiny ? "100%" : "calc(50% - 6px)") : BOX;
  const statsBoxHeight = isPhone ? "auto" : BOX;
  const statsBoxMinHeight = isPhone ? (isTiny ? 96 : 110) : BOX;
  const infoBoxWidth = isPhone ? "100%" : BOX;
  const infoBoxHeight = isPhone ? "auto" : BOX;
  const infoBoxMinHeight = isPhone ? (isTiny ? 110 : 120) : BOX;
  const imageBox = isPhone ? (isTiny ? 150 : 170) : BOX;
  const statsGroupDirection = isPhone ? (isTiny ? "column" : "row") : "column";
  const statsGroupWidth = isPhone ? "100%" : statsBoxWidth;

  const widgetStyle = {
    minWidth: isPhone ? "auto" : 700,
    width: isPhone ? "94vw" : undefined,
    maxWidth: isPhone ? "94vw" : 800,
    minHeight: isPhone ? (isTiny ? 280 : 320) : 320,
    padding: PADDING,
    display: "flex",
    flexDirection: "column",
    alignItems: isPhone ? "stretch" : "center",
    justifyContent: "flex-start",
    border: "3px solid #ffe800",
    borderRadius: isPhone ? 16 : 23,
    boxShadow: "0 12px 60px rgba(0,0,0,0.7), 0 0 18px #ffe800",
    position: "relative",
    zIndex: 20,
    transform: isPhone ? "none" : "translate(254px, -92px)",
    overflow: "hidden",
    backgroundImage: 'url("/images/blocks-bg.png")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backdropFilter: isPhone ? "blur(4px)" : "blur(8px)",
  };

  const statsMainFlex = {
    width: "100%",
    display: "flex",
    flexDirection: isPhone ? "column" : "row",
    justifyContent: "center",
    alignItems: isPhone ? "stretch" : "flex-start",
    gap: isPhone ? (isTiny ? "10px" : "14px") : "36px",
    marginTop: isPhone ? "8px" : "20px",
  };

  const columnCenter = {
    display: "flex",
    flexDirection: "column",
    alignItems: isPhone ? "stretch" : "center",
    justifyContent: "center",
    gap: isPhone ? "12px" : "8px",
    marginTop: "0",
    width: isPhone ? "100%" : statsGroupWidth,
    maxWidth: mobileMaxWidth,
  };

  const statsTable = {
    width: statsBoxWidth,
    height: statsBoxHeight,
    minHeight: statsBoxMinHeight,
    fontSize: boxFontSize,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    margin: isPhone ? 0 : "0 auto",
    gap: isPhone ? 4 : 6,
    backgroundImage: 'url("/images/blocks-bg.png")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    padding: isPhone ? "10px 12px" : "14px 18px",
    borderRadius: 16,
    boxShadow: "0 6px 20px rgba(0,0,0,0.6), 0 0 12px #ffe800",
    border: "1px solid rgba(255, 232, 0, 0.5)",
    transition: "all 0.3s ease",
    boxSizing: "border-box",
  };

  const ticketPriceTable = {
    ...statsTable,
    marginTop: isPhone ? (isTiny ? "6px" : "8px") : "12px",
    height: statsBoxHeight,
    padding: isPhone ? "10px 12px" : "14px 18px",
  };

  const statsGroupStyle = {
    display: "flex",
    flexDirection: statsGroupDirection,
    gap: isPhone ? "10px" : "8px",
    marginTop: "0",
    width: statsGroupWidth,
    alignItems: "stretch",
    justifyContent: isPhone && !isTiny ? "space-between" : "center",
    flexWrap: isPhone && !isTiny ? "wrap" : "nowrap",
  };

  const titleStyle = { color: "#fff", fontWeight: 700, fontSize: boxFontSize };
  const metricLabelStyle = {
    ...titleStyle,
    alignSelf: "center",
    textAlign: "center",
    lineHeight: 1.25,
  };
  const tokenomicsLabelStyle = {
    ...metricLabelStyle,
    fontSize: tokenomicsLabelFontSize,
    lineHeight: 1.15,
  };
  const metricValueRowStyle = {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: isPhone ? 4 : 6,
    rowGap: 2,
    textAlign: "center",
    lineHeight: 1.2,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };
  const infoRowStyle = {
    width: "100%",
    color: "#fff",
    textTransform: "uppercase",
    fontSize: infoCardFontSize,
    textAlign: "center",
    lineHeight: 1.3,
    overflowWrap: "normal",
    wordBreak: "normal",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const thBase = {
    position: "sticky",
    top: 0,
    zIndex: 1,
    background:
      "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.85) 100%)",
    backdropFilter: "blur(3px)",
    color: "#ffe800",
    textAlign: "center",
    fontWeight: 900,
    textTransform: "uppercase",
    fontSize: "0.88em",
    padding: isPhone ? "8px 6px" : "10px 8px",
    borderBottom: "1px solid rgba(255,232,0,0.25)",
    letterSpacing: "0.3px",
  };

  const tdBase = {
    padding: isPhone ? "8px 6px" : "10px 8px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: isPhone ? "0.95em" : undefined,
  };

  const poolsTableStyle = React.useMemo(
    () => ({
      width: "100%",
      borderCollapse: "collapse",
      tableLayout: "fixed",
    }),
    [],
  );

  // ====== CLAIM integration ======
  const [claimBusy, setClaimBusy] = React.useState(false);
  const [claimMsg, setClaimMsg] = React.useState("");

  const collectTokenIds = () => {
    const out = [];
    for (const it of Array.isArray(normalizedItems) ? normalizedItems : []) {
      if (it?.isTicket || it?.isPending) continue;
      const raw = it?.tokenId ?? it?.id;
      if (raw == null) continue;
      const s = String(raw);
      const n = Number(s);
      if (Number.isFinite(n) && n > 0) out.push(s); // pass as string; ethers handles
    }
    return out;
  };

  const canClaim = React.useMemo(
    () => collectTokenIds().length > 0,
    [normalizedItems],
  );

  const handleClaim = async () => {
    if (claimBusy) return;
    if (!canClaim) {
      alert("No token IDs to claim for.");
      return;
    }
    const eth = getInjectedProvider();
    if (!eth?.request) {
      alert("Injected wallet not detected.");
      return;
    }

    setClaimBusy(true);
    setClaimMsg("Preparing transaction…");
    try {
      // ensure account
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts || !accounts.length) throw new Error("No accounts");

      const provider = new BrowserProvider(eth, "any");
      const signer = await provider.getSigner();

      const REWARDSAddr =
        ADDR?.TOKEN_REWARDS ||
        ADDR?.BIGGI_TOKEN_REWARDS ||
        ADDR?.REWARDS ||
        null;
      if (!REWARDSAddr) throw new Error("REWARDS contract address missing");

      const REWARDS = new Contract(
        REWARDSAddr,
        TOKEN_REWARDS_MIN_ABI,
        signer,
      );
      const tokenIds = collectTokenIds();

      // gas estimate
      let gas;
        try {
          const estimateClaim =
            REWARDS.estimateGas?.claim || REWARDS.claim?.estimateGas;
          const est = estimateClaim ? await estimateClaim(tokenIds) : null;
          if (est != null) {
            if (isBigNumber(est) && typeof est.mul === "function") {
              gas = est.mul(110).div(100);
          } else if (typeof est === "bigint") {
            gas = (est * 110n) / 100n;
          } else {
            gas = est;
          }
        } else {
          gas = undefined;
        }
      } catch {
        gas = undefined;
      }

      setClaimMsg("Sending transaction…");
      const tx = await REWARDS.claim(tokenIds, gas ? { gasLimit: gas } : {});
      setClaimMsg(`Pending: ${tx.hash || ""}`);

      const receipt = await (tx.wait
        ? tx.wait()
        : provider.waitForTransaction(tx.hash));
      if (receipt?.status === 0) throw new Error("Transaction failed");

      setClaimMsg("Claim successful");
      alert("Claim successful.");
    } catch (err) {
      console.error("Claim failed", err);
      const msg = String(
        err?.reason || err?.data?.message || err?.message || err,
      );
      setClaimMsg(`Failed: ${msg}`);
      alert(`Claim failed: ${msg}`);
    } finally {
      setClaimBusy(false);
      setTimeout(() => setClaimMsg(""), 4000);
    }
  };

  const actionBtnBase = React.useMemo(
    () => ({
      fontWeight: "bold",
      padding: isPhone ? "10px 16px" : "10px 18px",
      borderRadius: 10,
      cursor: "pointer",
      minWidth: 180,
    }),
    [isPhone],
  );

  const menuBtnBase = React.useMemo(
    () => ({
      ...actionBtnBase,
    }),
    [actionBtnBase],
  );

  const modalOverlayStyle = React.useMemo(() => {
    if (desktopFullscreen) {
      return {
        position: "absolute",
        top: modalViewportTop,
        left: 0,
        right: 0,
        zIndex: 10060,
        width: "100vw",
        height:
          modalViewportHeight > 0 ? `${modalViewportHeight}px` : "100vh",
        display: "flex",
        justifyContent: "stretch",
        alignItems: "stretch",
        pointerEvents: "auto",
        padding: 0,
        overflow: "hidden",
        overscrollBehavior: "none",
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        isolation: "isolate",
      };
    }

    return {
      position: "fixed",
      inset: 0,
      zIndex: 10060,
      width: "100vw",
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      pointerEvents: "auto",
      padding: 0,
      overflow: "hidden",
      overscrollBehavior: "none",
      backgroundColor: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(6px)",
      isolation: "isolate",
    };
  }, [desktopFullscreen, modalViewportHeight, modalViewportTop]);

  const fullscreenModalFrameStyle = React.useMemo(
    () => ({
      width: "100%",
      height: "100%",
      display: "flex",
      justifyContent: desktopFullscreen ? "stretch" : "center",
      alignItems: desktopFullscreen ? "stretch" : "center",
      padding: 0,
    }),
    [desktopFullscreen],
  );

  const fullscreenModalCardStyle = React.useMemo(() => {
    return {
      width: "100vw",
      height: "100vh",
      maxWidth: "100vw",
      maxHeight: "100vh",
      overflowX: "hidden",
      overflowY: desktopFullscreen ? "hidden" : "auto",
      borderRadius: 0,
      border: "2px solid #ffe800",
      boxShadow: "none",
      backgroundImage:
        'linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.45) 100%), url("/images/widget-bg-dark.png")',
      backgroundSize: "cover, cover",
      backgroundPosition: "center, center",
      backgroundRepeat: "no-repeat, no-repeat",
      padding: 0,
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      overscrollBehavior: desktopFullscreen ? "none" : "contain",
    };
  }, [desktopFullscreen]);

  const tokenomicsModalBodyStyle = React.useMemo(
    () => ({
      flex: 1,
      minHeight: 0,
      overflowY: isPhone ? "auto" : "hidden",
      overflowX: "hidden",
      WebkitOverflowScrolling: "touch",
      overscrollBehavior: isPhone ? "contain" : "none",
      touchAction: isPhone ? "pan-y" : "none",
      padding: isPhone ? 8 : 12,
      boxSizing: "border-box",
    }),
    [isPhone],
  );

  const tokenomicsModalGridStyle = React.useMemo(
    () =>
      desktopFullscreen
        ? {
            marginTop: 0,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 10,
            height: "100%",
            minHeight: 0,
            alignItems: "stretch",
          }
        : {
            marginTop: isPhone ? 6 : 10,
            display: "grid",
            gap: isPhone ? 8 : 12,
          },
    [desktopFullscreen, isPhone],
  );

  const chatModalContentStyle = React.useMemo(
    () => ({
      flex: 1,
      minHeight: 0,
      overflow: desktopFullscreen ? "hidden" : "auto",
      padding: isPhone ? 8 : 14,
      boxSizing: "border-box",
    }),
    [desktopFullscreen, isPhone],
  );

  const modalHeaderStyle = React.useMemo(
    () => ({
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: isPhone ? "6px 6px" : "6px 8px",
      borderBottom: "1px solid rgba(255,232,0,0.25)",
      position: "sticky",
      top: 0,
      background: "rgba(6,6,6,0.9)",
      backdropFilter: "blur(6px)",
      zIndex: 5,
    }),
    [isPhone],
  );

  const captureModalViewport = React.useCallback(() => {
    if (typeof window !== "undefined") {
      const nextTop = window.scrollY || window.pageYOffset || 0;
      modalViewportTopRef.current = nextTop;
      setModalViewportTop(nextTop);
      setModalViewportHeight(window.innerHeight || 0);
    }
    if (typeof document !== "undefined") {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
    }
  }, []);

  const restoreModalViewport = React.useCallback(() => {
    if (!desktopFullscreen || typeof window === "undefined") return;
    const nextTop = modalViewportTopRef.current || 0;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo(0, nextTop);
      });
    });
  }, [desktopFullscreen]);

  const closeWeeklyModal = React.useCallback(() => {
    setWeeklyOpen(false);
    restoreModalViewport();
  }, [restoreModalViewport]);

  const closePoolsModal = React.useCallback(() => {
    setPoolsOpen(false);
    restoreModalViewport();
  }, [restoreModalViewport]);

  const closeChatModal = React.useCallback(() => {
    setChatOpen(false);
    restoreModalViewport();
  }, [restoreModalViewport]);

  const handleToggleWeekly = React.useCallback(() => {
    setWeeklyOpen((v) => {
      const next = !v;
      if (next) captureModalViewport();
      return next;
    });
  }, [captureModalViewport]);

  const handlePoolsButtonClick = React.useCallback(async () => {
    const next = !poolsOpen;
    if (next) captureModalViewport();
    setPoolsOpen(next);
    if (next) await refreshPools();
  }, [captureModalViewport, poolsOpen, refreshPools]);

  const handleChatButtonClick = React.useCallback(() => {
    setChatOpen((v) => {
      const next = !v;
      if (next) captureModalViewport();
      return next;
    });
  }, [captureModalViewport]);

  React.useEffect(() => {
    if (!desktopFullscreen) return undefined;
    if (!(weeklyOpen || poolsOpen || chatOpen)) return undefined;
    if (typeof document === "undefined") return undefined;
    const preventScroll = (event) => {
      event.preventDefault();
    };
    const preventScrollKeys = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = String(target.tagName || "").toUpperCase();
        const isEditable =
          target.isContentEditable ||
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT";
        if (isEditable) return;
      }

      const key = String(event.key || "");
      const code = String(event.code || "");
      const scrollKeys = new Set([
        " ",
        "Space",
        "Spacebar",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        "ArrowUp",
        "ArrowDown",
      ]);
      if (scrollKeys.has(key) || scrollKeys.has(code)) {
        event.preventDefault();
      }
    };

    document.addEventListener("wheel", preventScroll, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchmove", preventScroll, {
      passive: false,
      capture: true,
    });
    document.addEventListener("keydown", preventScrollKeys, {
      capture: true,
    });

    return () => {
      document.removeEventListener("wheel", preventScroll, {
        capture: true,
      });
      document.removeEventListener("touchmove", preventScroll, {
        capture: true,
      });
      document.removeEventListener("keydown", preventScrollKeys, {
        capture: true,
      });
    };
  }, [chatOpen, desktopFullscreen, poolsOpen, weeklyOpen]);

  React.useEffect(() => {
    if (!weeklyOpen) return;
    syncWeeklyInfo();
  }, [weeklyOpen, syncWeeklyInfo]);

  const menuButtons = React.useMemo(
    () => [
      { label: "BLOCKS", active: showBlocks, onClick: openBlocks },
      { label: "BACKGROUNDS", active: showBgStats, onClick: openBackgrounds },
      { label: "COLLECTION STATS", active: showREWARDS, onClick: openREWARDS },
    ],
    [
      showBlocks,
      openBlocks,
      showBgStats,
      openBackgrounds,
      showREWARDS,
      openREWARDS,
    ],
  );

  const topButtonsRow = (
    <div
      className="live-stats-buttons-row"
      style={{
        display: "flex",
        justifyContent: isPhone ? "space-between" : "center",
        alignItems: "center",
        gap: isPhone ? "6px" : "12px",
        marginBottom: isPhone ? "8px" : "10px",
        marginTop: isPhone ? "22px" : "30px",
        flexWrap: isPhone ? "wrap" : "nowrap",
        width: "100%",
      }}
    >
      {menuButtons.map((btn) => (
        <button
          type="button"
          key={btn.label}
          onClick={btn.onClick}
          aria-pressed={btn.active}
          className={`live-menu-btn live-menu-btn--legacy ${btn.active ? "is-active" : ""}`}
          style={{
            ...menuBtnBase,
            ...(isPhone
              ? { flex: "1 1 0%", minWidth: 0, textAlign: "center" }
              : { minWidth: 180 }),
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );

  // current block price for the last minted block (fallback to base if missing)
  const currentBlockPrice = React.useMemo(() => {
    const idx =
      Array.isArray(safeBlockNames) &&
      effectiveLastMinted.blockName &&
      effectiveLastMinted.blockName !== "-"
        ? safeBlockNames.indexOf(
            String(effectiveLastMinted.blockName).toUpperCase(),
          )
        : -1;
    const live =
      idx >= 0 ? Number(effectiveBlockPrices?.[idx]) : Number.NaN;
    if (Number.isFinite(live) && live > 0) return live;
    const key =
      idx >= 0
        ? String(
            safeBlockNames[idx] || effectiveLastMinted.blockName || "",
          ).toUpperCase()
        : String(effectiveLastMinted.blockName || "").toUpperCase();
    const base =
      typeof BASE_PRICES?.[key] === "number"
        ? BASE_PRICES[key]
        : idx >= 0
          ? idx + 1
          : null;
    return Number.isFinite(Number(base)) ? Number(base) : null;
  }, [safeBlockNames, effectiveLastMinted.blockName, effectiveBlockPrices]);

  const normalizedLastRedeemedBlock = React.useMemo(
    () => String(effectiveLastMinted.blockName || "").trim().toUpperCase(),
    [effectiveLastMinted.blockName],
  );

  const normalizedLastRedeemedBackground = React.useMemo(
    () => normalizeBackgroundName(effectiveLastMinted.backgroundName),
    [effectiveLastMinted.backgroundName],
  );

  const lastRedeemedBackgroundBonusPct = React.useMemo(() => {
    if (!normalizedLastRedeemedBackground) return null;
    const namesSource =
      Array.isArray(safeBlockNames) && safeBlockNames.length
        ? safeBlockNames
        : DEFAULT_BLOCKS;
    const names = namesSource.map((n) => String(n || "").trim().toUpperCase());
    const idx = names.indexOf(normalizedLastRedeemedBackground);
    if (idx < 0) return null;
    const bonus = Number(BACKGROUND_BONUSES[idx]);
    return Number.isFinite(bonus) ? bonus : null;
  }, [safeBlockNames, normalizedLastRedeemedBackground]);

  const lastRedeemedBackgroundBonusValue = React.useMemo(() => {
    const base = Number(currentBlockPrice);
    const pct = Number(lastRedeemedBackgroundBonusPct);
    if (!Number.isFinite(base) || !Number.isFinite(pct)) return null;
    return (base * pct) / 100;
  }, [currentBlockPrice, lastRedeemedBackgroundBonusPct]);

  const computedLastFinalPrice = React.useMemo(() => {
    const base = Number(currentBlockPrice);
    const bonus = Number(lastRedeemedBackgroundBonusValue);
    if (!Number.isFinite(base)) return null;
    if (!Number.isFinite(bonus)) return base;
    return base + bonus;
  }, [currentBlockPrice, lastRedeemedBackgroundBonusValue]);

  const resolvedLastMintBlockPrice = React.useMemo(() => {
    const blockPrice = Number(lastMintPriceData?.blockPrice);
    return Number.isFinite(blockPrice) && blockPrice > 0 ? blockPrice : null;
  }, [lastMintPriceData?.blockPrice]);

  const resolvedLastMintFinalPrice = React.useMemo(() => {
    const finalPrice = Number(lastMintPriceData?.finalPrice);
    return Number.isFinite(finalPrice) && finalPrice > 0 ? finalPrice : null;
  }, [lastMintPriceData?.finalPrice]);

  const effectiveDisplayedBlockPrice = React.useMemo(() => {
    if (resolvedLastMintBlockPrice != null) return resolvedLastMintBlockPrice;
    const current = Number(currentBlockPrice);
    return Number.isFinite(current) && current > 0 ? current : null;
  }, [resolvedLastMintBlockPrice, currentBlockPrice]);

  const effectiveDisplayedBgBonusValue = React.useMemo(() => {
    if (
      resolvedLastMintFinalPrice != null &&
      resolvedLastMintBlockPrice != null &&
      resolvedLastMintFinalPrice >= resolvedLastMintBlockPrice
    ) {
      return resolvedLastMintFinalPrice - resolvedLastMintBlockPrice;
    }
    const fallback = Number(lastRedeemedBackgroundBonusValue);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
  }, [
    resolvedLastMintFinalPrice,
    resolvedLastMintBlockPrice,
    lastRedeemedBackgroundBonusValue,
  ]);

  const effectiveLastFinalPrice = React.useMemo(() => {
    if (resolvedLastMintFinalPrice != null) return resolvedLastMintFinalPrice;
    const computed = Number(computedLastFinalPrice);
    if (Number.isFinite(computed) && computed > 0) return computed;
    const fromProp = Number(lastFinalPrice);
    if (Number.isFinite(fromProp) && fromProp > 0) return fromProp;
    const fromChain = Number(lastFinalFromChain);
    if (Number.isFinite(fromChain) && fromChain > 0) return fromChain;
    return null;
  }, [
    resolvedLastMintFinalPrice,
    computedLastFinalPrice,
    lastFinalPrice,
    lastFinalFromChain,
  ]);

  const hasCurrentBlockPrice = Number.isFinite(
    Number(effectiveDisplayedBlockPrice),
  );
  const hasLastRedeemedBgBonusPct = Number.isFinite(
    Number(lastRedeemedBackgroundBonusPct),
  );
  const hasLastRedeemedBgBonusValue = Number.isFinite(
    Number(effectiveDisplayedBgBonusValue),
  );

  const formatMaybe = React.useCallback((value, digits = 2) => {
    if (value == null || !Number.isFinite(Number(value))) return "--";
    const n = Number(value);
    return n.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }, []);

  const formatSigned = React.useCallback((value, digits = 2) => {
    if (value == null || !Number.isFinite(Number(value))) return "--";
    const n = Number(value);
    const sign = n > 0 ? "+" : n < 0 ? "-" : "";
    const abs = Math.abs(n);
    return (
      sign +
      abs.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    );
  }, []);

  const collectionBlockNames = React.useMemo(() => {
    const names = Array.isArray(safeBlockNames) ? safeBlockNames : [];
    return names.length ? names : DEFAULT_BLOCKS;
  }, [safeBlockNames]);

  const blockPriceStats = React.useMemo(() => {
    const values = (effectiveBlockPrices || [])
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
    if (!values.length) return { avg: null, min: null, max: null };
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { avg, min, max };
  }, [effectiveBlockPrices]);

  const totalBackgroundMinted = React.useMemo(
    () =>
      (effectiveBackgroundMintCounts || []).reduce(
        (acc, v) => acc + (Number(v) || 0),
        0,
      ),
    [effectiveBackgroundMintCounts],
  );

  const totalBlockMinted = React.useMemo(
    () =>
      (effectiveBlockMintCounts || []).reduce(
        (acc, v) => acc + (Number(v) || 0),
        0,
      ),
    [effectiveBlockMintCounts],
  );

  const ownedNftCount = React.useMemo(() => {
    const arr = Array.isArray(normalizedItems) ? normalizedItems : [];
    return arr.filter((it) => it && !it.isTicket && !it.isPending).length;
  }, [normalizedItems]);

  const collectionBlockRows = React.useMemo(() => {
    return collectionBlockNames.map((name, idx) => {
      const live = Number(effectiveBlockPrices?.[idx]);
      const base = Number(BASE_PRICES?.[name] ?? idx + 1);
      const minted = Number(effectiveBlockMintCounts?.[idx] ?? 0);
      const liveValue = Number.isFinite(live) ? live : base;
      const delta = Number.isFinite(liveValue) ? liveValue - base : 0;
      return {
        name,
        minted,
        base,
        live: Number.isFinite(live) ? live : null,
        delta,
      };
    });
  }, [
    collectionBlockNames,
    effectiveBlockPrices,
    effectiveBlockMintCounts,
  ]);

  const collectionBackgroundRows = React.useMemo(() => {
    return collectionBlockNames.map((name, idx) => {
      const minted = Number(effectiveBackgroundMintCounts?.[idx] ?? 0);
      const base = Number(BASE_PRICES?.[name] ?? idx + 1);
      const live = Number(effectiveBlockPrices?.[idx]);
      const delta = Number.isFinite(live) ? live - base : 0;
      return {
        name,
        minted,
        bonus: BACKGROUND_BONUSES[idx] ?? 0,
        delta,
      };
    });
  }, [
    collectionBlockNames,
    effectiveBackgroundMintCounts,
    effectiveBlockPrices,
  ]);


  const userBlockCounts = React.useMemo(() => {
    const counts = new Array(10).fill(0);
    const arr = Array.isArray(normalizedItems) ? normalizedItems : [];
    for (const it of arr) {
      if (!it || it.isTicket) continue;
      const attrs = Array.isArray(it.meta?.attributes)
        ? it.meta.attributes
        : [];
      const blockIdAttr = attrs.find((a) =>
        ["block id", "block"].includes(
          String(a?.trait_type || "").toLowerCase(),
        ),
      );
      let idx = 0;
      if (blockIdAttr && !Number.isNaN(Number(blockIdAttr.value))) {
        const n = Math.max(1, Math.min(10, Number(blockIdAttr.value)));
        idx = n - 1;
      } else {
        const eyeAttr = attrs.find((a) => {
          const t = String(a?.trait_type || "").toLowerCase();
          return ["block/eye color", "eye color", "eyes"].includes(t);
        });
        if (eyeAttr && eyeAttr.value) {
          const u = String(eyeAttr.value).trim().toUpperCase();
          const pos = safeBlockNames.indexOf(u);
          if (pos !== -1) idx = pos;
        }
      }
      if (idx >= 0 && idx < 10) counts[idx] += 1;
    }
    return counts;
  }, [normalizedItems, safeBlockNames]);

  const userUnitsByBlock = React.useMemo(
    () => userBlockCounts.map((c, i) => c * WEIGHTS[i]),
    [userBlockCounts, WEIGHTS],
  );
  const userTotalUnits = React.useMemo(
    () => userUnitsByBlock.reduce((a, b) => a + b, 0),
    [userUnitsByBlock],
  );

  const unitsToTokenAmountStr = (units) => {
    try {
      if (!unitRewardWei || !Number.isFinite(units))
        return `${units} ${tokenSymbol}`;
      const amountWei = _mul(unitRewardWei, units || 0);
      const s = _formatUnits(amountWei, tokenDecimals);
      const n = Number(s);
      return `${Number.isFinite(n) ? n.toFixed(n >= 1 ? 3 : 6) : s} ${tokenSymbol}`;
    } catch {
      return `${units} ${tokenSymbol}`;
    }
  };

  const fmtPOL = (bn) => {
    try {
      const n = Number(_formatEther(bn));
      return Number.isFinite(n) ? n.toFixed(4) : "-";
    } catch {
      return "-";
    }
  };

  const fmtToken = (bn, dec = 18, digits = 4) => {
    try {
      const n = Number(_formatUnits(bn ?? 0n, dec));
      if (!Number.isFinite(n)) return "-";
      const fixed = n >= 1 ? digits : Math.min(digits + 2, 6);
      return n.toFixed(fixed);
    } catch {
      return "-";
    }
  };

  const shortAddr = (addr) => {
    if (!addr) return "-";
    const s = String(addr);
    return `${s.slice(0, 6)}...${s.slice(-4)}`;
  };

  const resolvedTokenMeta = React.useMemo(() => {
    const fallbackAddr =
      (ADDR && (ADDR.BIGGI || ADDR.BIGGI_TOKEN || ADDR.TOKEN)) || null;
    const source = pools?.tokenMeta || {};
    const decimals = Number.isFinite(Number(source.decimals))
      ? Number(source.decimals)
      : Number.isFinite(Number(tokenDecimals))
        ? Number(tokenDecimals)
        : 18;
    return {
      addr: source.addr || fallbackAddr,
      symbol: source.symbol || tokenSymbol || "TOKEN",
      decimals,
    };
  }, [pools, tokenDecimals, tokenSymbol]);

  const visibleTokenBalanceEntries = React.useMemo(() => {
    const entries = (pools?.tokenBalances || []).filter((entry) => entry?.balance != null);
    return desktopFullscreen ? entries.slice(0, 4) : entries.slice(0, 6);
  }, [desktopFullscreen, pools]);

  const visibleLpHolderEntries = React.useMemo(() => {
    const entries = Array.isArray(pools?.lpStats?.balances)
      ? pools.lpStats.balances
      : [];
    return desktopFullscreen ? entries.slice(0, 2) : entries.slice(0, 3);
  }, [desktopFullscreen, pools]);

  const mainStats = (
    <div className="live-stats-main-flex" style={statsMainFlex}>
      {onlyTickets && !hasConnectedWallet && (
        <div
          style={{
            width: "100%",
            marginBottom: 10,
            padding: isPhone ? "10px 12px" : "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,232,0,0.35)",
            background: "rgba(255,232,0,0.08)",
            color: "#ffe800",
            fontWeight: 700,
            textAlign: "center",
            fontSize: isPhone ? 11 : 12,
            lineHeight: 1.45,
            minHeight: isPhone ? 200 : 216,
          }}
        >
          Top buttons: Collection (Blocks, Backgrounds, Collection Stats).
          <div
            aria-hidden="true"
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(255,232,0,0.6), transparent)",
              margin: "6px auto",
              width: "70%",
            }}
          />
          Bottom buttons: Weekly rewards, tokenomics, live chat.
        </div>
      )}
      <div style={columnCenter}>
        <div
          className="image-table"
          style={{
            width: isPhone ? "100%" : imageBox,
            height: isPhone ? "auto" : imageBox,
            minHeight: imageBox,
            maxWidth: mobileMaxWidth,
            alignSelf: isPhone ? "center" : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "0",
            backgroundImage: 'url("/images/blocks-bg.png")',
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            borderRadius: 16,
            boxShadow: "0 6px 20px rgba(0,0,0,0.6), 0 0 12px #ffe800",
            border: "1px solid rgba(255, 232, 0,0.5)",
            padding: isPhone ? "8px" : "10px",
            position: "relative",
          }}
        >
          {hasLastImage ? (
            <img
              src={displayLastImageSrc}
              alt="Last Minted NFT"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                borderRadius: 12,
                boxShadow: "0 4px 14px rgba(0,0,0,0.6)",
                transition: "all 0.3s ease",
                cursor: "pointer",
              }}
              onLoad={(e) => {
                setLastImageLoaded(true);
                setLastImageFailed(false);
                const loadedSrc = String(
                  e?.currentTarget?.currentSrc || displayLastImageSrc || "",
                ).trim();
                const tokenId = effectiveImageIdentity;
                if (loadedSrc && effectiveTokenId && effectiveTokenId !== "-") {
                  lastStableImageRef.current = loadedSrc;
                  lastStableTokenRef.current = tokenId;
                  cacheLiveStatsImageForToken(tokenId, loadedSrc);
                }
              }}
              onError={() => {
                setLastImageFailed(true);
                setLastImageLoaded(false);

                const currentKey = stripRetryParam(displayLastImageSrc).toLowerCase();
                const currentIdx = lastImageCandidates.findIndex(
                  (candidate) =>
                    stripRetryParam(candidate).toLowerCase() === currentKey,
                );
                if (
                  currentIdx >= 0 &&
                  currentIdx < lastImageCandidates.length - 1
                ) {
                  setLastImageSrc(lastImageCandidates[currentIdx + 1]);
                  setLastImageFailed(false);
                  setLastImageLoaded(false);
                  return;
                }

                // Keep retry flow for IPFS URLs. If retries are exhausted,
                // try the last stable image for the same token and avoid collapsing
                // to the "No wallet NFT yet" placeholder.
                if (!lastImageIsIpfs || lastImageRetryRef.current >= 2) {
                  const tokenId = effectiveImageIdentity;
                  const cachedSrc = getCachedLiveStatsImageForToken(tokenId);
                  if (
                    cachedSrc &&
                    stripRetryParam(cachedSrc).toLowerCase() !== currentKey
                  ) {
                    setLastImageSrc(cachedSrc);
                    setLastImageFailed(false);
                    setLastImageLoaded(false);
                    return;
                  }
                  const stableTokenId = String(lastStableTokenRef.current || "").trim();
                  const stableSrc = String(lastStableImageRef.current || "").trim();
                  if (
                    stableSrc &&
                    effectiveTokenId &&
                    effectiveTokenId !== "-" &&
                    stableTokenId === tokenId &&
                    stableSrc !== displayLastImageSrc
                  ) {
                    setLastImageSrc(stableSrc);
                    setLastImageFailed(false);
                    setLastImageLoaded(true);
                    return;
                  }

                }
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow =
                  "0 6px 25px rgba(0,0,0,0.7), 0 0 18px #ffe800";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.6)";
              }}
            />
          ) : (
            <div
              style={{
                color: "rgba(255, 232, 0, 0.9)",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontSize: 12,
                textAlign: "center",
                padding: "0 10px",
              }}
            >
              {hasLastToken ? "Last NFT image unavailable" : "No wallet NFT yet"}
            </div>
          )}
          {showLastImageFallback && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 10,
                background: "rgba(6, 10, 20, 0.72)",
                color: "#9adfff",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                pointerEvents: "none",
              }}
            >
              IPFS image offline
            </div>
          )}
        </div>

        <div
          className="live-stats-info"
          style={{
            ...statsTable,
            width: infoBoxWidth,
            height: infoBoxHeight,
            minHeight: infoBoxMinHeight,
            maxWidth: mobileMaxWidth,
            alignSelf: isPhone ? "center" : undefined,
            marginTop: isPhone ? "0" : "8px",
            gap: isPhone ? 4 : 6,
            paddingBottom: isPhone ? "10px" : "14px",
            color: "#ffe800",
          }}
        >
          <div
            style={infoRowStyle}
          >
            LAST NFT:&nbsp;
            <span className="highlight" style={{ color: "#ff0000" }}>
              #{effectiveLastMinted.tokenId}
            </span>
          </div>
          <div style={infoRowStyle}>
            BLOCK:&nbsp;
            <span className="highlight">
              {String(effectiveLastMinted.blockName || "-").toUpperCase()}
            </span>
          </div>
          <div style={infoRowStyle}>
            BACKGROUND:&nbsp;
            <span className="highlight">
              {String(effectiveLastMinted.backgroundName || "-").toUpperCase()}
            </span>
          </div>
          <div
            style={{
              ...infoRowStyle,
              color: "#9ee5ff",
              marginTop: isPhone ? 1 : 2,
            }}
          >
            FINAL PRICE
          </div>
          <div style={metricValueRowStyle}>
            <span
              className="highlight"
              style={{
                color: "#5ddcff",
                fontSize: infoCardBigFontSize,
                fontWeight: 800,
              }}
            >
              {effectiveLastFinalPrice != null
                ? `${formatMaybe(effectiveLastFinalPrice, 2)} POL`
                : "-"}
            </span>
          </div>
          <div
            style={{
              ...infoRowStyle,
              color: "#9ee5ff",
              textTransform: "none",
              fontSize: isTiny ? "0.48em" : isPhone ? "0.58em" : "0.64em",
            }}
          >
            {hasCurrentBlockPrice
              ? `Base ${formatMaybe(effectiveDisplayedBlockPrice, 2)} POL`
              : "Base -"}
            {hasLastRedeemedBgBonusValue
              ? ` + BG bonus ${formatMaybe(effectiveDisplayedBgBonusValue, 2)} POL (${hasLastRedeemedBgBonusPct ? formatSigned(lastRedeemedBackgroundBonusPct, 0) : "--"}%)`
              : ""}
          </div>
        </div>
      </div>

      <div style={statsGroupStyle}>
        <div style={statsTable}>
          <div className="widget-title" style={metricLabelStyle}>
            TICKETS LEFT
          </div>
          <div style={{ ...metricValueRowStyle, fontSize: boxFontSize }}>
            <span className="highlight" style={{ color: "#ffe800" }}>
              {Math.max(0, (maxTickets || 0) - (ticketMinted || 0))}
            </span>{" "}
            / <span style={{ color: "#fff" }}>{maxTickets}</span>
          </div>
          <div
            className="widget-title"
            style={{ ...metricLabelStyle, marginTop: isPhone ? 6 : 8 }}
          >
            NFT MINTED
          </div>
          <div style={{ ...metricValueRowStyle, fontSize: boxFontSize }}>
            <span className="highlight" style={{ color: "#ffe800" }}>
              {biggiMinted}
            </span>{" "}
            / <span style={{ color: "#fff" }}>{maxSupply}</span>
          </div>
        </div>

        <div style={ticketPriceTable}>
          <div className="widget-title" style={metricLabelStyle}>
            TICKET PRICE
          </div>
          <div style={metricValueRowStyle}>
            <span
              className="highlight"
              style={{
                color: "#5ddcff",
                fontWeight: 900,
                fontSize: boxBigFontSize,
              }}
            >
              {typeof ticketPrice === "number"
                ? ticketPrice.toFixed(3)
                : ticketPrice || "-"}
            </span>
          </div>
        </div>
      </div>

      <div style={statsGroupStyle}>
        <div style={statsTable}>
          <div className="widget-title" style={tokenomicsLabelStyle}>
            BIGGI PRICE
          </div>
          <div style={{ ...metricValueRowStyle, fontSize: boxFontSize }}>
            <span
              className="highlight"
              style={{
                color: "#5ddcff",
                fontWeight: 900,
                fontSize: boxBigFontSize,
              }}
            >
              {typeof biggiPrice === "number"
                ? `${biggiPrice.toFixed(biggiPrice >= 1 ? 3 : 6)} ${priceQuoteSymbol}`
                : "-"}
            </span>
          </div>
          <div
            className="widget-title"
            style={{ ...tokenomicsLabelStyle, marginTop: isPhone ? 4 : 6 }}
          >
            24H CHANGE
          </div>
          <div
            style={{
              ...metricValueRowStyle,
              fontWeight: 900,
              color:
                biggiChange24h == null
                  ? "#aaa"
                  : biggiChange24h >= 0
                    ? "#47ff9a"
                    : "#ff6b6b",
              fontSize: boxFontSize,
            }}
          >
            {typeof biggiChange24h === "number"
              ? `${biggiChange24h.toFixed(2)} %`
              : "-"}
          </div>
        </div>

        <div
          style={{
            ...ticketPriceTable,
            gap: isPhone ? 2 : 4,
            padding: isPhone ? "8px 10px" : "12px 14px",
          }}
        >
          <div
            className="widget-title"
            style={{ ...tokenomicsLabelStyle, fontSize: marketCapBoxLabelFontSize }}
          >
            TRADEABLE SUPPLY
          </div>
          <div
            style={{
              ...metricValueRowStyle,
              fontSize: marketCapBoxValueFontSize,
              color: "#ffe800",
              fontWeight: 900,
            }}
          >
            {typeof tradableSupply === "number"
              ? tradableSupply.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : "-"}{" "}
            {tokenSymbol}
          </div>
          <div
            className="widget-title"
            style={{
              ...tokenomicsLabelStyle,
              fontSize: marketCapBoxLabelFontSize,
              marginTop: isPhone ? 2 : 4,
            }}
          >
            MARKET CAP
          </div>
          <div
            style={{
              ...metricValueRowStyle,
              color: "#5ddcff",
              fontWeight: 900,
              fontSize: marketCapBoxBigValueFontSize,
            }}
          >
            {typeof biggiMcap === "number"
              ? `${biggiMcap.toLocaleString(undefined, { maximumFractionDigits: 0 })} POL`
              : "-"}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="live-stats-widget-new" style={widgetStyle}>
      {topButtonsRow}

      {!showBlocks && !showBgStats && !showREWARDS && (
        <>
          {mainStats}

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
              marginTop: isPhone ? 8 : 12,
            }}
          >
            <button
              type="button"
              ref={weeklyBtnRef}
              onClick={handleToggleWeekly}
              aria-pressed={weeklyOpen}
              className={`live-menu-btn live-menu-btn--legacy live-menu-btn--cyan ${weeklyOpen ? "is-active" : ""}`}
              style={{
                ...actionBtnBase,
              }}
            >
              BIGGI WEEKLY
            </button>

            <button
              type="button"
              onClick={handlePoolsButtonClick}
              aria-pressed={poolsOpen}
              className={`live-menu-btn live-menu-btn--legacy live-menu-btn--gold ${poolsOpen ? "is-active" : ""}`}
              style={{
                ...actionBtnBase,
              }}
            >
              TOKENOMICS
            </button>

            <button
              type="button"
              onClick={handleChatButtonClick}
              aria-pressed={chatOpen}
              className={`live-menu-btn live-menu-btn--legacy live-menu-btn--pink ${chatOpen ? "is-active" : ""}`}
              style={{
                ...actionBtnBase,
              }}
            >
              LIVE CHAT
            </button>
          </div>

          {/* WEEKLY MODAL */}
          {weeklyOpen && (
            <ModalPortal lockScroll={false}>
              <div style={modalOverlayStyle}>
                <div style={{ ...fullscreenModalFrameStyle, padding: 0 }}>
                  <div
                    style={fullscreenModalCardStyle}
                    className={`wc-fullscreen-shell${desktopFullscreen ? " wc-fullscreen-shell--desktop" : ""}`}
                  >
                    <button
                      type="button"
                      className="wc-fullscreen-close"
                      onClick={closeWeeklyModal}
                      aria-label="Close weekly panel"
                    >
                      Close
                    </button>
                    <div
                      className={`wc-fullscreen-wrapper${desktopFullscreen ? " wc-fullscreen-wrapper--desktop" : ""}`}
                    >
                      <WeeklyCountdown
                        info={weeklyCountdownInfo}
                        isClaiming={weeklyIsClaiming}
                        claimSuccess={weeklyClaimSuccess}
                        onClaim={weeklyHandleClaim}
                        onRefresh={syncWeeklyInfo}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}
          {/* TOKENOMICS MODAL */}
          {poolsOpen && (
            <ModalPortal lockScroll={false}>
              <div style={modalOverlayStyle}>
                <div style={fullscreenModalFrameStyle}>
                  <div
                    style={{ ...fullscreenModalCardStyle, padding: 0 }}
                    className={desktopFullscreen ? "ls-fullscreen-tokenomics" : undefined}
                  >
                    <div style={modalHeaderStyle}>
                      <div style={{ color: "#ffe800", fontWeight: 900 }}>
                        TOKENOMICS
                      </div>
                      <button
                        onClick={closePoolsModal}
                        aria-label="Close pools"
                        title="Close"
                        style={{
                          background: "transparent",
                          border: "1px solid #ffe800",
                          color: "#ffe800",
                          borderRadius: 8,
                          padding: "2px 8px",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Close
                      </button>
                    </div>

                    <div
                      className={desktopFullscreen ? "ls-tokenomics-modal__content" : undefined}
                      style={{
                        ...tokenomicsModalBodyStyle,
                      }}
                    >
                      <div
                        className={desktopFullscreen ? "ls-tokenomics-modal__grid" : undefined}
                        style={{
                          ...tokenomicsModalGridStyle,
                        }}
                      >
                        <div className="pools-card collection-stats-card ls-tokenomics-modal__section ls-tokenomics-modal__section--overview">
                          <div className="pools-card__header">
                            <div className="collection-section-title">
                              TOKEN OVERVIEW
                            </div>
                          </div>
                          <div className="pools-card__body">
                            <div className="collection-stats-grid">
                            <div className="collection-stat-card">
                              <div className="collection-stat-label">Price</div>
                              <div className="collection-stat-value">
                                {typeof biggiPrice === "number"
                                  ? `${biggiPrice.toFixed(
                                      biggiPrice >= 1 ? 3 : 6,
                                    )} ${priceQuoteSymbol}`
                                  : "-"}
                              </div>
                            </div>
                            {!isPhone && (
                              <div className="collection-stat-card">
                                <div className="collection-stat-label">
                                  24H Change
                                </div>
                                <div
                                  className="collection-stat-value"
                                  style={{
                                    color:
                                      biggiChange24h == null
                                        ? "#ffffff"
                                        : biggiChange24h >= 0
                                          ? "#47ff9a"
                                          : "#ff6b6b",
                                  }}
                                >
                                  {typeof biggiChange24h === "number"
                                    ? `${biggiChange24h.toFixed(2)} %`
                                    : "-"}
                                </div>
                              </div>
                            )}
                            <div className="collection-stat-card">
                              <div className="collection-stat-label">
                                Tradeable supply
                              </div>
                              <div className="collection-stat-value">
                                {typeof tradableSupply === "number"
                                  ? `${tradableSupply.toLocaleString(
                                      undefined,
                                      { maximumFractionDigits: 2 },
                                    )} ${resolvedTokenMeta.symbol}`
                                  : "-"}
                              </div>
                            </div>
                            <div className="collection-stat-card">
                              <div className="collection-stat-label">
                                Market Cap
                              </div>
                              <div className="collection-stat-value">
                                {typeof biggiMcap === "number"
                                  ? `${biggiMcap.toLocaleString(undefined, {
                                      maximumFractionDigits: 0,
                                    })} ${priceQuoteSymbol}`
                                  : "-"}
                              </div>
                            </div>
                            {!isPhone && (
                              <div className="collection-stat-card">
                                <div className="collection-stat-label">
                                  Weekly Pool
                                </div>
                                <div className="collection-stat-value">
                                  {typeof computedREWARDSPool === "number"
                                    ? `${computedREWARDSPool.toLocaleString(
                                        undefined,
                                        { maximumFractionDigits: 4 },
                                      )} POL`
                                    : "-"}
                                </div>
                              </div>
                            )}
                            </div>
                          </div>
                        </div>
                      <div className="pools-card collection-stats-card ls-tokenomics-modal__section ls-tokenomics-modal__section--allocation">
                        <div className="pools-card__header">
                          <div className="collection-section-title">
                            POOLS & ALLOCATION
                          </div>
                        </div>
                        <div className="pools-card__body">
                          <div className="collection-stats-grid">
                            {(() => {
                              const entries = pools?.targets || [];
                              if (!entries.length) {
                                return (
                                  <div className="collection-stat-card">
                                    <div className="collection-stat-label">
                                      Loading
                                    </div>
                                    <div className="collection-stat-value">--</div>
                                  </div>
                                );
                              }
                              return entries.map((t) => {
                                const bal =
                                  t.key && pools?.balances?.[t.key] != null
                                    ? fmtPOL(pools.balances[t.key])
                                    : "-";
                                const allocation =
                                  t.key && pools?.allocations?.[t.key] != null
                                    ? fmtPOL(pools.allocations[t.key])
                                    : "-";
                                const prettyName =
                                  t.key === "REWARDS"
                                    ? "COLLECTION REWARDS"
                                    : t.key === "BUYBACK"
                                      ? "BUYBACK AGENT"
                                      : t.name || t.key || "POOL";
                                const balDisplay =
                                  bal === "-" ? "-" : `${bal} POL`;
                                const allocDisplay =
                                  allocation === "-"
                                    ? "-"
                                    : `${allocation} POL`;
                                return (
                                  <div
                                    key={t.key || t.addr || prettyName}
                                    className="collection-stat-card"
                                  >
                                    <div className="collection-stat-label">
                                      {prettyName}
                                    </div>
                                    <div className="collection-stat-value">
                                      {balDisplay}
                                    </div>
                                    <div
                                      className="ls-tokenomics-modal__meta"
                                      style={{
                                        color: "#9ee5ff",
                                        fontSize: desktopFullscreen ? "0.62rem" : "0.68rem",
                                        fontWeight: 700,
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      Alloc: {allocDisplay}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>

                      {!isPhone && (
                        <div className="pools-card collection-stats-card ls-tokenomics-modal__section ls-tokenomics-modal__section--contracts">
                          <div className="pools-card__header">
                            <div className="collection-section-title">
                              BIGGI IN CONTRACTS
                            </div>
                          </div>
                          <div className="pools-card__body">
                            <div className="collection-stats-grid">
                              {(() => {
                                if (!visibleTokenBalanceEntries.length) {
                                  return (
                                    <div className="collection-stat-card">
                                      <div className="collection-stat-label">
                                        Loading
                                      </div>
                                      <div className="collection-stat-value">--</div>
                                    </div>
                                  );
                                }
                                return visibleTokenBalanceEntries.map((t) => {
                                  const bal = fmtToken(
                                    t.balance,
                                    resolvedTokenMeta.decimals,
                                  );
                                  const balDisplay =
                                    bal === "-"
                                      ? "-"
                                      : `${bal} ${resolvedTokenMeta.symbol}`;
                                  return (
                                    <div
                                      key={t.key || t.addr || t.name}
                                      className="collection-stat-card"
                                    >
                                      <div className="collection-stat-label">
                                        {t.name || t.key || "Contract"}
                                      </div>
                                      <div className="collection-stat-value">
                                        {balDisplay}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="pools-card collection-stats-card ls-tokenomics-modal__section ls-tokenomics-modal__section--lp">
                        <div className="pools-card__header">
                          <div className="collection-section-title">
                            LP TOKENS
                          </div>
                        </div>
                        <div className="pools-card__body">
                          <div className="collection-stats-grid">
                            <div className="collection-stat-card">
                              <div className="collection-stat-label">
                                LP SYMBOL
                              </div>
                              <div className="collection-stat-value">
                                {pools?.lpStats?.symbol || "-"}
                              </div>
                            </div>
                            <div className="collection-stat-card">
                              <div className="collection-stat-label">
                                TOTAL SUPPLY
                              </div>
                              <div className="collection-stat-value">
                                {pools?.lpStats?.totalSupply != null
                                  ? `${fmtToken(
                                      pools.lpStats.totalSupply,
                                      pools.lpStats.decimals,
                                    )} ${pools.lpStats.symbol}`
                                  : "-"}
                              </div>
                            </div>
                            <div className="collection-stat-card">
                              <div className="collection-stat-label">
                                LP PRICE
                              </div>
                              <div className="collection-stat-value">
                                {typeof lpPrice === "number"
                                  ? `${lpPrice.toFixed(
                                      lpPrice >= 1 ? 3 : 6,
                                    )} POL`
                                  : "-"}
                              </div>
                            </div>
                            {!isPhone &&
                              visibleLpHolderEntries
                                .map((t) => {
                                  const bal =
                                    t.balance != null && pools?.lpStats
                                      ? fmtToken(
                                          t.balance,
                                          pools.lpStats.decimals,
                                        )
                                      : "-";
                                  const balDisplay =
                                    bal === "-" || !pools?.lpStats?.symbol
                                      ? "-"
                                      : `${bal} ${pools.lpStats.symbol}`;
                                  return (
                                    <div
                                      key={t.key || t.addr || t.name}
                                      className="collection-stat-card"
                                    >
                                      <div className="collection-stat-label">
                                        {t.name || t.key || "Holder"}
                                      </div>
                                      <div className="collection-stat-value">
                                        {balDisplay}
                                      </div>
                                    </div>
                                  );
                                })}
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}

          {/* LIVE CHAT MODAL */}
          {chatOpen && (
            <ModalPortal lockScroll={false}>
              <div style={modalOverlayStyle}>
                <div style={fullscreenModalFrameStyle}>
                  <div
                    style={fullscreenModalCardStyle}
                    className={desktopFullscreen ? "ls-fullscreen-chat" : undefined}
                  >
                    <div style={modalHeaderStyle}>
                      <div style={{ color: "#ffe800", fontWeight: 900 }}>
                        LIVE CHAT
                      </div>
                      <button
                        onClick={closeChatModal}
                        aria-label="Close live chat"
                        title="Close"
                        style={{
                          background: "transparent",
                          border: "1px solid #ffe800",
                          color: "#ffe800",
                          borderRadius: 8,
                          padding: "2px 8px",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Close
                      </button>
                    </div>
                    <div
                      className={desktopFullscreen ? "ls-fullscreen-chat__content" : undefined}
                      style={{
                        ...chatModalContentStyle,
                      }}
                    >
                      <React.Suspense fallback={null}>
                        <LiveChatPanel walletAddress={walletAddress} />
                      </React.Suspense>
                    </div>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}
        </>
      )}

      {showBlocks && (
        <React.Suspense fallback={null}>
          <BlocksWidget
            blockNames={safeBlockNames}
            blockMintCounts={effectiveBlockMintCounts}
            blockPrices={effectiveBlockPrices}
            backgroundMintCounts={effectiveBackgroundMintCounts}
            lastRedeemedTokenId={effectiveLastMinted.tokenId}
            lastRedeemedBlock={effectiveLastMinted.blockName}
            lastRedeemedBackground={effectiveLastMinted.backgroundName}
            onBack={resetAll}
          />
        </React.Suspense>
      )}

      {showBgStats && (
        <React.Suspense fallback={null}>
          <BackgroundsWidget
            blockNames={safeBlockNames}
            backgroundMintCounts={effectiveBackgroundMintCounts}
            blockPrices={effectiveBlockPrices}
            lastRedeemedTokenId={effectiveLastMinted.tokenId}
            lastRedeemedBlock={effectiveLastMinted.blockName}
            lastRedeemedBackground={effectiveLastMinted.backgroundName}
            onBack={resetAll}
          />
        </React.Suspense>
      )}

      {showREWARDS && (
        <>
        <div
          className="pools-card collection-stats-card"
          style={{
            width: "100%",
            margin: 0,
            borderColor: "rgba(255, 232, 0, 0.3)",
          }}
        >
          <div className="pools-card__header">
            <div className="collection-stats-header-title">
              <div style={{ color: "#ffe800", fontWeight: 900 }}>
                COLLECTION STATS
              </div>
              <button
                type="button"
                className="live-info-button"
                onClick={() => setShowCollectionInfo((v) => !v)}
                aria-label="Open collection stats information"
                aria-expanded={showCollectionInfo ? "true" : "false"}
                title="Info"
              >
                i
              </button>
            </div>
            <button
              onClick={resetAll}
              style={{
                background: "transparent",
                border: "1px solid #ffe800",
                color: "#ffe800",
                borderRadius: 10,
                padding: "6px 12px",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Back
            </button>
          </div>
          <div className="pools-card__body">
            <div className="collection-stats-grid">
              {[
                {
                  label: "Total minted",
                  value:
                    typeof biggiMinted === "number" && Number.isFinite(biggiMinted)
                      ? `${Math.round(biggiMinted)} / ${maxSupply}`
                      : "--",
                },
                {
                  label: "Tickets minted",
                  value:
                    typeof ticketMinted === "number" && Number.isFinite(ticketMinted)
                      ? `${Math.round(ticketMinted)} / ${maxTickets}`
                      : "--",
                },
                {
                  label: "Ticket price",
                  value:
                    typeof ticketPrice === "number" && Number.isFinite(ticketPrice)
                      ? `${formatMaybe(ticketPrice, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Reward pool",
                  value:
                    typeof computedREWARDSPool === "number" &&
                    Number.isFinite(computedREWARDSPool)
                      ? `${formatMaybe(computedREWARDSPool, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Mint volume",
                  value:
                    typeof mintVolumeMatic === "number" &&
                    Number.isFinite(mintVolumeMatic)
                      ? `${formatMaybe(mintVolumeMatic, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Avg block price",
                  value:
                    typeof blockPriceStats.avg === "number" &&
                    Number.isFinite(blockPriceStats.avg)
                      ? `${formatMaybe(blockPriceStats.avg, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Highest price",
                  value:
                    typeof blockPriceStats.max === "number" &&
                    Number.isFinite(blockPriceStats.max)
                      ? `${formatMaybe(blockPriceStats.max, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Lowest price",
                  value:
                    typeof blockPriceStats.min === "number" &&
                    Number.isFinite(blockPriceStats.min)
                      ? `${formatMaybe(blockPriceStats.min, 2)} ${priceQuoteSymbol}`
                      : "--",
                },
                {
                  label: "Blocks minted",
                  value: Number.isFinite(totalBlockMinted)
                    ? totalBlockMinted.toLocaleString()
                    : "--",
                },
                {
                  label: "BG minted",
                  value: Number.isFinite(totalBackgroundMinted)
                    ? totalBackgroundMinted.toLocaleString()
                    : "--",
                },
                {
                  label: "Owned NFTs",
                  value: Number.isFinite(ownedNftCount)
                    ? ownedNftCount.toLocaleString()
                    : "--",
                },
                {
                  label: "My weekly BIGGI",
                  value: walletAddress
                    ? unitsToTokenAmountStr(userTotalUnits)
                    : "Connect wallet",
                },
              ].map((stat) => (
                <div key={stat.label} className="collection-stat-card">
                  <span className="collection-stat-label">{stat.label}</span>
                  <span className="collection-stat-value">{stat.value}</span>
                </div>
              ))}
            </div>

            <div className="collection-section-title">Block prices</div>
            <div className="collection-table-wrap">
              <table className="pools-table collection-stats-table">
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Minted</th>
                    <th>Base</th>
                    <th>Live</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionBlockRows.map((row) => (
                    <tr key={row.name}>
                      <td
                        data-label="Block"
                        style={{ color: "#ffe800", fontWeight: 800 }}
                      >
                        {row.name}
                      </td>
                      <td data-label="Minted">{row.minted}</td>
                      <td data-label="Base">{formatMaybe(row.base, 2)}</td>
                      <td data-label="Live">
                        {row.live != null
                          ? formatMaybe(row.live, 2)
                          : formatMaybe(row.base, 2)}
                      </td>
                      <td data-label="Delta">{formatSigned(row.delta, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="collection-section-title">Background bonuses</div>
            <div className="collection-table-wrap">
              <table className="pools-table collection-stats-table">
                <colgroup>
                  <col style={{ width: "36%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "24%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Background</th>
                    <th>Minted</th>
                    <th>Bonus</th>
                    <th>Block Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionBackgroundRows.map((row, idx) => (
                    <tr key={`${row.name}-${idx}`}>
                      <td
                        data-label="Background"
                        style={{ color: "#ffe800", fontWeight: 800 }}
                      >
                        {row.name}
                      </td>
                      <td data-label="Minted">{row.minted}</td>
                      <td data-label="Bonus">{row.bonus}%</td>
                      <td data-label="Block Delta">
                        {formatSigned(row.delta, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {showCollectionInfo && (
          <div
            className="ls-info-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ls-collection-info-title"
            onClick={() => setShowCollectionInfo(false)}
          >
            <div
              className="ls-info-modal-content"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="ls-info-modal-header" id="ls-collection-info-title">
                Collection Stats Info
              </div>
              <div className="ls-info-modal-body">
                <table className="rw-info-table">
                  <thead>
                    <tr>
                      <th>Concept</th>
                      <th>Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COLLECTION_INFO_ROWS.map((row) => (
                      <tr key={row.concept} className={`info-row--${row.tone}`}>
                        <td className="rw-k">{row.concept}</td>
                        <td className="rw-v">{row.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ls-info-modal-footer">
                <button
                  type="button"
                  className="ls-info-modal-close-button"
                  onClick={() => setShowCollectionInfo(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}

export default LiveStats;
