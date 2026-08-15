import * as React from "react";
import "./App.css";

import { MODAL_TEXTS } from "./constants/texts";
import {
  DIST_BUYBACK_BPS,
  DIST_COLLECTION_BPS,
  DIST_RESERVE_BPS,
  DIST_TREASURY_BPS,
} from "./constants/bps";

import {
  formatEther,
  parseEther,
  Contract,
  BrowserProvider,
  ZeroAddress,
} from "ethers";

import { ADDR } from "@/addresses.js";
import { explorerBaseFor } from "@/config/chains.js";
import { DEFAULT_BLOCKS, BASE_PRICES } from "@/shared/blocks";
import { buildBlockImagePath } from "@/shared/utils/images";

/**
 * utils/contract.js (ethers v6 kompat wrappery)
 * - používáš své factories: getMain/getROProvider/getReaderRO atd.
 */
import {
  ensurePolygon,
  getReadOnlyMain as getReadOnlyContract,
  getMainRW,
  getLMRO as getReadOnlyLiquidityContract,
  getLM as getLiquidityContract,
  getFrontendSnapshotLiteActive,
  getReaderRO,
  getPOLICYRO,
  getBUYBACKRO,
  getLiquidityHelperReaderRO,
  getReserveTreasurySnapshotRO,
  getMCDReaderV2RO,
  getBiggiMainReaderRO,
  getBiggiREWARDSReaderRO,
  getBiggiTokenReaderRO,
  getBiggiTokenomicsReaderRO,
  getInjectedProvider,
  getProviderForContract,
  setInjectedProvider,
  getVRFRO,
  resetROProvider,
} from "@/shared/utils/contract";
import { clearPreferredRpc, ensurePreferredRpc } from "@/shared/utils/rpcConfig";
import {
  queryLogsBatched as queryLogsBatchedShared,
  getSafeDeployBlock as getSafeDeployBlockShared,
  isFullHistoryEnabled,
} from "@/shared/utils/shared";
import { setVRFAllOrPartial } from "@/shared/utils/adminActions";
import { getArchiveProvider, resetSharedFallbackProvider } from "@/web3/provider";
import { canPoll, getPollInterval, runWithLock } from "@/utils/polling";

import "./styles/biggi-token.skin.css";

import { BiggiToken as ABI_TOKEN } from "@/config/abi/index.js";

const DEFAULT_BLOCK_PRICES = DEFAULT_BLOCKS.map(
  (name) => BASE_PRICES[name] ?? 0,
);

import MainLayout from "../components/layout/MainLayout";
import FullscreenPanel from "./components/common/FullscreenPanel";
import Loader from "./components/common/Loader";

import {
  mergeAttrs,
  getCachedPriceAttrs,
  setCachedPriceAttrs,
} from "./utils/metadata";
import {
  readJsonFromURI as readJsonFromURIShared,
  resolveImageUrl as resolveImageUrlShared,
} from "@/shared/services/ipfs";
import {
  loadGalleryCache,
  saveGalleryCache,
} from "@/shared/services/gallery/gallery.cache.js";
import { mergeGalleryItem } from "@/shared/services/gallery/gallery.merge.js";

/* ========= LAZY LOADED HEAVY PANELS ========= */
const ProjectInfoModal = React.lazy(
  () => import("./ACTIONBUTTONS/INFO/ProjectInfoModal.jsx")
);
const EcosystemPanel = React.lazy(() => import("../features/tokenomics"));
const COLLECTIONBlocksGrid = React.lazy(
  () => import("./components/COLLECTIONBlocksGrid")
);
const REWARDSPanel = React.lazy(
  () => import("./panels/Rewards/REWARDSPanel.jsx")
);
const VRFPanel = React.lazy(() => import("./panels/VRF/VRFPanel.jsx"));
const InfoPanel = React.lazy(() => import("./panels/INFO/InfoPanel.jsx"));
const USERPANEL = React.lazy(
  () => import("./panels/UserPanel/USERPANEL.jsx")
);
const COMMUNITYCENTERPanel = React.lazy(
  () => import("../features/admin/COMMUNITYCENTERPanel.jsx")
);
const AdminPanel = React.lazy(() => import("./components/admin/AdminPanel.jsx"));
const ZoomModal = React.lazy(() => import("./components/gallery/ZoomModal.jsx"));

/* ======================================================================== */
/* ============================== CONSTANTS ================================ */
/* ======================================================================== */

const BACKGROUND_NAMES = [
  "ORANGE",
  "BLACK",
  "WHITE",
  "BROWN",
  "BLUE",
  "GREEN",
  "VIOLET",
  "RED",
  "PINK",
  "RAINBOW",
];
const BACKGROUND_CODES = ["O", "B", "W", "BR", "BL", "G", "V", "R", "P", "RB"];
const BACKGROUND_BONUSES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

const PLACEHOLDER_IMAGE = "/images/Biggi.png";
const TICKET_IMAGE_BASE =
  "https://biggieyes.mypinata.cloud/ipfs/bafybeigsbajmobtaivf7tvrj7l2mradsc2yaovr3ooy37wedukeexe3quq";
const TICKET_IMAGE_FILE = "Biggi_RANDOM_MINT_TICKET.png";

const BLOCK_IMAGE_BASES = {
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
  SPECIAL:
    "https://biggieyes.mypinata.cloud/ipfs/bafybeiapfll6xolsgvclyvy7cozyjxgrf4urbnkqjdcrxxnqn543e6qs7y/",
};

const trimSlash = (val) => String(val || "").replace(/\/+$/, "");
const blockBaseUrl = (blockName) => {
  const key = String(blockName || "").toUpperCase();
  const base = BLOCK_IMAGE_BASES[key];
  return base ? trimSlash(base) : null;
};

const ticketImageUrl = (baseOverride) => {
  const base = trimSlash(baseOverride || TICKET_IMAGE_BASE);
  if (!base) return PLACEHOLDER_IMAGE;
  return `${base}/${TICKET_IMAGE_FILE}`;
};

const normalizeIndex = (val, max) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n <= max) return n - 1;
  if (n >= 0 && n < max) return n;
  return null;
};

const blockNameFromIdx = (val) => {
  const idx = normalizeIndex(val, DEFAULT_BLOCKS.length);
  return idx == null ? null : DEFAULT_BLOCKS[idx];
};

const bgCodeFromIdx = (val) => {
  const idx = normalizeIndex(val, BACKGROUND_CODES.length);
  return idx == null ? null : BACKGROUND_CODES[idx];
};

const bgNameFromIdx = (val) => {
  const idx = normalizeIndex(val, BACKGROUND_NAMES.length);
  return idx == null ? null : BACKGROUND_NAMES[idx];
};

const bgNameFromCode = (val) => {
  if (!val) return null;
  const code = String(val).toUpperCase();
  const idx = BACKGROUND_CODES.indexOf(code);
  return idx === -1 ? null : BACKGROUND_NAMES[idx];
};

const parseTokenUriParts = (uri) => {
  if (!uri) return null;
  const m = String(uri).match(/Biggi_(\d+)_([A-Z]+)_([A-Z]+)\.json/i);
  if (!m) return null;
  return {
    mainId: m[1],
    blockName: m[2].toUpperCase(),
    bgCode: m[3].toUpperCase(),
  };
};

const buildBlockImageUrl = (blockName, fileName, baseOverride) => {
  const preferred = blockBaseUrl(blockName);
  const base = trimSlash(preferred || baseOverride);
  if (base && fileName) return `${base}/${String(fileName).replace(/^\/+/, "")}`;
  return buildBlockImagePath(fileName);
};

const parseNftInfo = (info) => {
  if (!info) return null;
  const background = info?.background ?? info?.[1];
  const blockIdx = info?.blockIdx ?? info?.[2];
  const mainId = info?.mainId ?? info?.[3];
  const blockName = blockNameFromIdx(blockIdx);
  const bgCode = bgCodeFromIdx(background);
  const bgName = bgNameFromIdx(background);
  const id =
    mainId != null && typeof mainId?.toString === "function"
      ? mainId.toString()
      : String(mainId ?? "");
  return {
    blockIdx,
    blockName,
    bgCode,
    bgName,
    mainId: id && id !== "0" ? id : null,
  };
};
const DEPLOY_BLOCK = Number(ADDR?.DEPLOY_BLOCK) || null;
const ZERO_ADDRESS = ZeroAddress;

const LOGS_BATCH = 2_000;
const FULL_HISTORY = isFullHistoryEnabled();

const WALLET_CACHE_TTL = 5 * 60 * 1000;
const WALLET_CACHE_VERSION = "v5-mainnet";

function activeCacheChainId() {
  return Number(ADDR?.CHAIN_ID || 137) || 137;
}

function activeCacheMainContract() {
  return String(ADDR?.COLLECTION_VRF || ADDR?.MAIN || "").toLowerCase();
}

function activeCacheScope() {
  const contract = activeCacheMainContract();
  return `${activeCacheChainId()}_${contract || "main"}`;
}

function walletCacheKey(addr) {
  return `biggi_wallet_${WALLET_CACHE_VERSION}_${activeCacheScope()}_${String(addr || "").toLowerCase()}`;
}
function loadWalletCache(addr) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(walletCacheKey(addr));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.ts && Date.now() - Number(parsed.ts) > WALLET_CACHE_TTL) return null;
    return Array.isArray(parsed.items) ? parsed.items : null;
  } catch {
    return null;
  }
}
function saveWalletCache(addr, items) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const payload = JSON.stringify({ ts: Date.now(), items });
    window.localStorage.setItem(walletCacheKey(addr), payload);
  } catch {
    // ignore
  }
}

function clearWalletCache(addr) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(walletCacheKey(addr));
  } catch {
    // ignore
  }
}

/* ======================================================================== */
/* ============================== SAFE HELPERS ============================= */
/* ======================================================================== */

function isZeroish(v) {
  try {
    if (v == null) return true;
    if (typeof v === "bigint") return v === 0n;
    if (typeof v === "number") return v === 0;
    if (typeof v === "string") return v === "0";
    if (typeof v?.toString === "function") return v.toString() === "0";
    return false;
  } catch {
    return false;
  }
}

function toNumEth(v) {
  try {
    if (v == null) return null;
    if (typeof v === "bigint") return Number(formatEther(v));
    if (typeof v === "number") return Number(v);
    if (typeof v === "string") return Number(v);
    if (typeof v?.toString === "function") {
      const s = v.toString();
      // pokud je to uint-like string bez decimals, zkusíme to jako wei bigint
      if (/^\d+$/.test(s)) return Number(formatEther(BigInt(s)));
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  } catch {
    return null;
  }
}

function safeLogArg(args, key, index) {
  if (!args) return undefined;
  if (key) {
    try {
      const v = args[key];
      if (v != null) return v;
    } catch {
      // ignore proxy access errors
    }
  }
  if (typeof index === "number") {
    try {
      if (typeof args.length === "number" && args.length <= index)
        return undefined;
    } catch {
      // ignore length access errors
    }
    try {
      return args[index];
    } catch {
      // ignore out-of-range access errors
    }
  }
  return undefined;
}

const getProviderFor = getProviderForContract;

async function getSafeDeployBlock(provider) {
  if (FULL_HISTORY) {
    if (typeof DEPLOY_BLOCK === "number" && DEPLOY_BLOCK > 0) {
      return DEPLOY_BLOCK;
    }
    return 0;
  }
  const base = await getSafeDeployBlockShared(provider);
  const latest = await provider.getBlockNumber();
  if (typeof base === "number" && Number.isFinite(base)) {
    // If DEPLOY_BLOCK is misconfigured higher than the chain tip, `base` may end up
    // > latest. In that case scan a reasonable recent window instead of `latest - 1`,
    // otherwise wallets appear to own nothing.
    if (base > latest) return Math.max(0, latest - 49_999);
    return Math.min(base, Math.max(0, latest - 1));
  }
  return Math.max(0, latest - 49_999);
}

async function queryLogsBatched(
  contract,
  filter,
  fromBlock,
  toBlock,
  step = LOGS_BATCH,
  options,
) {
  return queryLogsBatchedShared(contract, filter, fromBlock, toBlock, step, options);
}

async function mapLimit(items, limit, mapper) {
  const ret = [];
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const cur = i++;
      ret[cur] = await mapper(items[cur], cur);
    }
  });
  await Promise.all(workers);
  return ret;
}

/* ======================================================================== */
/* ============================== IPFS HELPERS ============================= */
/* ======================================================================== */

const TOKEN_URI_CACHE_LIMIT = 800;
const META_CACHE_LIMIT = 600;
const IMAGE_CACHE_LIMIT = 800;

const tokenUriCache = new Map();
const metaCache = new Map();
const imageCache = new Map();

function cacheSet(map, key, value, limit) {
  if (!key) return;
  if (!map.has(key) && map.size >= limit) {
    const firstKey = map.keys().next().value;
    if (firstKey != null) map.delete(firstKey);
  }
  map.set(key, value);
}

async function getTokenUriCached(contract, tokenId, options = {}) {
  const key = String(tokenId);
  const force = Boolean(options?.force);
  if (!force && tokenUriCache.has(key)) return tokenUriCache.get(key);
  const uri = await contract.tokenURI(tokenId);
  if (uri) cacheSet(tokenUriCache, key, uri, TOKEN_URI_CACHE_LIMIT);
  return uri;
}

function looksLikeTicketMeta(meta) {
  if (!meta) return false;
  const name = String(meta?.name || "").toLowerCase();
  const desc = String(meta?.description || "").toLowerCase();
  return (
    name.includes("ticket") ||
    desc.includes("ticket") ||
    desc.includes("redeem")
  );
}

function looksLikeNftMeta(meta) {
  if (!meta) return false;
  const attrs = Array.isArray(meta?.attributes) ? meta.attributes : [];
  return attrs.some((a) => {
    const t = String(a?.trait_type || "").toLowerCase();
    return t.includes("background") || t.includes("block") || t.includes("eye");
  });
}

function normalizeBaseUri(uri) {
  if (!uri) return null;
  const s = String(uri).trim();
  if (!s) return null;
  return s.endsWith("/") ? s : `${s}/`;
}

function isTicketUri(uri, base) {
  if (!uri || !base) return false;
  return String(uri).startsWith(base);
}

function clearTokenCaches(tokenId) {
  try {
    const key = String(tokenId);
    const cachedUri = tokenUriCache.get(key);
    tokenUriCache.delete(key);
    if (cachedUri) {
      metaCache.delete(cachedUri);
      const imagePrefix = `${cachedUri}|`;
      for (const k of imageCache.keys()) {
        if (typeof k === "string" && k.startsWith(imagePrefix)) {
          imageCache.delete(k);
        }
      }
    }
  } catch {
    // ignore cache delete errors
  }
}

async function readJsonFromURICached(uri, options = {}) {
  if (!uri) return null;
  const force = Boolean(options?.force);
  if (!force && metaCache.has(uri)) return metaCache.get(uri);
  const json = await readJsonFromURIShared(uri);
  if (json) cacheSet(metaCache, uri, json, META_CACHE_LIMIT);
  return json;
}

async function resolveImageUrlCached(imageField, metadataUri) {
  const key = `${metadataUri || ""}|${imageField || ""}`;
  if (imageCache.has(key)) {
    try {
      return await Promise.resolve(imageCache.get(key));
    } catch {
      imageCache.delete(key);
    }
  }
  const url = await resolveImageUrlShared(imageField, metadataUri);
  if (url) {
    cacheSet(imageCache, key, url, IMAGE_CACHE_LIMIT);
  }
  return url;
}

/* ======================================================================== */
/* ============================ DEVICE DETECTION ============================ */
/* ======================================================================== */

function useIsMobile(breakpoint = 700) {
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= breakpoint;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mql.matches);

    try {
      mql.addEventListener("change", onChange);
    } catch {
      mql.addListener(onChange);
    }

    onChange();
    return () => {
      try {
        mql.removeEventListener("change", onChange);
      } catch {
        mql.removeListener(onChange);
      }
    };
  }, [breakpoint]);

  return isMobile;
}

/* ======================================================================== */
/* ============================== UI NAV ICONS ============================== */
/* ======================================================================== */

const ICONS = [
  { src: "/images/icons/rewards.png", alt: "REWARDS", modalText: MODAL_TEXTS.REWARDS || "" },
  { src: "/images/icons/collection.png", alt: "COLLECTION", modalText: MODAL_TEXTS.COLLECTION || "" },
  { src: "/images/icons/mint.png", alt: "VRF MINT", modalText: MODAL_TEXTS.mint || "" },
  { src: "/images/icons/token.png", alt: "BIGGI ECOSYSTEM", modalText: MODAL_TEXTS.chance || "" },
  { src: "/images/icons/users.png", alt: "USERS", modalText: "" },
  { src: "/images/icons/expansion.png", alt: "COMMUNITY CENTER", modalText: MODAL_TEXTS.COMMUNITYCENTER || MODAL_TEXTS.expansion || "" },
];

/* ======================================================================== */
/* ============================ WALLET HELPERS ============================= */
/* ======================================================================== */

const pickInjectedProvider = () => {
  if (typeof window === "undefined") return null;
  const { ethereum } = window;
  if (!ethereum) return null;

  if (Array.isArray(ethereum.providers) && ethereum.providers.length) {
    const mm = ethereum.providers.find((prov) => prov && prov.isMetaMask);
    return mm || ethereum.providers[0];
  }
  return ethereum;
};

const connectWithWalletConnect = async () => {
  try {
    const mod = await import("./wallet/wc.js");
    if (mod && typeof mod.connectWithWalletConnect === "function") {
      return await mod.connectWithWalletConnect();
    }
  } catch (err) {
    console.error("WalletConnect load failed:", err);
    throw err;
  }
  throw new Error("WalletConnect is not available in this version");
};

/* ======================================================================== */
/* ============================ READER CACHE CONTAINER ====================== */
/* ======================================================================== */

const readersRef = { current: {} };

function getCachedReaderInstance(kind = "main") {
  try {
    if (kind === "main" && typeof getBiggiMainReaderRO === "function") {
      if (!readersRef.current.BiggiMainReader) {
        readersRef.current.BiggiMainReader = getBiggiMainReaderRO();
      }
      return readersRef.current.BiggiMainReader;
    }
    if (kind === "REWARDS" && typeof getBiggiREWARDSReaderRO === "function") {
      if (!readersRef.current.BiggiREWARDSReader) {
        readersRef.current.BiggiREWARDSReader = getBiggiREWARDSReaderRO();
      }
      return readersRef.current.BiggiREWARDSReader;
    }
    if (kind === "token" && typeof getBiggiTokenReaderRO === "function") {
      if (!readersRef.current.BiggiTokenReader) {
        readersRef.current.BiggiTokenReader = getBiggiTokenReaderRO();
      }
      return readersRef.current.BiggiTokenReader;
    }
    if (kind === "tokenomics" && typeof getBiggiTokenomicsReaderRO === "function") {
      if (!readersRef.current.BiggiTokenomicsReader) {
        readersRef.current.BiggiTokenomicsReader = getBiggiTokenomicsReaderRO();
      }
      return readersRef.current.BiggiTokenomicsReader;
    }
  } catch {
    // ignore
  }

  if (!readersRef.current.GenericReader) {
    readersRef.current.GenericReader = getReaderRO();
  }
  return readersRef.current.GenericReader;
}

/* ======================================================================== */
/* ============================ SMALL UTILS ================================= */
/* ======================================================================== */

function canonBackgroundName(val) {
  if (!val) return null;
  const u = String(val).trim().toUpperCase();
  const codeIdx = BACKGROUND_CODES.indexOf(u);
  if (codeIdx !== -1) return BACKGROUND_NAMES[codeIdx];
  const nameIdx = BACKGROUND_NAMES.indexOf(u);
  if (nameIdx !== -1) return BACKGROUND_NAMES[nameIdx];
  return null;
}

async function resolveContractAddress(contract) {
  if (!contract) return null;
  try {
    if (typeof contract.getAddress === "function") {
      const addr = await contract.getAddress();
      if (addr) return addr;
    }
  } catch {
    // ignore getAddress failures
  }
  return contract?.target || contract?.address || null;
}

async function assertContractDeployed(contract, provider, label = "Contract") {
  const addr = await resolveContractAddress(contract);
  if (!addr) {
    throw new Error(`${label} address is missing.`);
  }
  if (!provider || typeof provider.getCode !== "function") {
    throw new Error(`${label} provider not available.`);
  }
  const code = await provider.getCode(addr);
  if (!code || code === "0x" || code === "0x0") {
    throw new Error(
      `${label} not found on current network (address ${addr}). Switch to Polygon mainnet (chainId 137) or update addresses.`,
    );
  }
  return addr;
}

function isMissingRevertDataError(err) {
  const msg = String(err?.message || "");
  return (
    err?.code === "CALL_EXCEPTION" &&
    (err?.data == null || /missing revert data/i.test(msg) || /internal json-rpc error/i.test(msg))
  );
}

function isUserRejectedAction(err) {
  const code = err?.code ?? err?.error?.code ?? err?.info?.error?.code;
  if (code === "ACTION_REJECTED") return true;
  if (String(code) === "4001") return true;
  if (
    err?.action === "sendTransaction" &&
    String(err?.reason || "").toLowerCase() === "rejected"
  ) {
    return true;
  }
  const rejectCause =
    err?.data?.cause ??
    err?.error?.data?.cause ??
    err?.info?.error?.data?.cause ??
    null;
  if (String(rejectCause || "").toLowerCase() === "rejectallapprovals") {
    return true;
  }
  const rejectLocation =
    err?.data?.location ??
    err?.error?.data?.location ??
    err?.info?.error?.data?.location ??
    null;
  if (String(rejectLocation || "").toLowerCase() === "confirmation") {
    return true;
  }

  const text = String(
    err?.reason ||
      err?.shortMessage ||
      err?.message ||
      err?.error?.message ||
      err?.info?.error?.message ||
      "",
  ).toLowerCase();

  return (
    text.includes("user denied") ||
    text.includes("user rejected") ||
    text.includes("ethers-user-denied") ||
    text.includes("rejected")
  );
}

const INVALID_CONSUMER_SELECTOR = "0x79bfd401";

function extractRevertData(err) {
  const candidates = [
    err?.data,
    err?.error?.data,
    err?.error?.data?.data,
    err?.info?.error?.data,
  ];
  for (const cand of candidates) {
    if (typeof cand === "string" && cand.startsWith("0x")) return cand;
  }
  return null;
}

function decodeInvalidConsumer(err) {
  const data = extractRevertData(err);
  if (!data || !data.startsWith(INVALID_CONSUMER_SELECTOR)) return null;
  const body = data.slice(10);
  if (body.length < 128) return null;
  const subHex = body.slice(0, 64);
  const consumerHex = body.slice(64, 128);
  let subId = "";
  try {
    subId = BigInt(`0x${subHex}`).toString();
  } catch {
    subId = "";
  }
  const consumer = `0x${consumerHex.slice(24)}`;
  return { subId, consumer };
}

const KNOWN_CUSTOM_ERROR_MESSAGES = {
  "0xd69b5766": "No eligible NFTs to claim this week.",
};

function decodeKnownCustomError(err) {
  const data = extractRevertData(err);
  if (!data || typeof data !== "string" || !data.startsWith("0x")) return null;
  const selector = data.slice(0, 10).toLowerCase();
  return KNOWN_CUSTOM_ERROR_MESSAGES[selector] || null;
}

/* ======================================================================== */
/* =============================== APP CORE =============================== */
/* ======================================================================== */

export default function AppCore() {
  const isMobile = useIsMobile(700);

  const [openNavIdx, setOpenNavIdx] = React.useState(null);
  const [walletAddress, setWalletAddress] = React.useState("");

  const [ticketPrice, setTicketPrice] = React.useState(null);
  const [biggiMinted, setBiggiMinted] = React.useState(0);
  const [maxSupply] = React.useState(550);

  const [ticketMinted, setTicketMinted] = React.useState(0);
  const [maxTickets] = React.useState(550);

  const [blockMintCounts, setBlockMintCounts] = React.useState(new Array(10).fill(0));
  const [blockPrices, setBlockPrices] = React.useState(DEFAULT_BLOCK_PRICES);
  const [backgroundMintCounts, setBackgroundMintCounts] = React.useState(new Array(10).fill(0));

  const [myNFTs, setMyNFTs] = React.useState([]);
  const [galleryLoading, setGalleryLoading] = React.useState(false);
  const [galleryNotice, setGalleryNotice] = React.useState("");
  const [cardsHelpOpen, setCardsHelpOpen] = React.useState(false);
  const [zoomImg, setZoomImg] = React.useState(null);

  const [lastMinted, setLastMinted] = React.useState({
    tokenId: "-",
    image: "/images/Biggi.png",
    blockName: "-",
    backgroundName: "-",
  });

  const [dynamicTraitsById, setDynamicTraitsById] = React.useState({});
  const [rewardPool, setRewardPool] = React.useState(null);
  const [myClaimable, setMyClaimable] = React.useState(null);
  const [mintVolumeMatic, setMintVolumeMatic] = React.useState(null);

  const [biggiData, setBiggiData] = React.useState({
    token: {},
    REWARDS: {},
    router: {},
    liquidity: {},
    POLICY: {},
    BUYBACK: {},
  });

  const [VRFUIData, setVRFUIData] = React.useState({
    network: "EVM",
    params: { keyHash: "", confirmations: 3, numWords: 1, callbackGasLimit: 300000 },
    subscription: { id: "" },
    last: { requestId: "", status: "idle", requestedAt: "", txHash: "", blockNumber: undefined, randomWords: [] },
    history: [],
  });

  const [VRFPending, setVRFPending] = React.useState(false);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [redeemMsg, setRedeemMsg] = React.useState("");
  const [redeemStartBlock, setRedeemStartBlock] = React.useState(null);
  const [redeemStartedAt, setRedeemStartedAt] = React.useState(null);
  const [pendingTicketId, setPendingTicketId] = React.useState(null);
  const [topFirstId, setTopFirstId] = React.useState(null);

  const [adminOpen, setAdminOpen] = React.useState(false);
  const [adminOwner, setAdminOwner] = React.useState("");

  const statsTimer = React.useRef(null);
  const REWARDSTimer = React.useRef(null);
  const statsPollRef = React.useRef(false);

  const contractRef = React.useRef(null);
  const unsubRef = React.useRef(() => {});
  const mintIdxCacheRef = React.useRef(new Map());
  const walletFetchRef = React.useRef({ inFlight: null, addr: null });
  const claimableFetchRef = React.useRef(0);
  const lastVRFFulfilledRef = React.useRef("");

  const hideExtras = false;
  const epochStartTs = null;
  const userLastClaimTs = null;
  const fetchChainNowTs = null;

  const navOpen = openNavIdx !== null;
  const navAlt = navOpen ? ICONS[openNavIdx]?.alt : "";

  const isAdmin =
    adminOwner &&
    walletAddress &&
    adminOwner.toLowerCase() === walletAddress.toLowerCase();

  /* ====================================================================== */
  /* ============================ CORE HELPERS ============================= */
  /* ====================================================================== */

  const callFirst = React.useCallback(async (contract, candidates, args = []) => {
    for (const fn of candidates) {
      const callable = contract?.[fn];
      if (typeof callable === "function") {
        try {
          return await callable(...args);
        } catch {}
      }
    }
    return null;
  }, []);

  const recoverRpcConnectivity = React.useCallback(async (context = "rpc") => {
    clearPreferredRpc();
    try {
      await ensurePreferredRpc();
    } catch (err) {
      console.warn(`${context}: ensurePreferredRpc failed`, err?.message || err);
    }
    try {
      resetROProvider();
    } catch {
      // ignore provider reset failures
    }
    try {
      resetSharedFallbackProvider();
    } catch {
      // ignore provider reset failures
    }
  }, []);

  const prettyError = React.useCallback((err) => {
    if (isUserRejectedAction(err)) {
      return "Transaction was cancelled in MetaMask.";
    }

    const knownCustom = decodeKnownCustomError(err);
    if (knownCustom) return knownCustom;

    const name = err?.errorName || "";
    const reason =
      err?.reason || err?.data?.message || err?.message || "Unknown error";

    if (
      err?.code === "CALL_EXCEPTION" &&
      err?.data == null &&
      /missing revert data/i.test(String(err?.message || ""))
    ) {
      return "Transaction reverted without data. Most likely wrong network or contract address.";
    }

    const invalidConsumer = decodeInvalidConsumer(err);
    if (invalidConsumer) {
      const sub = invalidConsumer.subId || "unknown";
      const consumer = invalidConsumer.consumer || "unknown";
      return `VRF subscription invalid: VRF Router ${consumer} is not a consumer of subscription ${sub}. Add it in Chainlink VRF or update the subId in Admin → VRF.`;
    }

    const map = {
      InsufficientPayment: "Sent value is lower than the ticket price.",
      MaxPerWallet: "Per-wallet limit (10 tickets) exceeded.",
      AllTicketsMinted: "All tickets are sold out.",
      SoldOut: "All tickets are sold out.",
      AllNFTsMintedErr: "All NFTs are already minted.",
      NoTicketToRedeem: "You don't have any ticket to redeem.",
      NotTicket: "Selected token is not a ticket.",
      NotTicketOwner: "You are not the owner of this ticket.",
      AlreadyPending: "You already have a pending VRF draw.",
      PresaleNotActive: "Presale is turned off.",
      Paused: "Contract is paused.",
      NoEligibleTokens: "No eligible NFTs to claim this week.",
      CapExceeded: "Token cap would be exceeded.",
      NotFullyConfigured: "Contract metadata is not fully configured (owner must finish batch setup).",
      BiggiTokenNotSet: "BIGGI token is not configured yet.",
      NoMinter: "Minter not configured.",
      NoToken: "Token not configured.",
    };
    return map[name] || reason;
  }, []);

  const scheduleFetchStats = React.useCallback((delay = 500, fn) => {
    if (statsTimer.current) return;
    statsTimer.current = setTimeout(async () => {
      statsTimer.current = null;
      try {
        await fn();
      } catch {}
    }, delay);
  }, []);

  const scheduleFetchREWARDS = React.useCallback((delay = 500, fn) => {
    if (REWARDSTimer.current) return;
    REWARDSTimer.current = setTimeout(async () => {
      REWARDSTimer.current = null;
      try {
        await fn();
      } catch {}
    }, delay);
  }, []);

  /* ====================================================================== */
  /* ============================ ADMIN OWNER ============================== */
  /* ====================================================================== */

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const c = contractRef.current || getReadOnlyContract();
        if (c && typeof c.owner === "function") {
          const addr = await c.owner().catch(() => "");
          if (!cancelled) setAdminOwner(addr || "");
        } else if (!cancelled) {
          setAdminOwner("");
        }
      } catch {
        if (!cancelled) setAdminOwner("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!isAdmin && adminOpen) setAdminOpen(false);
  }, [isAdmin, adminOpen]);

  const openAdmin = React.useCallback(() => {
    if (!isAdmin) return;
    setAdminOpen(true);
  }, [isAdmin]);

  /* ====================================================================== */
  /* ============================ STATS FETCH ============================== */
  /* ====================================================================== */

  const readMainBlockStats = React.useCallback(async (main) => {
    if (!main) return null;

    const silent = async (fn) => {
      try {
        return await fn();
      } catch {
        return null;
      }
    };

    const blockMintCountReader =
      typeof main.getBlockMintCount === "function"
        ? (i) => main.getBlockMintCount(i)
        : typeof main.blockMintCounts === "function"
          ? (i) => main.blockMintCounts(i)
          : null;

    const indexProbes = [];
    if (typeof main.getCurrentBlockPrice === "function") {
      indexProbes.push((i) => main.getCurrentBlockPrice(i));
    }
    if (typeof main.blockInfos === "function") {
      indexProbes.push((i) => main.blockInfos(i));
    }
    if (blockMintCountReader) {
      indexProbes.push((i) => blockMintCountReader(i));
    }

    let blockIndexBase = 1;
    for (const probe of indexProbes) {
      const probe0 = await silent(() => probe(0));
      if (probe0 != null) {
        blockIndexBase = 0;
        break;
      }
    }

    const blockRows = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const blockId = i + blockIndexBase;
        const info =
          typeof main.blockInfos === "function"
            ? await silent(() => main.blockInfos(blockId))
            : null;

        const priceWei =
          info?.currentPrice ??
          info?.[2] ??
          (typeof main.getCurrentBlockPrice === "function"
            ? await silent(() => main.getCurrentBlockPrice(blockId))
            : null);

        let mintedRaw = null;
        if (blockMintCountReader) {
          mintedRaw = await silent(() => blockMintCountReader(blockId));
        }
        if (mintedRaw == null) {
          mintedRaw = info?.mintCount ?? info?.[3] ?? null;
        }

        return {
          price: toNumEth(priceWei) ?? 0,
          minted: Number(mintedRaw ?? 0),
        };
      }),
    );

    const prices = blockRows.map((row) =>
      Number.isFinite(row.price) ? row.price : 0,
    );
    const blkCounts = blockRows.map((row) =>
      Number.isFinite(row.minted) ? row.minted : 0,
    );

    const bgReader =
      typeof main.backgroundMintCounts === "function"
        ? (i) => main.backgroundMintCounts(i)
        : typeof main.getBackgroundMintCount === "function"
          ? (i) => main.getBackgroundMintCount(i)
          : null;

    let bgCounts = new Array(10).fill(0);
    if (bgReader) {
      let bgIndexBase = 0;
      const bgProbe0 = await silent(() => bgReader(0));
      if (bgProbe0 == null) {
        const bgProbe1 = await silent(() => bgReader(1));
        if (bgProbe1 != null) bgIndexBase = 1;
      }

      const rawBgCounts = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          silent(() => bgReader(i + bgIndexBase)),
        ),
      );
      bgCounts = rawBgCounts.map((v) => Number(v ?? 0));
    }

    return { prices, blkCounts, bgCounts };
  }, []);

  const fetchStats = React.useCallback(async () => {
    let snapshotUsed = false;

    // 1) Prefer reader snapshot for scalar stats
    try {
      const readerKinds = ["main", "tokenomics", "REWARDS", "generic"];
      let snap = null;

      for (const k of readerKinds) {
        try {
          const r = getCachedReaderInstance(k);
          if (!r) continue;
          snap = await getFrontendSnapshotLiteActive(r);
          if (snap) break;
        } catch {}
      }

      if (snap) {
        const [
          ticketPriceWei,
          ticketMinted_,
          biggiMinted_,
          currentBlockPrices,
          blocksMinted,
          bgsMinted,
        ] = snap;

        setTicketPrice(toNumEth(ticketPriceWei));
        setTicketMinted(Number(ticketMinted_ ?? 0));
        setBiggiMinted(Number(biggiMinted_ ?? 0));

        setBlockPrices((currentBlockPrices || []).map((x) => toNumEth(x) ?? 0));
        setBlockMintCounts((blocksMinted || []).map((x) => Number(x ?? 0)));
        setBackgroundMintCounts((bgsMinted || []).map((x) => Number(x ?? 0)));
        snapshotUsed = true;
      }
    } catch (e) {
      console.warn("fetchStats(reader) failed", e);
    }

    // 2) Always refresh block/bG arrays from MAIN with index-base detection.
    // This prevents stale/misaligned reader arrays from freezing dynamic prices.
    try {
      const main = contractRef.current || getReadOnlyContract();

      if (!snapshotUsed) {
        const priceCandidates = [
          "getTicketPrice",
          "ticketPrice",
          "getTicketPriceWei",
          "ticketPriceWei",
        ];
        let priceWei = null;
        for (const fn of priceCandidates) {
          const f = main?.[fn];
          if (typeof f !== "function") continue;
          try {
            const v = await f();
            if (v != null) {
              priceWei = v;
              break;
            }
          } catch {}
        }
        if (priceWei != null) setTicketPrice(toNumEth(priceWei));

        try {
          const tm = await main.ticketMinted?.();
          setTicketMinted(Number(tm ?? 0));
        } catch {}
        try {
          const bm = await main.biggiMinted?.();
          setBiggiMinted(Number(bm ?? 0));
        } catch {}
      }

      const direct = await readMainBlockStats(main);
      if (direct) {
        setBlockPrices(direct.prices);
        setBlockMintCounts(direct.blkCounts);
        setBackgroundMintCounts(direct.bgCounts);
      }
    } catch (e) {
      if (!snapshotUsed) {
        console.error("fetchStats(fallback main) failed", e);
      } else {
        console.debug("fetchStats(main overlay) failed", e);
      }
    }
  }, [readMainBlockStats]);

  React.useEffect(() => {
    let mounted = true;
    const poll = async () => {
      if (!mounted || !canPoll()) return;
      await runWithLock(statsPollRef, async () => {
        await fetchStats();
      });
    };

    poll();
    const interval = setInterval(
      poll,
      getPollInterval(25_000, "VITE_STATS_POLL_MS"),
    );
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchStats]);

  /* ====================================================================== */
  /* ============================ REWARDS FETCH ============================= */
  /* ====================================================================== */

  const fetchREWARDS = React.useCallback(async () => {
    try {
      const main = contractRef.current || getReadOnlyContract();

      // mint volume
      const volumeCandidates = [
        "totalMintVolume",
        "mintVolume",
        "getMintVolume",
        "totalRevenue",
        "totalRevenueMatic",
        "accMintValue",
        "mintedValue",
      ];
      const volWei = await callFirst(main, volumeCandidates);
      if (volWei != null) setMintVolumeMatic(toNumEth(volWei));
      else setMintVolumeMatic(null);

      // weekly pool from LM/REWARDS contract
      let weeklyWei = null;
      try {
        const brl = await getReadOnlyLiquidityContract();
        const weeklyPoolFns = [
          "weeklyPool",
          "currentWeekPool",
          "getWeeklyPool",
          "weekPool",
          "poolForCurrentWeek",
          "rewardPool",
          "currentRewardPool",
        ];
        weeklyWei = await callFirst(brl, weeklyPoolFns);
      } catch {}

      if (weeklyWei != null && !isZeroish(weeklyWei)) {
        setRewardPool(toNumEth(weeklyWei) ?? 0);
      } else if (volWei != null) {
        setRewardPool((toNumEth(volWei) ?? 0) * 0.22);
      } else {
        setRewardPool(0);
      }

    } catch (e) {
      console.error("fetchREWARDS", e);
    }
  }, [callFirst]);

  const refreshClaimable = React.useCallback(
    async (addrOverride, assetsOverride) => {
      const reqId = ++claimableFetchRef.current;
      const addr = addrOverride ?? walletAddress;

      if (!addr) {
        if (claimableFetchRef.current === reqId) setMyClaimable(0);
        return 0;
      }

      const toBigIntTokenId = (raw) => {
        try {
          if (raw == null) return null;
          if (typeof raw === "bigint") return raw;
          if (typeof raw === "number") {
            if (!Number.isFinite(raw) || raw <= 0) return null;
            return BigInt(Math.trunc(raw));
          }
          if (typeof raw === "string") {
            const s = raw.trim();
            if (!s) return null;
            if (/^\d+$/.test(s)) return BigInt(s);
            if (/^0x[0-9a-f]+$/i.test(s)) return BigInt(s);
            return null;
          }
          if (typeof raw?.toString === "function") {
            return toBigIntTokenId(raw.toString());
          }
        } catch {
          return null;
        }
        return null;
      };

      const maxReasonableTokenId = BigInt(
        Math.max((Number(maxSupply) || 550) * 1000, 1_000_000),
      );
      const sourceItems = Array.isArray(assetsOverride) ? assetsOverride : myNFTs;
      const tokenIds = [];
      const seen = new Set();
      for (const item of sourceItems) {
        if (!item || item.isTicket || item.isPending) continue;
        const id = toBigIntTokenId(item.tokenId);
        if (id == null || id <= 0n || id > maxReasonableTokenId) continue;
        const key = id.toString();
        if (seen.has(key)) continue;
        seen.add(key);
        tokenIds.push(id);
      }

      if (!tokenIds.length) {
        if (claimableFetchRef.current === reqId) setMyClaimable(0);
        return 0;
      }

      let next = 0;
      try {
        const brl = await getReadOnlyLiquidityContract();
        let amount = null;

        if (typeof brl?.claimablePreview === "function") {
          try {
            const preview = await brl.claimablePreview(tokenIds);
            amount = Array.isArray(preview)
              ? (preview[1] ?? preview[0] ?? null)
              : (preview?.amount ?? preview?.claimable ?? null);
          } catch {
            amount = null;
          }
        }

        if (amount == null && typeof brl?.claimStatus === "function") {
          try {
            const status = await brl.claimStatus(tokenIds);
            amount = Array.isArray(status)
              ? (status[0] ?? null)
              : (status?.claimable ?? null);
          } catch {
            amount = null;
          }
        }

        next = toNumEth(amount) ?? 0;
      } catch {
        next = 0;
      }

      if (claimableFetchRef.current === reqId) setMyClaimable(next);
      return next;
    },
    [walletAddress, myNFTs, maxSupply],
  );

  React.useEffect(() => {
    refreshClaimable(walletAddress, myNFTs);
  }, [walletAddress, myNFTs, refreshClaimable]);

  /* ====================================================================== */
  /* ===================== Ticket price resolver (Reader fallback) ========= */
  /* ====================================================================== */

  const resolveTicketPriceWei = React.useCallback(async () => {
    const c = contractRef.current || getReadOnlyContract();
    const candidates = ["getTicketPrice", "ticketPrice", "getTicketPriceWei", "ticketPriceWei"];

    for (const n of candidates) {
      const f = c?.[n];
      if (typeof f === "function") {
        try {
          const v = await f();
          if (v != null) return v;
        } catch {}
      }
    }

    // readers fallback
    const readerKinds = ["main", "tokenomics", "REWARDS", "generic"];
    for (const k of readerKinds) {
      const r = getCachedReaderInstance(k);
      if (!r) continue;
      try {
        const snap = await getFrontendSnapshotLiteActive(r);
        const wei = Array.isArray(snap) ? snap[0] : snap?.ticketPriceWei;
        if (wei != null) return wei;

        if (typeof r.getTicketPrice === "function") {
          const v = await r.getTicketPrice();
          if (v != null) return v;
        }
      } catch {}
    }

    throw new Error("Ticket price unavailable");
  }, []);

  /* ====================================================================== */
  /* ======================= Metadata enrich (mint prices) ================== */
  /* ====================================================================== */

  const enrichMetaWithPrices = React.useCallback(async (_contract, tokenId, meta) => {
    try {
      const cached = getCachedPriceAttrs(tokenId);
      let attrs = Array.isArray(meta?.attributes) ? [...meta.attributes] : [];
      if (cached) attrs = mergeAttrs(attrs, cached);

      try {
        const tokenomicsReader =
          getCachedReaderInstance("tokenomics") ||
          getCachedReaderInstance("main") ||
          getCachedReaderInstance("generic");

        if (tokenomicsReader?.getMintDataByTokenId) {
          const [tp, bp, fp] = await tokenomicsReader.getMintDataByTokenId(
            BigInt(String(tokenId))
          );

          const ticket = toNumEth(tp);
          const blockP = toNumEth(bp);
          const finalP = toNumEth(fp);

          const pushOrReplace = (trait_type, value) => {
            const i = attrs.findIndex((a) => String(a?.trait_type) === trait_type);
            const v = value != null ? `${value.toFixed(4)} POL` : "—";
            if (i === -1) attrs.push({ trait_type, value: v });
            else attrs[i] = { ...attrs[i], value: v };
          };

          pushOrReplace("Ticket Price", ticket);
          pushOrReplace("Block Price", blockP);
          pushOrReplace("Final Price", finalP);

          setCachedPriceAttrs(tokenId, attrs);
        }
      } catch {}

      return { ...(meta || {}), attributes: attrs };
    } catch {
      return meta;
    }
  }, []);

  const fetchDynamicTraitsFor = React.useCallback(
    async (nft) => {
      try {
        const tokenId = nft?.tokenId != null ? String(nft.tokenId) : "";
        if (!tokenId) return;
        if (dynamicTraitsById[tokenId]) return;

        const reader =
          getCachedReaderInstance("main") ||
          getCachedReaderInstance("tokenomics") ||
          getCachedReaderInstance("generic");

        if (!reader || typeof reader.getMintDataByTokenId !== "function") return;

        const res = await reader.getMintDataByTokenId(BigInt(tokenId));
        const ticket = toNumEth(res?.[0]);
        const block = toNumEth(res?.[1]);
        const final = toNumEth(res?.[2]);

        const next = {};
        if (ticket != null) next.mintTicket = ticket;
        if (block != null) next.mintBlock = block;
        if (final != null) next.mintFinal = final;

        if (Object.keys(next).length) {
          setDynamicTraitsById((prev) => ({ ...prev, [tokenId]: next }));
        }
      } catch {
        // ignore best-effort dynamic traits
      }
    },
    [dynamicTraitsById],
  );

  /* ====================================================================== */
  /* ============================ WALLET ASSETS ============================ */
  /* ====================================================================== */

  const findTicketsViaLogs = React.useCallback(async (contract, addr) => {
    const provider = getProviderFor(contract);
    if (!provider) throw new Error("Provider not available");
    const latest = await provider.getBlockNumber();
    const FROM = await getSafeDeployBlock(provider);

    const toFilter = contract.filters.Transfer(null, addr, null);
    const fromFilter = contract.filters.Transfer(addr, null, null);

    const scanLogs = async (fullHistory = false) => {
      const logProvider = getArchiveProvider() || provider;
      const direct = await (async () => {
        try {
          if (!logProvider || typeof logProvider.getLogs !== "function")
            return null;
          const address = toFilter?.address || contract?.target || contract?.address;
          const [toLogs, fromLogs] = await Promise.all([
            logProvider.getLogs({
              address,
              topics: toFilter?.topics,
              fromBlock: FROM,
              toBlock: latest,
            }),
            logProvider.getLogs({
              address,
              topics: fromFilter?.topics,
              fromBlock: FROM,
              toBlock: latest,
            }),
          ]);
          return { toLogs, fromLogs };
        } catch {
          return null;
        }
      })();
      if (direct) return direct;

      const opts = fullHistory ? { fullHistory: true } : undefined;
      const [toLogs, fromLogs] = await Promise.all([
        queryLogsBatched(contract, toFilter, FROM, latest, LOGS_BATCH, opts),
        queryLogsBatched(contract, fromFilter, FROM, latest, LOGS_BATCH, opts),
      ]);
      return { toLogs, fromLogs };
    };

    let { toLogs, fromLogs } = await scanLogs(false);
    if (!toLogs.length && !fromLogs.length) {
      let balance = null;
      try {
        balance = await contract.balanceOf(addr);
      } catch {}
      const hasBalance = (() => {
        try {
          if (balance == null) return false;
          return BigInt(balance.toString()) > 0n;
        } catch {
          return false;
        }
      })();
      const shouldRetry = hasBalance || balance == null;
      if (shouldRetry && getArchiveProvider()) {
        ({ toLogs, fromLogs } = await scanLogs(true));
      }
    }

    const all = [...toLogs, ...fromLogs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.logIndex - b.logIndex;
    });

    const held = new Set();
    const me = String(addr || "").toLowerCase();
    for (const l of all) {
      const args = l.args;
      const from = String(safeLogArg(args, "from", 0) ?? "").toLowerCase();
      const to = String(safeLogArg(args, "to", 1) ?? "").toLowerCase();
      const tokenId = safeLogArg(args, "tokenId", 2)?.toString?.() || "";
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
        if (isT) onlyTickets.push(BigInt(tid));
      } catch {}
    }

    return onlyTickets;
  }, []);

    const fetchMyTickets = React.useCallback(async (addr) => {
      try {
        const contract = contractRef.current || getReadOnlyContract();
        const reader = getCachedReaderInstance("main");

        let ids = [];
        try {
          if (reader && typeof reader.findTicket === "function") {
            ids = await reader.findTicket(addr);
          }
          if (!ids?.length && typeof contract.findTicket === "function") {
            ids = await contract.findTicket(addr);
          }
          if (!ids?.length) {
            ids = await findTicketsViaLogs(contract, addr);
          }
        } catch {
          ids = await findTicketsViaLogs(contract, addr);
        }

      const coerceBool = (val) => {
        if (typeof val === "boolean") return val;
        if (typeof val === "bigint") return val !== 0n;
        if (typeof val?.toString === "function") {
          const s = val.toString();
          if (s === "0") return false;
          if (s === "1") return true;
        }
        return Boolean(val);
      };

      let ticketIds = ids;
      if (typeof contract?.isTicket === "function" && Array.isArray(ids)) {
        const filtered = [];
        for (const id of ids) {
          try {
            const res = await contract.isTicket(id);
            if (res != null && !coerceBool(res)) continue;
          } catch {
            // ignore isTicket failures, keep id
          }
          filtered.push(id);
        }
        ticketIds = filtered;
      }

      const metas = await mapLimit(ticketIds, 4, async (idBN) => {
        const id = idBN.toString();
        let meta = {
          name: "Biggi Mint Ticket",
          description: `Redeem this ticket (#${id}) to mint a BiggiEyes NFT.`,
        };
        let image = PLACEHOLDER_IMAGE;

        try {
          const uri = await getTokenUriCached(contract, idBN);
          const j = await readJsonFromURICached(uri);
          if (j) {
            meta = j;
            const imgUrl = j?.image || j?.image_url;
            image = (await resolveImageUrlCached(imgUrl, uri)) || image;
          }
        } catch {}

        if (!image || image === PLACEHOLDER_IMAGE) {
          image = ticketImageUrl();
        }
        if (!meta?.name || /^\d{8,}$/.test(String(meta.name))) {
          meta = {
            ...(meta || {}),
            name: "Biggi Mint Ticket",
          };
        }

        return {
          tokenId: id,
          image,
          meta,
          isTicket: true,
          contractAddress: contract?.target || contract?.address || null,
        };
      });

      return metas;
    } catch (e) {
      console.error("fetchMyTickets", e);
      return [];
    }
  }, [findTicketsViaLogs]);

  const fetchOwnedNFTsViaTransfers = React.useCallback(async (addr) => {
    try {
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
      const toTokenId = (raw) => {
        if (raw == null) return "";
        try {
          if (typeof raw === "bigint") return raw.toString();
          if (typeof raw === "number") {
            if (!Number.isFinite(raw) || raw < 0) return "";
            return Math.trunc(raw).toString();
          }
          if (typeof raw === "string") {
            const s = raw.trim();
            if (!s) return "";
            if (/^\d+$/.test(s)) return s;
            return BigInt(s).toString();
          }
          if (typeof raw?.toString === "function") {
            const s = raw.toString();
            if (!s) return "";
            if (/^\d+$/.test(s)) return s;
            return BigInt(s).toString();
          }
        } catch {
          return "";
        }
        return "";
      };
      const hasPositiveBalance = (value) => {
        try {
          if (value == null) return false;
          return BigInt(value.toString()) > 0n;
        } catch {
          return false;
        }
      };
      const coerceBool = (val) => {
        if (typeof val === "boolean") return val;
        if (typeof val === "bigint") return val !== 0n;
        if (typeof val?.toString === "function") {
          const s = val.toString();
          if (s === "0") return false;
          if (s === "1") return true;
        }
        return Boolean(val);
      };
      const uniqIds = (list) => {
        const out = [];
        const seen = new Set();
        for (const raw of Array.isArray(list) ? list : []) {
          const id = toTokenId(raw);
          if (!id || seen.has(id)) continue;
          seen.add(id);
          out.push(id);
        }
        return out;
      };

      const getProviderSafe = async () => {
        let c = contractRef.current || getReadOnlyContract();
        let p = getProviderFor(c);
        if (!p) throw new Error("Provider not available");
        try {
          const latestBlock = await p.getBlockNumber();
          return { contract: c, provider: p, latest: latestBlock };
        } catch (err) {
          // RPC failed (CORS / offline). Reset and retry once with a fresh provider.
          clearPreferredRpc();
          try {
            await ensurePreferredRpc();
          } catch {
            // ignore health probe failures
          }
          resetROProvider();
          c = getReadOnlyContract();
          contractRef.current = c;
          p = getProviderFor(c);
          if (p) {
            const latestBlock = await p.getBlockNumber();
            return { contract: c, provider: p, latest: latestBlock };
          }
          // Final fallback: use injected provider (MetaMask) if available.
          try {
            const injectedEth = getInjectedProvider();
            if (!injectedEth) throw err;
            const injected = new BrowserProvider(injectedEth, "any");
            const latestBlock = await injected.getBlockNumber();
            const injectedContract = c.connect(injected);
            return {
              contract: injectedContract,
              provider: injected,
              latest: latestBlock,
            };
          } catch {
            throw err;
          }
        }
      };

      const { contract, provider, latest } = await getProviderSafe();
      const me = String(addr || "").toLowerCase();

      // Prefer reader-based owner token id queries if available (fast + avoids archive log scans).
      // If this returns data, we only fall back to Transfer logs when necessary.
      let tokenIdsFromReader = null;
      try {
        const reader = getCachedReaderInstance("main");
        if (reader) {
          if (typeof reader.getUserRewardTokenIds === "function") {
            const res = await reader
              .getUserRewardTokenIds(addr)
              .catch(() => null);
            if (Array.isArray(res) && res.length) tokenIdsFromReader = res;
          }
          if (
            !tokenIdsFromReader &&
            typeof reader.getUserTokenIds === "function"
          ) {
            const res = await reader.getUserTokenIds(addr).catch(() => null);
            if (Array.isArray(res) && res.length) tokenIdsFromReader = res;
          }
          if (
            !tokenIdsFromReader &&
            typeof reader.tokensOfOwner === "function"
          ) {
            const res = await reader.tokensOfOwner(addr).catch(() => null);
            if (Array.isArray(res) && res.length) tokenIdsFromReader = res;
          }
        }
      } catch {
        tokenIdsFromReader = null;
      }

      let ticketBaseUri = null;
      try {
        if (typeof contract.ticketBaseURI === "function") {
          const base = await contract.ticketBaseURI().catch(() => null);
          if (base) ticketBaseUri = String(base);
        }
      } catch {
        ticketBaseUri = null;
      }

      const normalizedTicketBase = normalizeBaseUri(ticketBaseUri);
      let tokenIds = uniqIds(tokenIdsFromReader);
      let balance = null;
      const readBalance = async () => {
        if (balance != null) return balance;
        try {
          balance = await contract.balanceOf(addr);
        } catch {
          balance = null;
        }
        return balance;
      };

      if (!tokenIds.length) {
        const FROM = await getSafeDeployBlock(provider);
        const toFilter = contract.filters.Transfer(null, addr, null);
        const fromFilter = contract.filters.Transfer(addr, null, null);

        const scanLogs = async (fullHistory = false) => {
          const logProvider = getArchiveProvider() || provider;
          const direct = await (async () => {
            try {
              if (!logProvider || typeof logProvider.getLogs !== "function")
                return null;
              const address =
                toFilter?.address || contract?.target || contract?.address;
              const [toLogs, fromLogs] = await Promise.all([
                logProvider.getLogs({
                  address,
                  topics: toFilter?.topics,
                  fromBlock: FROM,
                  toBlock: latest,
                }),
                logProvider.getLogs({
                  address,
                  topics: fromFilter?.topics,
                  fromBlock: FROM,
                  toBlock: latest,
                }),
              ]);
              return { toLogs, fromLogs };
            } catch {
              return null;
            }
          })();
          if (direct) return direct;

          const opts = fullHistory ? { fullHistory: true } : undefined;
          try {
            const [toLogs, fromLogs] = await Promise.all([
              queryLogsBatched(
                contract,
                toFilter,
                FROM,
                latest,
                LOGS_BATCH,
                opts,
              ),
              queryLogsBatched(
                contract,
                fromFilter,
                FROM,
                latest,
                LOGS_BATCH,
                opts,
              ),
            ]);
            return { toLogs, fromLogs };
          } catch (err) {
            // If RO provider blocks getLogs (CORS / rate limit), fall back to injected provider.
            const eth = getInjectedProvider();
            if (!eth) throw err;
            const injected = new BrowserProvider(eth, "any");
            const injectedLatest = await injected
              .getBlockNumber()
              .catch(() => latest);
            const injectedContract = contract.connect(injected);
            const toFilterInjected = injectedContract.filters.Transfer(
              null,
              addr,
              null,
            );
            const fromFilterInjected = injectedContract.filters.Transfer(
              addr,
              null,
              null,
            );
            const [toLogs, fromLogs] = await Promise.all([
              queryLogsBatched(
                injectedContract,
                toFilterInjected,
                FROM,
                injectedLatest,
                LOGS_BATCH,
                opts,
              ),
              queryLogsBatched(
                injectedContract,
                fromFilterInjected,
                FROM,
                injectedLatest,
                LOGS_BATCH,
                opts,
              ),
            ]);
            return { toLogs, fromLogs };
          }
        };

        let { toLogs, fromLogs } = await scanLogs(false);
        const bal = await readBalance();
        const hasBalance = hasPositiveBalance(bal);

        if (!toLogs.length && !fromLogs.length) {
          const shouldRetry = hasBalance || bal == null;
          if (shouldRetry && getArchiveProvider()) {
            ({ toLogs, fromLogs } = await scanLogs(true));
          }
        }

        const all = [...toLogs, ...fromLogs].sort((a, b) => {
          if (a.blockNumber !== b.blockNumber)
            return a.blockNumber - b.blockNumber;
          return a.logIndex - b.logIndex;
        });

        const held = new Set();
        for (const l of all) {
          const args = l.args;
          const topicFrom = topicToAddress(l?.topics?.[1]);
          const topicTo = topicToAddress(l?.topics?.[2]);
          const topicToken = topicToBigInt(l?.topics?.[3]);

          const from = String(
            (topicFrom || safeLogArg(args, "from", 0) || "") ?? "",
          ).toLowerCase();
          const to = String(
            (topicTo || safeLogArg(args, "to", 1) || "") ?? "",
          ).toLowerCase();

          const tokenId = toTokenId(topicToken ?? safeLogArg(args, "tokenId", 2));
          if (!tokenId) continue;
          if (to === me) held.add(tokenId);
          if (from === me) held.delete(tokenId);
        }

        tokenIds = Array.from(held);

        if (!tokenIds.length && hasBalance) {
          const directIds = [];
          if (typeof contract.tokensOfOwner === "function") {
            try {
              const res = await contract.tokensOfOwner(addr);
              if (Array.isArray(res) && res.length) {
                directIds.push(...res);
              }
            } catch {
              // ignore tokensOfOwner errors
            }
          }
          if (!directIds.length && typeof contract.walletOfOwner === "function") {
            try {
              const res = await contract.walletOfOwner(addr);
              if (Array.isArray(res) && res.length) {
                directIds.push(...res);
              }
            } catch {
              // ignore walletOfOwner errors
            }
          }
          if (
            !directIds.length &&
            typeof contract.tokenOfOwnerByIndex === "function"
          ) {
            try {
              const balLocal = BigInt((await readBalance())?.toString?.() || "0");
              for (let i = 0n; i < balLocal; i += 1n) {
                const id = await contract.tokenOfOwnerByIndex(addr, i).catch(
                  () => null,
                );
                if (id != null) directIds.push(id);
              }
            } catch {
              // ignore tokenOfOwnerByIndex errors
            }
          }
          tokenIds = uniqIds(directIds);
        }

        // Last-resort fallback for RPCs that reject / trim logs:
        // scan ownerOf over known minted range (cheap here, collection is small).
        if (!tokenIds.length && hasBalance && typeof contract.ownerOf === "function") {
          let upperBound = 0;
          const upperFns = [
            "ticketMinted",
            "biggiMinted",
            "tokenMinted",
            "totalSupply",
          ];
          for (const fn of upperFns) {
            if (typeof contract?.[fn] !== "function") continue;
            try {
              const raw = await contract[fn]();
              const id = toTokenId(raw);
              if (!id) continue;
              upperBound = Math.max(upperBound, Number(id));
            } catch {
              // ignore getter errors
            }
          }
          try {
            const balNum = Number(
              BigInt((await readBalance())?.toString?.() || "0"),
            );
            if (!Number.isFinite(upperBound) || upperBound <= 0) {
              upperBound = Math.max(50, balNum * 16);
            }
            upperBound = Math.max(upperBound, balNum);
          } catch {
            if (!Number.isFinite(upperBound) || upperBound <= 0) upperBound = 550;
          }
          upperBound = Math.max(1, Math.min(Math.trunc(upperBound), 2500));

          const idsToProbe = Array.from({ length: upperBound }, (_, i) =>
            String(i + 1),
          );
          const owned = new Set();
          await mapLimit(idsToProbe, 16, async (id) => {
            try {
              const owner = await contract.ownerOf(id);
              if (String(owner || "").toLowerCase() === me) owned.add(id);
            } catch {
              // token not minted or RPC rejected this id
            }
          });
          tokenIds = Array.from(owned);
        }
      }

      tokenIds = uniqIds(tokenIds);

      if (tokenIds.length && typeof contract?.ownerOf === "function") {
        const verified = await mapLimit(tokenIds, 8, async (id) => {
          try {
            const owner = await contract.ownerOf(id);
            if (String(owner || "").toLowerCase() === me) return id;
          } catch {
            // ownerOf reverts for nonexistent/burned tokens
          }
          return null;
        });
        tokenIds = verified.filter(Boolean);
      }

      if (!tokenIds.length) {
        const balAfter = await readBalance();
        const hasBalanceAfter = hasPositiveBalance(balAfter);
        if (hasBalanceAfter && typeof contract.ownerOf === "function") {
          let upperBound = 0;
          const upperFns = [
            "ticketMinted",
            "biggiMinted",
            "tokenMinted",
            "totalSupply",
          ];
          for (const fn of upperFns) {
            if (typeof contract?.[fn] !== "function") continue;
            try {
              const raw = await contract[fn]();
              const id = toTokenId(raw);
              if (!id) continue;
              upperBound = Math.max(upperBound, Number(id));
            } catch {
              // ignore getter errors
            }
          }
          try {
            const balNum = Number(
              BigInt((balAfter)?.toString?.() || "0"),
            );
            if (!Number.isFinite(upperBound) || upperBound <= 0) {
              upperBound = Math.max(50, balNum * 16);
            }
            upperBound = Math.max(upperBound, balNum);
          } catch {
            if (!Number.isFinite(upperBound) || upperBound <= 0) upperBound = 550;
          }
          upperBound = Math.max(1, Math.min(Math.trunc(upperBound), 2500));

          const idsToProbe = Array.from({ length: upperBound }, (_, i) =>
            String(i + 1),
          );
          const owned = new Set();
          await mapLimit(idsToProbe, 16, async (id) => {
            try {
              const owner = await contract.ownerOf(id);
              if (String(owner || "").toLowerCase() === me) owned.add(id);
            } catch {
              // token not minted or RPC rejected this id
            }
          });
          tokenIds = Array.from(owned);
        }
      }
      if (!tokenIds.length) {
        saveWalletCache(addr, []);
        return [];
      }

      const metas = await mapLimit(tokenIds, 4, async (tid) => {
        let isT = false;
        try {
          if (typeof contract?.isTicket === "function") {
            isT = coerceBool(await contract.isTicket(tid));
          }
        } catch {
          isT = false;
        }

        let info = null;
        let infoMinted = null;
        if (typeof contract?.nftInfo === "function") {
          try {
            info = await contract.nftInfo(tid);
            const mintedFlag = info?.minted ?? info?.[0];
            infoMinted = typeof mintedFlag === "boolean" ? mintedFlag : coerceBool(mintedFlag);
          } catch {
            info = null;
            infoMinted = null;
          }
        }

        let uri = null;
        let j = null;
        try {
          uri = await getTokenUriCached(contract, tid);
          if (uri) j = await readJsonFromURICached(uri);
        } catch {
          uri = null;
          j = null;
        }

        const uriLooksTicket = isTicketUri(uri, normalizedTicketBase);
        let metaLooksTicket = looksLikeTicketMeta(j);
        let metaLooksNft = looksLikeNftMeta(j);

        if (isT && metaLooksNft) isT = false;
        if (isT && uri && !uriLooksTicket) isT = false;
        if (isT && infoMinted === true) isT = false;

        // Ticket -> NFT transition can lag a few blocks and often keeps the same tokenId.
        // Force refresh whenever metadata still looks like a ticket (or ticket flag is true).
        if (isT || uriLooksTicket || metaLooksTicket) {
          try {
            const freshUri = await getTokenUriCached(contract, tid, {
              force: true,
            });
            if (freshUri && freshUri !== uri) {
              uri = freshUri;
              j = await readJsonFromURICached(uri, { force: true });
            } else if (uri) {
              j = await readJsonFromURICached(uri, { force: true });
            }
          } catch {
            // ignore forced refresh errors
          }
          metaLooksTicket = looksLikeTicketMeta(j);
          metaLooksNft = looksLikeNftMeta(j);
          if (isT && metaLooksNft) isT = false;
        }

        const finalIsTicket = Boolean(isT && !metaLooksNft);
        if (!finalIsTicket && infoMinted === false && !uri && !j) {
          // Keep a placeholder entry instead of dropping owned NFTs when RPC metadata fails.
        }
        let meta = {};
        let image = PLACEHOLDER_IMAGE;
        try {
          const cached = getCachedPriceAttrs(tid);
          const base =
            j ||
            (finalIsTicket
              ? {
                  name: `Ticket #${tid}`,
                  description: "Redeem this ticket to mint a BiggiEyes NFT.",
                }
              : {
                  name: `Biggi NFT #${tid}`,
                  description: "Metadata is updating after redeem.",
                });

          if (!finalIsTicket && metaLooksTicket && !metaLooksNft) {
            base.name = `Biggi NFT #${tid}`;
            base.description = "Metadata is updating after redeem.";
          }
          if (finalIsTicket && !looksLikeTicketMeta(base)) {
            base.name = `Ticket #${tid}`;
            base.description = "Redeem this ticket to mint a BiggiEyes NFT.";
          }

          if (finalIsTicket) {
            meta = base;
          } else {
            base.attributes = mergeAttrs(base.attributes, cached);
            meta = await enrichMetaWithPrices(contract, tid, base);
          }

          const imgUrl = j?.image || j?.image_url;
          image = (await resolveImageUrlCached(imgUrl, uri)) || image;
          // For tickets, keep the resolved ticket image when available.
        } catch {
          // keep fallback
        }

        if (!finalIsTicket) {
          let needsImageFallback = !image || image === PLACEHOLDER_IMAGE;
          let needsAttrsFallback =
            !meta ||
            !Array.isArray(meta.attributes) ||
            meta.attributes.length === 0;

          if ((needsImageFallback || needsAttrsFallback) && uri) {
            const parsed = parseTokenUriParts(uri);
            if (parsed) {
              const { mainId, blockName, bgCode } = parsed;
              const bgName = bgNameFromCode(bgCode) || bgCode;
              if (needsImageFallback && blockName && bgCode && mainId) {
                const fileName = `Biggi_${mainId}_${blockName}_${bgCode}.png`;
                const fallbackImage = buildBlockImageUrl(blockName, fileName);
                if (fallbackImage) image = fallbackImage;
              }
              if (needsAttrsFallback && (blockName || bgName)) {
                const attrs = mergeAttrs(meta?.attributes, [
                  blockName
                    ? { trait_type: "Block", value: blockName }
                    : null,
                  bgName
                    ? { trait_type: "Background", value: bgName }
                    : null,
                ].filter(Boolean));
                meta = { ...(meta || {}), attributes: attrs };
              }
              if (!meta?.name) {
                meta = { ...(meta || {}), name: `Biggi NFT #${mainId}` };
              }
            }
            needsImageFallback = !image || image === PLACEHOLDER_IMAGE;
            needsAttrsFallback =
              !meta ||
              !Array.isArray(meta.attributes) ||
              meta.attributes.length === 0;
          }

          if ((needsImageFallback || needsAttrsFallback) && info) {
            try {
              const parsed = parseNftInfo(info);
              if (parsed) {
                const { blockName, bgCode, bgName, mainId, blockIdx } = parsed;
                let baseUri = null;
                if (needsImageFallback && typeof contract?.blockBaseURIs === "function") {
                  const candidates = [];
                  const n = Number(blockIdx);
                  if (Number.isFinite(n)) {
                    candidates.push(n);
                    if (n > 0) candidates.push(n - 1);
                    candidates.push(n + 1);
                  }
                  for (const idx of candidates) {
                    const v = await contract.blockBaseURIs(idx).catch(() => null);
                    if (typeof v === "string" && v.trim()) {
                      baseUri = v.trim();
                      break;
                    }
                  }
                }
                if (
                  needsImageFallback &&
                  blockName &&
                  bgCode &&
                  mainId
                ) {
                  const fileName = `Biggi_${mainId}_${blockName}_${bgCode}.png`;
                  const fallbackImage = buildBlockImageUrl(blockName, fileName, baseUri);
                  if (fallbackImage) image = fallbackImage;
                }
                if (blockName || bgName) {
                  const attrs = mergeAttrs(meta?.attributes, [
                    blockName
                      ? { trait_type: "Block", value: blockName }
                      : null,
                    bgName
                      ? { trait_type: "Background", value: bgName }
                      : null,
                  ].filter(Boolean));
                  meta = { ...(meta || {}), attributes: attrs };
                }
              }
            } catch {
              // ignore nftInfo fallback errors
            }
          }
        }

        if (finalIsTicket) {
          if (!image || image === PLACEHOLDER_IMAGE) {
            image = ticketImageUrl();
          }
          if (!meta?.name || /^\d{8,}$/.test(String(meta.name))) {
            meta = {
              ...(meta || {}),
              name: "Biggi Mint Ticket",
            };
          }
        }

        return {
          tokenId: String(tid),
          image,
          meta,
          isTicket: finalIsTicket,
          contractAddress: contract?.target || contract?.address || null,
        };
      });

      const resolved = metas.filter(Boolean);
      saveWalletCache(addr, resolved);
      return resolved;
    } catch (e) {
      console.error("fetchOwnedNFTsViaTransfers", e);
      return [];
    }
  }, [enrichMetaWithPrices]);

  const mergeWithTopFirst = React.useCallback((finalList) => {
    return setMyNFTs((prev) => {
      const pending = prev.find((x) => x.isPending);
      if (VRFPending && pending) {
        const minted = finalList.find(
          (x) =>
            x.tokenId === pending.tokenId && !x.isPending && !x.isTicket,
        );
        if (minted) {
          const rest = finalList.filter((x) => x.tokenId !== pending.tokenId);
          return [minted, ...rest];
        }
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
    });
  }, [VRFPending, topFirstId]);

  const fetchWalletAssets = React.useCallback(async (addr) => {
    if (!addr) return [];
    if (walletFetchRef.current.inFlight && walletFetchRef.current.addr === addr) {
      return walletFetchRef.current.inFlight;
    }

    const contractForCache = contractRef.current || getReadOnlyContract();
    const contractAddr =
      contractForCache?.target || contractForCache?.address || null;

    const cached = loadWalletCache(addr);
    const galleryCached = loadGalleryCache(addr, {
      allowExpired: true,
      contractAddr,
    });
    const seed =
      cached?.length ? cached : galleryCached?.length ? galleryCached : null;
    if (seed?.length) mergeWithTopFirst(seed);

    const showSpinner = !seed?.length;

    const exec = (async () => {
      if (showSpinner) setGalleryLoading(true);
      try {
        const tickets = await fetchMyTickets(addr);
        const nfts = await fetchOwnedNFTsViaTransfers(addr);

        const byId = new Map();
        const upsert = (item) => {
          if (!item?.tokenId) return;
          const key = String(item.tokenId);
          const prev = byId.get(key);
          if (!prev) {
            byId.set(key, item);
            return;
          }

          const prevIsTicket = Boolean(prev?.isTicket);
          const nextIsTicket = Boolean(item?.isTicket);
          if (prevIsTicket && !nextIsTicket) {
            byId.set(key, item);
            return;
          }
          if (!prevIsTicket && nextIsTicket) {
            return;
          }

          const prevPending = Boolean(prev?.isPending);
          const nextPending = Boolean(item?.isPending);
          if (prevPending && !nextPending) {
            byId.set(key, item);
            return;
          }
          if (!prevPending && nextPending) {
            return;
          }

          byId.set(key, item);
        };

        for (const t of tickets) upsert(t);
        for (const n of nfts) upsert(n);

        const final = Array.from(byId.values());
        const mergeWithCache = (fresh, cachedList) => {
          if (!Array.isArray(cachedList) || !cachedList.length) return fresh;
          const map = new Map(
            cachedList
              .map((item) => [String(item?.tokenId ?? ""), item])
              .filter(([k]) => k),
          );
          return fresh.map((item) => {
            const key = String(item?.tokenId ?? "");
            const prev = key ? map.get(key) : null;
            return prev ? mergeGalleryItem(prev, item) : item;
          });
        };

        const merged = mergeWithCache(final, seed);
        mergeWithTopFirst(merged);
        saveWalletCache(addr, merged);
        saveGalleryCache(addr, merged, contractAddr);
        await refreshClaimable(addr, merged);
        return merged;
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
  }, [
    fetchMyTickets,
    fetchOwnedNFTsViaTransfers,
    mergeWithTopFirst,
    refreshClaimable,
  ]);

  /* ====================================================================== */
  /* ============================ LAST MINTED ============================== */
  /* ====================================================================== */

  const fetchLastMinted = React.useCallback(async () => {
    try {
      const contract = contractRef.current || getReadOnlyContract();
      const provider = getProviderFor(contract);
      if (!provider) throw new Error("Provider not available");
      let total = null;
      try {
        const totalRaw = await callFirst(contract, [
          "biggiMinted",
          "totalSupply",
          "totalMinted",
          "nftMinted",
          "minted",
        ]);
        if (totalRaw != null) {
          const totalStr =
            typeof totalRaw?.toString === "function" ? totalRaw.toString() : totalRaw;
          const totalNum = Number(totalStr);
          if (Number.isFinite(totalNum)) total = totalNum;
        }
      } catch {}

      if (total != null && total <= 0) {
        setLastMinted({
          tokenId: "-",
          image: "/images/Biggi.png",
          blockName: "-",
          backgroundName: "-",
        });
        return;
      }

      let logs = [];
      try {
        const latest = await provider.getBlockNumber();
        const filter = contract.filters.NFTMinted();
        const baseFrom = await getSafeDeployBlock(provider);
        const latestNum = Number(latest ?? 0);
        const safeLatest = Number.isFinite(latestNum) && latestNum >= 0 ? latestNum : 0;

        let from = Number(baseFrom);
        if (!Number.isFinite(from) || from < 0) {
          from = Math.max(0, safeLatest - 60_000);
        } else {
          from = Math.max(0, Math.min(from, safeLatest));
          from = Math.max(from, safeLatest - 60_000);
        }
        let to = safeLatest;
        // Some RPC endpoints reject single-block ranges or edge ranges at tip.
        if (from >= to && to > 0) {
          from = Math.max(0, to - 1);
        }

        try {
          logs = await queryLogsBatched(contract, filter, from, to, LOGS_BATCH, {
            preferArchive: false,
          });
        } catch (err) {
          const msg = String(err?.message || "");
          if (/invalid block range params/i.test(msg)) {
            const fallbackTo = Math.max(0, safeLatest - 1);
            const fallbackFrom = Math.max(0, fallbackTo - 8_000);
            logs = await queryLogsBatched(
              contract,
              filter,
              fallbackFrom,
              fallbackTo,
              LOGS_BATCH,
              { preferArchive: false },
            );
          } else {
            console.warn("fetchLastMinted: log query failed", err);
          }
        }
      } catch (err) {
        console.warn("fetchLastMinted: log scan skipped", err);
      }
      const last = logs[logs.length - 1];
      const tokenIdArg = last ? safeLogArg(last.args, "tokenId", 1) : null;
      let tokenId =
        tokenIdArg != null && typeof tokenIdArg.toString === "function"
          ? tokenIdArg.toString()
          : "";
      if ((!tokenId || tokenId === "0") && total != null && total > 0) {
        tokenId = String(total);
      }
      if (!tokenId || tokenId === "0") {
        setLastMinted({
          tokenId: "-",
          image: "/images/Biggi.png",
          blockName: "-",
          backgroundName: "-",
        });
        return;
      }

      let uri = null;
      try {
        uri = await getTokenUriCached(contract, tokenId);
      } catch (err) {
        const msg = String(err?.message || "");
        if (/NoToken/i.test(msg)) {
          uri = null;
        } else {
          console.warn("fetchLastMinted: tokenURI failed", err);
          uri = null;
        }
      }
      let meta = await readJsonFromURICached(uri);
      if (looksLikeTicketMeta(meta)) {
        try {
          const freshUri = await getTokenUriCached(contract, tokenId, {
            force: true,
          });
          if (freshUri && freshUri !== uri) {
            uri = freshUri;
            meta = await readJsonFromURICached(uri, { force: true });
          } else if (uri) {
            meta = await readJsonFromURICached(uri, { force: true });
          }
        } catch {
          // ignore refresh errors
        }
      }

      let image =
        (await resolveImageUrlCached(meta?.image || meta?.image_url, uri)) ||
        PLACEHOLDER_IMAGE;
      // If metadata is still a ticket, keep the ticket image (if any) so LiveStats isn't blank.

      let blockName = "-";
      let backgroundName = "-";

      const attrs = Array.isArray(meta?.attributes) ? meta.attributes : [];
      const findAttr = (names) =>
        attrs.find((a) =>
          names.includes(String(a?.trait_type || "").toLowerCase()),
        );

      const blockAttr =
        findAttr(["eye color", "eyes", "block/eye color", "block", "block id"]) ||
        findAttr(["linked block", "block name"]);

      if (blockAttr) blockName = blockAttr.value;

      const bgAttr = findAttr(["background", "background color"]);

      if (bgAttr) backgroundName = canonBackgroundName(bgAttr.value) || bgAttr.value;

      if (image === PLACEHOLDER_IMAGE || blockName === "-" || backgroundName === "-") {
        const parsed = parseTokenUriParts(uri);
        if (parsed) {
          const { mainId, blockName: bName, bgCode } = parsed;
          const bgName = bgNameFromCode(bgCode) || bgCode;
          if (image === PLACEHOLDER_IMAGE && bName && bgCode && mainId) {
            const fileName = `Biggi_${mainId}_${bName}_${bgCode}.png`;
            const fallbackImage = buildBlockImageUrl(bName, fileName);
            if (fallbackImage) image = fallbackImage;
          }
          if (blockName === "-" && bName) blockName = bName;
          if (backgroundName === "-" && bgName) backgroundName = bgName;
        }
      }

      if (
        (image === PLACEHOLDER_IMAGE || blockName === "-" || backgroundName === "-") &&
        typeof contract?.nftInfo === "function"
      ) {
        try {
          const info = await contract.nftInfo(tokenId);
          const parsed = parseNftInfo(info);
          if (parsed) {
            const { blockName: bName, bgCode, bgName, mainId, blockIdx } = parsed;
            let baseUri = null;
            if (image === PLACEHOLDER_IMAGE && typeof contract?.blockBaseURIs === "function") {
              const candidates = [];
              const n = Number(blockIdx);
              if (Number.isFinite(n)) {
                candidates.push(n);
                if (n > 0) candidates.push(n - 1);
                candidates.push(n + 1);
              }
              for (const idx of candidates) {
                const v = await contract.blockBaseURIs(idx).catch(() => null);
                if (typeof v === "string" && v.trim()) {
                  baseUri = v.trim();
                  break;
                }
              }
            }
            if (blockName === "-" && bName) blockName = bName;
            if (backgroundName === "-" && bgName) backgroundName = bgName;
            if (
              image === PLACEHOLDER_IMAGE &&
              bName &&
              bgCode &&
              mainId
            ) {
              const fileName = `Biggi_${mainId}_${bName}_${bgCode}.png`;
              const fallbackImage = buildBlockImageUrl(bName, fileName, baseUri);
              if (fallbackImage) image = fallbackImage;
            }
          }
        } catch {
          // ignore nftInfo fallback errors
        }
      }

      setLastMinted({ tokenId, image, blockName, backgroundName });
    } catch (e) {
      const msg = String(e?.message || "");
      if (/invalid block range params/i.test(msg)) {
        console.warn("fetchLastMinted skipped due to RPC range validation");
        return;
      }
      console.error("fetchLastMinted", e);
    }
  }, []);

  /* ====================================================================== */
  /* ============================ VRF PANEL DATA =========================== */
  /* ====================================================================== */

  const buildVRFHistory = React.useCallback(async (c, address) => {
    const provider = getProviderFor(c);
    if (!provider) throw new Error("Provider not available");
    const latest = await provider.getBlockNumber();
    const safeFrom = await getSafeDeployBlock(provider);
    const hintFrom = redeemStartBlock ? Math.max(redeemStartBlock - 2000, 0) : 0;
    const from = FULL_HISTORY
      ? Math.max(safeFrom, hintFrom || 0)
      : Math.max(safeFrom, hintFrom || 0, latest - 120_000);

    const reqLogs = await queryLogsBatched(c, c.filters.VRFRequested(address), from, latest);

    const fulfillLogsRaw = await queryLogsBatched(
      c,
      c.filters.VRFFulfillStarted(),
      from,
      latest
    );

    const fulfillLogs = fulfillLogsRaw.filter((l) => {
      const m =
        (safeLogArg(l.args, "minter", 1) || "").toLowerCase?.() || "";
      return m === address.toLowerCase();
    });

    const fulfillByReq = new Map();
    for (const l of fulfillLogs) {
      const rid = safeLogArg(l.args, "requestId", 0)?.toString?.() || "";
      const rw = safeLogArg(l.args, "randomWord", 2)?.toString?.() || "";
      fulfillByReq.set(rid, {
        requestId: rid,
        tx: l.transactionHash,
        blockNumber: l.blockNumber,
        randomWords: rw ? [rw] : [],
      });
    }

    const rows = [];
    for (const rl of reqLogs) {
      const rid = safeLogArg(rl.args, "requestId", 1)?.toString?.() || "";
      const f = fulfillByReq.get(rid);

      let time = "";
      try {
      const block = await provider.getBlock(rl.blockNumber);
        if (block?.timestamp) time = new Date(block.timestamp * 1000).toLocaleString();
      } catch {}

      rows.push({
        time,
        requestId: rid,
        status: f ? "fulfilled" : "pending",
        words: f?.randomWords?.length || 0,
        tx: f?.tx || "",
        blockNumber: f?.blockNumber || rl.blockNumber,
        randomWords: f?.randomWords || [],
      });
    }

    rows.sort((a, b) => a.blockNumber - b.blockNumber);
    return rows.slice(-25).reverse();
  }, [redeemStartBlock]);

  const refreshVRFPanel = React.useCallback(async () => {
    try {
      const c = contractRef.current || getReadOnlyContract();
      const provider = getProviderFor(c);
      if (!provider) throw new Error("Provider not available");
      const net = await provider.getNetwork();

      let params = {};
      let subId = "";

      try {
        const vrf = getVRFRO(provider);
        const [keyHash, conf, numWords, gas, sub, coord] = await Promise.all([
          vrf?.keyHash ? vrf.keyHash().catch(() => "") : c.keyHash().catch(() => ""),
          c.requestConfirmations?.().catch?.(() => 3) ?? 3,
          vrf?.numWords ? vrf.numWords().catch(() => 1) : c.numWords().catch(() => 1),
          vrf?.callbackGasLimit
            ? vrf.callbackGasLimit().catch(() => 300000)
            : c.callbackGasLimit().catch(() => 300000),
          vrf?.subId ? vrf.subId().catch(() => "") : (c.s_subscriptionId?.().catch?.(() => "") ?? ""),
          vrf?.coordinator ? vrf.coordinator().catch(() => "") : "",
        ]);

        params = {
          keyHash: keyHash || "",
          confirmations: Number(conf ?? 3),
          numWords: Number(numWords ?? 1),
          callbackGasLimit: Number(gas ?? 300000),
          coordinator: coord || "",
        };
        subId = sub?.toString?.() || "";
      } catch {}

      let last = {
        requestId: "",
        status: "idle",
        requestedAt: "",
        txHash: "",
        blockNumber: undefined,
        randomWords: [],
      };
      let history = [];

      if (walletAddress) {
        try {
          const pendingReqIdBN = await c.pendingMintRequest(walletAddress).catch(() => 0n);
          const ridStr = pendingReqIdBN?.toString?.() || "0";

          history = await buildVRFHistory(c, walletAddress);

          if (ridStr !== "0") {
            let ts = "";
            try {
              const tsBN = await c.pendingRequestedAt(pendingReqIdBN);
              const tsNum = Number(tsBN?.toString?.() || 0);
              if (tsNum) ts = new Date(tsNum * 1000).toLocaleString();
            } catch {}

            last = {
              requestId: ridStr,
              status: "pending",
              requestedAt: ts,
              txHash: "",
              blockNumber: undefined,
              randomWords: [],
            };
          } else if (history.length) {
            const fulfilled = history.find((h) => h.status === "fulfilled");
            if (fulfilled) {
              last = {
                requestId: fulfilled.requestId,
                status: "fulfilled",
                requestedAt: fulfilled.time,
                txHash: fulfilled.tx || "",
                blockNumber: fulfilled.blockNumber,
                randomWords: fulfilled.randomWords || [],
              };
            }
          }
        } catch (e) {
          console.error("refreshVRFPanel(history)", e);
        }
      }

      setVRFUIData({
        network: net?.name ? `${net.name} (${net.chainId})` : `chainId ${net.chainId}`,
        chainId: Number(net?.chainId),
        userAddress: walletAddress || "",
        subscription: { id: subId },
        params,
        last,
        history,
      });
    } catch (e) {
      console.error("refreshVRFPanel", e);
    }
  }, [walletAddress, buildVRFHistory]);

  /* ====================================================================== */
  /* ============================ EVENT LISTENERS ========================== */
  /* ====================================================================== */

  const attachEventListeners = React.useCallback((addr) => {
    try {
      const contract = contractRef.current || getReadOnlyContract();
      contractRef.current = contract;

      const zeroL = ZERO_ADDRESS.toLowerCase();

      const onTransfer = async (from, to, tokenId, event) => {
        try {
          const fromL = (from || "").toLowerCase();
          const toL = (to || "").toLowerCase();
          const me = addr.toLowerCase();
          const tid = tokenId.toString();

          scheduleFetchStats(900, fetchStats);
          scheduleFetchREWARDS(900, fetchREWARDS);
          refreshVRFPanel();

          if (fromL === me && toL === zeroL) {
            setVRFPending(true);
            setRedeemMsg("Redeem confirmed. Waiting for VRF reveal…");
            setRedeemStartedAt((prev) => prev || Date.now());
            if (event?.blockNumber != null) {
              const bn = Number(event.blockNumber);
              if (Number.isFinite(bn)) {
                setRedeemStartBlock(bn);
              }
            }
          }

          if (toL === me) {
            setTimeout(() => fetchWalletAssets(addr).catch(() => {}), 1200);
          }

          if (fromL === me && toL !== zeroL) {
            setMyNFTs((prev) => prev.filter((x) => x.tokenId !== tid));
          }
        } catch (e) {
          console.error("onTransfer", e);
        }
      };

      contract.on("Transfer", onTransfer);

      const onAccountsChanged = async (accs) => {
        const a = accs?.[0] || "";
        setWalletAddress(a);
        setMyNFTs([]);
        setDynamicTraitsById({});
        setVRFPending(false);
        setIsRedeeming(false);
        setRedeemMsg("");
        setTopFirstId(null);
        setPendingTicketId(null);
        setRedeemStartBlock(null);
        setRedeemStartedAt(null);

        if (a) {
          await fetchStats();
          await fetchREWARDS();
          await fetchWalletAssets(a);
          await fetchLastMinted();
          await refreshVRFPanel();
        }
      };

      const onChainChanged = async () => {
        await fetchStats();
        await fetchREWARDS();
        if (walletAddress) await fetchWalletAssets(walletAddress);
        setDynamicTraitsById({});
        await refreshVRFPanel();
      };

      const injectedProvider = getInjectedProvider();
      injectedProvider?.on?.("accountsChanged", onAccountsChanged);
      injectedProvider?.on?.("chainChanged", onChainChanged);

      const prev = unsubRef.current;
      unsubRef.current = () => {
        try {
          contract.off("Transfer", onTransfer);
        } catch {}
        try {
          injectedProvider?.removeListener?.("accountsChanged", onAccountsChanged);
        } catch {}
        try {
          injectedProvider?.removeListener?.("chainChanged", onChainChanged);
        } catch {}
        prev?.();
      };
    } catch (e) {
      console.error("attachEventListeners", e);
      unsubRef.current = () => {};
    }
  }, [
    fetchStats,
    fetchREWARDS,
    fetchWalletAssets,
    fetchLastMinted,
    refreshVRFPanel,
    scheduleFetchStats,
    scheduleFetchREWARDS,
    walletAddress,
  ]);

  /* ====================================================================== */
  /* ============================ CONNECT WALLET ============================ */
  /* ====================================================================== */

  const connectMetaMask = React.useCallback(async () => {
    const eth = pickInjectedProvider();
    if (!eth) {
      alert("MetaMask extension is not installed.");
      return;
    }

    try {
      setInjectedProvider(eth);

      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0];
      if (!addr) throw new Error("No account returned from wallet.");

      const injectedProvider = new BrowserProvider(eth, "any");
      const net = await injectedProvider.getNetwork().catch(() => null);
      if (Number(net?.chainId) !== 137) await ensurePolygon(eth);

      setWalletAddress(addr);

      contractRef.current = getReadOnlyContract();

      await fetchStats();
      await fetchREWARDS();
      await fetchWalletAssets(addr);
      await fetchLastMinted();
      await refreshVRFPanel();

      attachEventListeners(addr);
    } catch (err) {
      alert("Connection rejected.");
      console.error("connectMetaMask", err);
    }
  }, [
    fetchStats,
    fetchREWARDS,
    fetchWalletAssets,
    fetchLastMinted,
    refreshVRFPanel,
    attachEventListeners,
  ]);

  const connectWalletConnect = React.useCallback(async () => {
    try {
      const { provider, signer } = await connectWithWalletConnect();
      const addr = await signer.getAddress();
      setWalletAddress(addr);
      setInjectedProvider(provider);

      contractRef.current = getReadOnlyContract();

      await fetchStats();
      await fetchREWARDS();
      await fetchWalletAssets(addr);
      await fetchLastMinted();
      await refreshVRFPanel();

      attachEventListeners(addr);
    } catch (err) {
      console.error("connectWalletConnect", err);
      alert(err?.message || "WalletConnect failed");
    }
  }, [
    fetchStats,
    fetchREWARDS,
    fetchWalletAssets,
    fetchLastMinted,
    refreshVRFPanel,
    attachEventListeners,
  ]);

  /* ====================================================================== */
  /* ============================ MINT / REDEEM / CLAIM ===================== */
  /* ====================================================================== */

  const mintTicket = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");

    try {
      await ensurePolygon();

      const contract = await getMainRW();
      const provider = getProviderFor(contract);
      if (!provider) throw new Error("Provider not available");
      const net = await provider.getNetwork();
      if (Number(net?.chainId) !== 137) await ensurePolygon();
      await assertContractDeployed(contract, provider, "MAIN");

      if (typeof contract.paused === "function" && (await contract.paused())) {
        return alert("Mint is paused.");
      }

      try {
        const [maxTickets, mintedTickets] = await Promise.all([
          typeof contract.MAX_TICKETS === "function" ? contract.MAX_TICKETS() : null,
          typeof contract.ticketMinted === "function" ? contract.ticketMinted() : null,
        ]);
        if (
          maxTickets != null &&
          mintedTickets != null &&
          Number(mintedTickets) >= Number(maxTickets)
        ) {
          return alert("All tickets are sold out.");
        }
      } catch {
        // ignore preflight errors
      }

      try {
        const [maxSupply, minted] = await Promise.all([
          typeof contract.MAX_SUPPLY === "function" ? contract.MAX_SUPPLY() : null,
          typeof contract.biggiMinted === "function" ? contract.biggiMinted() : null,
        ]);
        if (
          maxSupply != null &&
          minted != null &&
          Number(minted) >= Number(maxSupply)
        ) {
          return alert("All NFTs are already minted.");
        }
      } catch {
        // ignore preflight errors
      }

      try {
        if (typeof contract.BIGGI === "function") {
          const tokenAddr = await contract.BIGGI();
          if (!tokenAddr || tokenAddr === ZERO_ADDRESS) {
            return alert("BIGGI token is not configured yet.");
          }
        }
      } catch {
        // ignore preflight errors
      }

      const price = await resolveTicketPriceWei();

      const estimateMint =
        contract?.estimateGas?.mintTicket || contract?.mintTicket?.estimateGas;
      let gasLimitOverride = null;
      if (estimateMint) {
        try {
          const est = await estimateMint({ value: price });
          if (est != null) {
            const buf = BigInt(est) + BigInt(est) / 5n;
            gasLimitOverride = buf;
          }
        } catch (e) {
          if (!isMissingRevertDataError(e)) throw e;
          gasLimitOverride = 800000n;
        }
      }
      const tx = await contract.mintTicket({
        value: price,
        ...(gasLimitOverride ? { gasLimit: gasLimitOverride } : {}),
      });
      await tx.wait();

      await fetchWalletAssets(walletAddress);
      await fetchStats();
      await fetchREWARDS();

      alert("Ticket minted.");
      refreshVRFPanel();
    } catch (err) {
      if (isUserRejectedAction(err)) {
        console.info("mintTicket cancelled in wallet");
        return;
      }
      alert("Mint failed: " + prettyError(err));
      console.error("mintTicket", err);
    }
  }, [
    walletAddress,
    resolveTicketPriceWei,
    fetchWalletAssets,
    fetchStats,
    fetchREWARDS,
    prettyError,
    refreshVRFPanel,
  ]);

  const redeemTicket = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");
    if (isRedeeming || VRFPending) return;

    try {
      await ensurePolygon();

      const contract = await getMainRW();
      const provider = getProviderFor(contract);
      if (!provider) throw new Error("Provider not available");
      const net = await provider.getNetwork();
      if (Number(net?.chainId) !== 137) await ensurePolygon();
      await assertContractDeployed(contract, provider, "MAIN");

      if (typeof contract.paused === "function" && (await contract.paused())) {
        return alert("Redeem is paused.");
      }

      setIsRedeeming(true);
      setRedeemMsg("Submitting redeem transaction…");
      let tickets = [];
      try {
        const reader = getCachedReaderInstance("main");
        if (reader && typeof reader.findTicket === "function") {
          tickets = await reader.findTicket(walletAddress);
        }
        if (!Array.isArray(tickets)) {
          tickets = tickets ? [tickets] : [];
        }
        if (!tickets.length && typeof contract.findTicket === "function") {
          tickets = await contract.findTicket(walletAddress);
        }
        if (!Array.isArray(tickets)) {
          tickets = tickets ? [tickets] : [];
        }
        if (!tickets.length) {
          tickets = await findTicketsViaLogs(contract, walletAddress);
        }
      } catch {
        tickets = await findTicketsViaLogs(contract, walletAddress);
      }

      if (!tickets.length) {
        setIsRedeeming(false);
        setRedeemMsg("");
        return alert("You don't have any ticket to redeem.");
      }

      try {
        if (typeof contract.pendingMintRequest === "function") {
          const pendingReq = await contract.pendingMintRequest(walletAddress);
          if (pendingReq && pendingReq.toString?.() !== "0") {
            setIsRedeeming(false);
            setRedeemMsg("");
            setVRFPending(true);
            return alert("You already have a pending VRF request.");
          }
        }
      } catch {
        // ignore pending check failures
      }

      const startBlock = await provider.getBlockNumber();
      setRedeemStartBlock(startBlock);
      setRedeemStartedAt(Date.now());

      const ticketIdBN = (() => {
        const raw = tickets[0];
        if (raw == null) return null;
        if (typeof raw === "bigint") return raw;
        if (typeof raw === "number") return BigInt(raw);
        if (typeof raw === "string") return BigInt(raw);
        if (typeof raw?.toString === "function") return BigInt(raw.toString());
        return null;
      })();
      if (ticketIdBN == null) {
        setIsRedeeming(false);
        setRedeemMsg("");
        return alert("Unable to read your ticket ID.");
      }
      const ticketIdStr = ticketIdBN.toString();

      const redeemFn = contract?.redeemTicketAndMintNFT;
      if (typeof redeemFn !== "function") {
        throw new Error(
          "Redeem function not available on MAIN contract. Check MAIN/ABI configuration.",
        );
      }
      try {
        if (typeof contract.ownerOf === "function") {
          const owner = await contract.ownerOf(ticketIdBN);
          if (
            owner &&
            String(owner).toLowerCase?.() !==
              String(walletAddress).toLowerCase?.()
          ) {
            setIsRedeeming(false);
            setRedeemMsg("");
            return alert("Ticket is not owned by the connected wallet.");
          }
        }
      } catch {
        // ignore owner check failures
      }

      const estimateRedeem =
        contract?.estimateGas?.redeemTicketAndMintNFT || redeemFn?.estimateGas;
      let redeemGasOverride = null;
      try {
        if (estimateRedeem) {
          const est = await estimateRedeem(ticketIdBN);
          if (est != null) {
            const buf = BigInt(est) + BigInt(est) / 4n;
            redeemGasOverride = buf;
          }
        }
      } catch (e) {
        console.debug("redeemTicket estimateGas failed", e);
        if (isMissingRevertDataError(e)) {
          redeemGasOverride = 900000n;
        }
      }
      if (redeemFn?.staticCall) {
        try {
          await redeemFn.staticCall(ticketIdBN);
        } catch (e) {
          if (!isMissingRevertDataError(e)) throw e;
        }
      }

      setRedeemMsg("Please confirm in your wallet...");
      const tx = await redeemFn(ticketIdBN, {
        ...(redeemGasOverride ? { gasLimit: redeemGasOverride } : {}),
      });
      setRedeemMsg("Waiting for transaction confirmation…");
      await tx.wait();

      const pendingTicket = {
        tokenId: ticketIdStr,
        image: "/images/Biggi.png",
        meta: {
          name: `Ticket #${ticketIdStr} — VRF pending`,
          description: "Your NFT is being selected via Chainlink VRF.",
        },
        isTicket: true,
        isPending: true,
        contractAddress: contract?.address || null,
      };

      setPendingTicketId(ticketIdStr);
      setVRFPending(true);
      setRedeemMsg("Redeem confirmed. Waiting for VRF reveal…");
      setTopFirstId(ticketIdStr);

      const [ticketsNow, nftsNow] = await Promise.all([
        fetchMyTickets(walletAddress),
        fetchOwnedNFTsViaTransfers(walletAddress),
      ]);

      const byId = new Map();
      for (const t of ticketsNow) byId.set(t.tokenId, t);
      for (const n of nftsNow) byId.set(n.tokenId, n);

      const baseAssets = Array.from(byId.values());
      setMyNFTs([pendingTicket, ...baseAssets]);

      await fetchREWARDS();
      await fetchStats();
      await refreshVRFPanel();

      setTimeout(() => fetchWalletAssets(walletAddress).catch(() => {}), 2000);
    } catch (err) {
      setIsRedeeming(false);
      setVRFPending(false);
      setRedeemMsg("");
      setPendingTicketId(null);
      setRedeemStartBlock(null);
      setRedeemStartedAt(null);

      if (isUserRejectedAction(err)) {
        setRedeemMsg("Transaction cancelled in wallet.");
        setTimeout(() => setRedeemMsg(""), 2200);
        console.info("redeemTicket cancelled in wallet");
        return;
      }

      alert("Redeem failed: " + prettyError(err));
      console.error("redeemTicket", err);
    }
  }, [
    walletAddress,
    isRedeeming,
    VRFPending,
    fetchMyTickets,
    fetchOwnedNFTsViaTransfers,
    fetchWalletAssets,
    fetchREWARDS,
    fetchStats,
    prettyError,
    findTicketsViaLogs,
    refreshVRFPanel,
  ]);

  const claimREWARDS = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");

    try {
      await ensurePolygon();

      const toBigIntTokenId = (raw) => {
        try {
          if (raw == null) return null;
          if (typeof raw === "bigint") return raw;
          if (typeof raw === "number") {
            if (!Number.isFinite(raw) || raw <= 0) return null;
            return BigInt(Math.trunc(raw));
          }
          if (typeof raw === "string") {
            const s = raw.trim();
            if (!s) return null;
            if (/^\d+$/.test(s)) return BigInt(s);
            if (/^0x[0-9a-f]+$/i.test(s)) return BigInt(s);
            return null;
          }
          if (typeof raw?.toString === "function") {
            return toBigIntTokenId(raw.toString());
          }
        } catch {
          return null;
        }
        return null;
      };

      // Defensive filter: ignore malformed/hash-like IDs that can leak from stale UI state.
      const maxReasonableTokenId = BigInt(
        Math.max((Number(maxSupply) || 550) * 1000, 1_000_000),
      );
      const tokenIds = [];
      const seen = new Set();
      for (const item of Array.isArray(myNFTs) ? myNFTs : []) {
        if (!item || item.isTicket || item.isPending) continue;
        const id = toBigIntTokenId(item.tokenId);
        if (id == null || id <= 0n) continue;
        if (id > maxReasonableTokenId) continue;
        const key = id.toString();
        if (seen.has(key)) continue;
        seen.add(key);
        tokenIds.push(id);
      }

      if (!tokenIds.length) {
        return alert("No eligible NFTs to claim this week.");
      }

      const brl = await getLiquidityContract();
      const toBigIntSafe = (v) => {
        try {
          if (v == null) return null;
          if (typeof v === "bigint") return v;
          if (typeof v === "number") return BigInt(Math.trunc(v));
          if (typeof v === "string") return BigInt(v);
          if (typeof v?.toString === "function") return BigInt(v.toString());
        } catch {
          return null;
        }
        return null;
      };

      // Preflight: don't send tx if contract already says there is nothing claimable.
      let previewUnits = null;
      let previewAmount = null;
      try {
        if (typeof brl?.claimablePreview === "function") {
          const preview = await brl.claimablePreview(tokenIds);
          previewUnits = toBigIntSafe(preview?.[0] ?? preview?.units ?? null);
          previewAmount = toBigIntSafe(preview?.[1] ?? preview?.amount ?? null);
        } else if (typeof brl?.claimStatus === "function") {
          const status = await brl.claimStatus(tokenIds);
          previewAmount = toBigIntSafe(status?.[0] ?? status?.claimable ?? null);
        }
      } catch {
        // ignore preflight call errors; claim tx path will still surface exact revert
      }

      if (previewUnits === 0n || previewAmount === 0n) {
        await refreshClaimable(walletAddress, myNFTs);
        return alert("No eligible NFTs to claim this week.");
      }

      const tx = await brl.claim(tokenIds);
      await tx.wait();

      await fetchREWARDS();
      await fetchStats();
      await refreshClaimable(walletAddress, myNFTs);
      alert("REWARDS claimed.");
    } catch (err) {
      if (isUserRejectedAction(err)) {
        console.info("claimREWARDS cancelled in wallet");
        return;
      }
      alert("Claim failed: " + prettyError(err));
      console.error("claimREWARDS", err);
    }
  }, [
    walletAddress,
    myNFTs,
    maxSupply,
    fetchREWARDS,
    fetchStats,
    prettyError,
    refreshClaimable,
  ]);

  const checkVrfFulfilledByTransfer = React.useCallback(async () => {
    if (!walletAddress) return false;

    const baseContract = contractRef.current || getReadOnlyContract();
    const provider = getProviderFor(baseContract);
    if (!provider) return false;

    let latest = null;
    try {
      latest = await provider.getBlockNumber();
    } catch {
      return false;
    }
    if (!Number.isFinite(latest)) return false;

    let startBlock = Number(redeemStartBlock);
    if (!Number.isFinite(startBlock)) {
      try {
        const burnFilter = baseContract.filters.Transfer(
          walletAddress,
          ZERO_ADDRESS,
          null,
        );
        const burnFrom = Math.max(0, latest - 50_000);
        const burnLogs = await queryLogsBatched(
          baseContract,
          burnFilter,
          burnFrom,
          latest,
        );
        const lastBurn = burnLogs[burnLogs.length - 1];
        if (lastBurn?.blockNumber != null) {
          const bn = Number(lastBurn.blockNumber);
          if (Number.isFinite(bn)) startBlock = bn;
        }
      } catch {
        // ignore burn lookup failures
      }
    }

    if (!Number.isFinite(startBlock)) return false;
    if (startBlock > latest) return false;

    let filter = null;
    try {
      filter = baseContract.filters.Transfer(ZERO_ADDRESS, walletAddress, null);
    } catch {
      return false;
    }

    let logs = [];
    try {
      logs = await queryLogsBatched(baseContract, filter, Math.max(0, startBlock - 3), latest);
    } catch {
      logs = [];
    }

    for (let i = logs.length - 1; i >= 0; i -= 1) {
      const l = logs[i];
      const tid = safeLogArg(l?.args, "tokenId", 2);
      if (!tid) continue;

      let isTicketNow = null;
      if (typeof baseContract?.isTicket === "function") {
        isTicketNow = await baseContract.isTicket(tid).catch(() => null);
      }
      if (isTicketNow === false) return true;

      if (
        isTicketNow == null &&
        typeof baseContract?.tokenURI === "function"
      ) {
        const uri = await getTokenUriCached(baseContract, tid, { force: true }).catch(
          () => null,
        );
        if (uri && !/RANDOM_MINT_TICKET|MINT_TICKET|TICKET/i.test(String(uri))) {
          return true;
        }
      }
    }

    return false;
  }, [walletAddress, redeemStartBlock]);

  /* ====================================================================== */
  /* ============================ VRF: AUTO POLL ============================ */
  /* ====================================================================== */

  React.useEffect(() => {
    if (!VRFPending || !walletAddress) return;

    let cancelled = false;
    let timer = null;
    let pollCount = 0;

    const tick = async () => {
      if (cancelled) return;
      pollCount += 1;
      let stopPolling = false;

      const finalizeVrf = async (message = "VRF fulfilled. NFT minted.") => {
        stopPolling = true;
        setVRFPending(false);
        setRedeemMsg(message);
        setRedeemStartedAt(null);
        setRedeemStartBlock(null);
        setPendingTicketId(null);
        setTopFirstId(null);
        clearWalletCache(walletAddress);
        if (pendingTicketId) clearTokenCaches(pendingTicketId);
        await fetchWalletAssets(walletAddress);
        await fetchStats();
        await fetchREWARDS();
        await fetchLastMinted();
        await refreshVRFPanel();
      };

      try {
        await fetchStats();
        await fetchREWARDS();
        await refreshVRFPanel();

        if (pollCount % 4 === 0) {
          await fetchWalletAssets(walletAddress);
        }
      } catch {}

      try {
        const baseContract = contractRef.current || getReadOnlyContract();
        let c = baseContract;
        let pendingReq = null;
        if (c && typeof c.pendingMintRequest === "function") {
          pendingReq = await c.pendingMintRequest(walletAddress).catch(() => null);
        }
        // If RO provider failed, fall back to injected provider for this read.
        const injectedEth = getInjectedProvider();
        if (pendingReq == null && injectedEth) {
          try {
            const injected = new BrowserProvider(injectedEth, "any");
            c = baseContract?.connect ? baseContract.connect(injected) : baseContract;
            pendingReq = await c.pendingMintRequest(walletAddress).catch(() => null);
          } catch {
            pendingReq = null;
          }
        }
        if (pendingReq != null) {
          const pendingStr = pendingReq?.toString?.() || "0";
          if (pendingStr === "0") {
            await finalizeVrf();
          }
        }
      } catch {}

      // Fallback: if pending request cannot be read, but the ticket has already
      // converted to a revealed NFT, stop the overlay.
      if (!stopPolling && pendingTicketId) {
        try {
          const baseContract = contractRef.current || getReadOnlyContract();
          if (typeof baseContract?.isTicket === "function") {
            const isTicketNow = await baseContract.isTicket(pendingTicketId).catch(() => null);
            if (isTicketNow === false) {
              await finalizeVrf();
            }
          }
          if (!stopPolling && typeof baseContract?.tokenURI === "function") {
            const uri = await getTokenUriCached(baseContract, pendingTicketId, {
              force: true,
            }).catch(() => null);
            if (uri && !/RANDOM_MINT_TICKET|MINT_TICKET|TICKET/i.test(String(uri))) {
              await finalizeVrf();
            }
          }
        } catch {
          // ignore fallback errors
        }
      }

      if (!stopPolling && pollCount % 3 === 0) {
        try {
          const minted = await checkVrfFulfilledByTransfer();
          if (minted) {
            await finalizeVrf();
          }
        } catch {
          // ignore log-scan fallback errors
        }
      }

      const elapsed = redeemStartedAt ? Date.now() - redeemStartedAt : 0;
      let nextDelay = 8000;
      if (elapsed && elapsed < 120000) nextDelay = 4000;
      else if (elapsed && elapsed < 600000) nextDelay = 8000;
      else if (elapsed) nextDelay = 15000;

      if (stopPolling) return;
      timer = setTimeout(tick, nextDelay);
    };

    timer = setTimeout(tick, 2000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    VRFPending,
    walletAddress,
    fetchStats,
    fetchREWARDS,
    fetchWalletAssets,
    fetchLastMinted,
    refreshVRFPanel,
    checkVrfFulfilledByTransfer,
    redeemStartedAt,
    pendingTicketId,
  ]);

  React.useEffect(() => {
    const status = VRFUIData?.last?.status || "";
    const requestId = VRFUIData?.last?.requestId || "";
    if (status !== "fulfilled" || !requestId) return;
    if (lastVRFFulfilledRef.current === String(requestId)) return;
    lastVRFFulfilledRef.current = String(requestId);

    const pendingId = pendingTicketId;
    setVRFPending(false);
    setRedeemMsg("VRF fulfilled. NFT minted.");
    setRedeemStartedAt(null);
    setRedeemStartBlock(null);
    setPendingTicketId(null);
    setTopFirstId(null);
    setMyNFTs((prev) => prev.filter((x) => !x?.isPending));

    if (pendingId) {
      clearTokenCaches(pendingId);
      if (walletAddress) clearWalletCache(walletAddress);
    }

    (async () => {
      try {
        await fetchStats();
        await fetchREWARDS();
        if (walletAddress) await fetchWalletAssets(walletAddress);
        await fetchLastMinted();
        await refreshVRFPanel();
      } catch {}
    })();
  }, [
    VRFUIData?.last?.status,
    VRFUIData?.last?.requestId,
    walletAddress,
    fetchStats,
    fetchREWARDS,
    fetchWalletAssets,
    fetchLastMinted,
    refreshVRFPanel,
  ]);

  /* ====================================================================== */
  /* ============================ INITIAL LOAD ============================== */
  /* ====================================================================== */

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await fetchStats();
        if (cancelled) return;
        await fetchREWARDS();
        if (cancelled) return;
        await fetchLastMinted();
        if (cancelled) return;
        await refreshVRFPanel();
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchStats, fetchREWARDS, fetchLastMinted, refreshVRFPanel]);

  React.useEffect(() => {
    return () => {
      if (statsTimer.current) clearTimeout(statsTimer.current);
      if (REWARDSTimer.current) clearTimeout(REWARDSTimer.current);
      unsubRef.current?.();
    };
  }, []);

  /* ====================================================================== */
  /* ============================ PANEL NAV ================================= */
  /* ====================================================================== */

  const closePanel = React.useCallback(() => {
    setOpenNavIdx(null);
  }, []);

  const goPrevPanel = React.useCallback(() => {
    setOpenNavIdx((prev) => {
      const count = ICONS.length;
      if (!count) return prev ?? null;
      if (prev == null) return count - 1;
      return (prev - 1 + count) % count;
    });
  }, []);

  const goNextPanel = React.useCallback(() => {
    setOpenNavIdx((prev) => {
      const count = ICONS.length;
      if (!count) return prev ?? null;
      if (prev == null) return 0;
      return (prev + 1) % count;
    });
  }, []);

  React.useEffect(() => {
    if (!navOpen) return;

    const onKeyDown = (event) => {
      const target = event.target;
      const tag = target?.tagName?.toLowerCase?.() || "";
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable;
      if (isEditable) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevPanel();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNextPanel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen, closePanel, goPrevPanel, goNextPanel]);

  const adminData = React.useMemo(() => {
    const vrfParams = VRFUIData?.params || {};
    const subscriptionId = VRFUIData?.subscription?.id || "";
    return {
      networkLabel: VRFUIData?.network || "EVM",
      contractAddress: ADDR.COLLECTION_VRF || ADDR.MAIN || "",
      ticketPrice: ticketPrice ?? "",
      REWARDSPool: rewardPool ?? "",
      VRF: {
        keyHash: vrfParams.keyHash || "",
        confirmations: vrfParams.confirmations ?? 3,
        numWords: vrfParams.numWords ?? 1,
        callbackGasLimit: vrfParams.callbackGasLimit ?? 300000,
        coordinator: vrfParams.coordinator || "",
        subscriptionId,
      },
      blocks: DEFAULT_BLOCKS.map((name, idx) => ({
        name,
        minted: blockMintCounts[idx] ?? 0,
        price: blockPrices[idx] ?? 0,
      })),
    };
  }, [VRFUIData, ticketPrice, rewardPool, blockMintCounts, blockPrices]);

  const adminActions = React.useMemo(
    () => ({
      setVRFParams: async (nextVRF) => {
        if (!nextVRF) return;
        await setVRFAllOrPartial(nextVRF);
      },
      refresh: async () => {
        await fetchStats();
        await fetchREWARDS();
        await refreshVRFPanel();
      },
    }),
    [fetchStats, fetchREWARDS, refreshVRFPanel],
  );

  /* ====================================================================== */
  /* ============================ RENDER HELPERS ============================ */
  /* ====================================================================== */

  const renderActivePanel = React.useMemo(() => {
    const alt = navAlt;

    if (!navOpen) return null;

    if (alt === "REWARDS") {
      return (
        <React.Suspense fallback={<Loader label="Loading REWARDS…" />}>
          <REWARDSPanel
            walletAddress={walletAddress}
            items={myNFTs}
            blockNames={DEFAULT_BLOCKS}
            claimable={myClaimable}
            rewardPool={rewardPool}
            onClaim={claimREWARDS}
          />
        </React.Suspense>
      );
    }

    if (alt === "COLLECTION") {
      return (
        <React.Suspense fallback={<Loader label="Loading Collection…" />}>
          <COLLECTIONBlocksGrid
            blockNames={DEFAULT_BLOCKS}
            blockPrices={blockPrices}
            blockMintCounts={blockMintCounts}
          />
        </React.Suspense>
      );
    }

    if (alt === "VRF MINT") {
      return (
        <React.Suspense fallback={<Loader label="Loading VRF Panel…" />}>
          <VRFPanel
            data={VRFUIData}
            walletAddress={walletAddress}
            onRequestRandomness={redeemTicket}
            onRefresh={refreshVRFPanel}
            onOpenExplorer={(hash) => {
              const base = explorerBaseFor(VRFUIData?.chainId);
              if (!base) return;
              window.open(`${base}/tx/${hash}`, "_blank", "noopener,noreferrer");
            }}
          />
        </React.Suspense>
      );
    }

    if (alt === "BIGGI ECOSYSTEM") {
      return (
        <React.Suspense fallback={<Loader label="Loading Ecosystem…" />}>
          <EcosystemPanel />
        </React.Suspense>
      );
    }

    if (alt === "USERS") {
      return (
        <React.Suspense fallback={<Loader label="Loading User panel…" />}>
          <USERPANEL />
        </React.Suspense>
      );
    }

    if (alt === "COMMUNITY CENTER") {
      return (
        <React.Suspense fallback={<Loader label="Loading Community Center…" />}>
          <COMMUNITYCENTERPanel
            walletAddress={walletAddress}
            onConnectMetaMask={connectMetaMask}
            onConnectWalletConnect={connectWalletConnect}
            isAdmin={isAdmin}
            onOpenAdmin={openAdmin}
          />
        </React.Suspense>
      );
    }

    return (
      <div style={{ padding: 16 }}>
        <div style={{ opacity: 0.8 }}>Unknown panel: {alt}</div>
      </div>
    );
  }, [
    navAlt,
    navOpen,
    walletAddress,
    connectMetaMask,
    connectWalletConnect,
    isAdmin,
    openAdmin,
    VRFUIData,
    VRFPending,
    redeemTicket,
    refreshVRFPanel,
  ]);

  /* ====================================================================== */
  /* ================================= UI ================================== */
  /* ====================================================================== */

  return (
    <div className="app-root">
      <MainLayout
        walletAddress={walletAddress}
        connectMetaMask={connectMetaMask}
        connectWalletConnect={connectWalletConnect}
        isRedeeming={isRedeeming}
        VRFPending={VRFPending}
        mintTicket={mintTicket}
        redeemTicket={redeemTicket}
        claimREWARDS={claimREWARDS}
        actionPerforming={isRedeeming || VRFPending}
        actionError={null}
        icons={ICONS}
        setOpenNavIdx={setOpenNavIdx}
        isMobile={isMobile}
        lastMinted={lastMinted}
        biggiMinted={biggiMinted}
        maxSupply={maxSupply}
        ticketMinted={ticketMinted}
        maxTickets={maxTickets}
        ticketPrice={ticketPrice}
        blockMintCounts={blockMintCounts}
        BACKGROUND_NAMES={BACKGROUND_NAMES}
        blockPrices={blockPrices}
        backgroundMintCounts={backgroundMintCounts}
        rewardPool={rewardPool}
        myClaimable={myClaimable}
        myNFTs={myNFTs}
        mintVolumeMatic={mintVolumeMatic}
        epochStartTs={epochStartTs}
        userLastClaimTs={userLastClaimTs}
        fetchChainNowTs={fetchChainNowTs}
        cardsHelpOpen={cardsHelpOpen}
        setCardsHelpOpen={setCardsHelpOpen}
        galleryLoading={galleryLoading}
        galleryNotice={galleryNotice}
        onOpenAdmin={openAdmin}
        isAdmin={isAdmin}
        hideExtras={hideExtras}
        setTopFirstId={setTopFirstId}
        fetchDynamicTraitsFor={fetchDynamicTraitsFor}
        dynamicTraitsById={dynamicTraitsById}
        setZoomImg={setZoomImg}
        fetchWalletAssets={fetchWalletAssets}
        fetchStats={fetchStats}
        fetchREWARDS={fetchREWARDS}
        redeemMsg={redeemMsg}
      />

      {navOpen ? (
        <FullscreenPanel
          open={navOpen}
          title={navAlt}
          onClose={closePanel}
          onPrev={goPrevPanel}
          onNext={goNextPanel}
        >
          {renderActivePanel}
        </FullscreenPanel>
      ) : null}

      {/* ZOOM MODAL */}
      {zoomImg ? (
        <React.Suspense fallback={null}>
          <ZoomModal image={zoomImg} onClose={() => setZoomImg(null)} />
        </React.Suspense>
      ) : null}

      {/* REDEEM OVERLAY REMOVED: status banner is shown on dashboard instead */}

      {/* ADMIN PANEL */}
      {adminOpen ? (
        <React.Suspense fallback={<Loader label="Loading Admin Panel..." />}>
          <AdminPanel
            open={adminOpen}
            onClose={() => setAdminOpen(false)}
            data={adminData}
            actions={adminActions}
          />
        </React.Suspense>
      ) : null}
    </div>
  );
}
