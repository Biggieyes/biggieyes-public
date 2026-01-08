import * as React from "react";
import "./App.css";
import { MODAL_TEXTS } from "./constants/texts";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { ADDR } from "./utils/addresses";

//: utils/contract.js
import {
  ensureAmoy,
  getReadOnlyMain as getReadOnlyContract,
  getMain as getContract,
  getLMRO as getReadOnlyLiquidityContract,
  getLM as getLiquidityContract,
  getFrontendSnapshotLiteActive,
  getReaderRO,
  getROProvider,
  getSignerProvider,
  getPolicyRO,
  getBuybackRO,
  getReserve,
  getNFTRewards,
  // explicit reader factories
  getBiggiMainReaderRO,
  getBiggiRewardsReaderRO,
  getBiggiTokenReaderRO,
  getBiggiTokenomicsReaderRO,
} from "./utils/contract";
import "./styles/biggi-token.skin.css";
import { BiggiToken as ABI_TOKEN } from "./config/abi/index.js";
import RewardsPanel from "./components/panels/RewardsPanel.jsx";
import LiveStats from "./components/LiveStats";
import Gallery from "./components/Gallery";
import FullscreenPanel from "./components/common/FullscreenPanel";
import Loader from "./components/common/Loader";
import Address from "./components/common/Address";
import TopBar from "./components/header/TopBar";
import StatusBanner from "./components/common/StatusBanner";
import ZoomModal from "./components/gallery/ZoomModal";
import InfoPanel from "./components/panels/InfoPanel";
import VRFPanel from "./components/VRF/VRFPanel";
import UserPanel from "./components/user/UserPanel";
import AdminPanel from "./components/admin/AdminPanel";
import * as WC from "./wallet/wc";
import useTransparencyData from "./hooks/useTransparencyData";
import {
  mergeAttrs,
  getCachedPriceAttrs,
  setCachedPriceAttrs,
} from "./utils/metadata";

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

/* ========= LAZY LOADED HEAVY PANELS ========= */
const ProjectInfoModal = React.lazy(
  () => import("./components/INFO/ProjectInfoModal"),
);
const RedeemOverlay = React.lazy(
  () => import("./components/redeem/RedeemOverlay"),
);
const BiggiToken = React.lazy(() => import("./components/TOKEN/BiggiToken"));
const CollectionBlocksGrid = React.lazy(
  () => import("./components/CollectionBlocksGrid"),
);
const CommunityCenterPanel = React.lazy(
  () => import("./components/panels/CommunityCenterPanel"),
); // nový panel

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

const DEPLOY_BLOCK = Number(ADDR?.DEPLOY_BLOCK) || null;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const LOGS_BATCH = 38_000;
const WALLET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const WALLET_CACHE_VERSION = "v1";

function walletCacheKey(addr) {
  return `biggi_wallet_${WALLET_CACHE_VERSION}_${String(addr || "").toLowerCase()}`;
}

function loadWalletCache(addr) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(walletCacheKey(addr));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.ts && Date.now() - Number(parsed.ts) > WALLET_CACHE_TTL)
      return null;
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

async function getSafeDeployBlock(provider) {
  const latest = await provider.getBlockNumber();
  if (typeof DEPLOY_BLOCK === "number" && DEPLOY_BLOCK > 0) {
    return Math.min(DEPLOY_BLOCK, Math.max(0, latest - 1));
  }
  return Math.max(0, latest - 49_999);
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
      if (batch <= 1) throw err;
      batch = Math.max(1, Math.floor(batch / 2));
      continue;
    }
  }
  return out;
}

/* đź”ą MINI ERC20 ABI pro ÄŤtenĂ­ */
const ERC20_MINI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
];

/* ======================================================================== */
/* ============================== IPFS HELPERS ============================= */
/* ======================================================================== */

const IPFS_GATEWAYS = [
  (cid) => `https://ipfs.io/ipfs/${cid}`,
  (cid) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid) => `https://gateway.pinata.cloud/ipfs/${cid}`,
  (cid) => `https://dweb.link/ipfs/${cid}`,
  (cid) => `https://nftstorage.link/ipfs/${cid}`,
  (cid) => `https://cf-ipfs.com/ipfs/${cid}`,
  (cid) => `https://ipfs.filebase.io/ipfs/${cid}`,
  (cid) => `https://gateway.lighthouse.storage/ipfs/${cid}`,
];

async function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const resp = await fetch(url, { signal: ctrl.signal, cache: "no-cache" });
    return resp;
  } finally {
    clearTimeout(t);
  }
}

function httpFromIpfs(uri) {
  if (!uri) return uri;
  if (uri.startsWith("ipfs://")) {
    const cid = uri.replace("ipfs://", "");
    return `https://ipfs.io/ipfs/${cid}`;
  }
  return uri;
}
function normalizeIpfsImage(img) {
  if (!img) return img;
  if (!img.startsWith("ipfs://")) return img;
  const cid = img.replace("ipfs://", "");
  return IPFS_GATEWAYS[0](cid);
}
function resolveImageUrl(imageField, metadataUri) {
  if (!imageField) return null;
  if (imageField.startsWith("ipfs://")) return normalizeIpfsImage(imageField);
  if (/^https?:\/\//i.test(imageField)) return imageField;

  const metaHttp = httpFromIpfs(metadataUri);
  try {
    const u = new URL(metaHttp);
    const clean = String(imageField).replace(/^\.?\//, "");
    u.pathname = u.pathname.replace(/\/[^/]*$/, `/${clean}`);
    return u.toString();
  } catch {
    return imageField;
  }
}

async function readJsonFromURI(uri) {
  try {
    if (!uri) return null;
    if (uri.startsWith("ipfs://")) {
      const cid = uri.replace("ipfs://", "");
      for (const build of IPFS_GATEWAYS) {
        try {
          const resp = await fetchWithTimeout(build(cid), 8000);
          if (resp.ok) return await resp.json();
        } catch {}
      }
      return null;
    } else {
      const resp = await fetchWithTimeout(uri, 8000);
      if (resp.ok) return await resp.json();
      return null;
    }
  } catch {
    return null;
  }
}

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

async function getTokenUriCached(contract, tokenId) {
  const key = String(tokenId);
  if (tokenUriCache.has(key)) return tokenUriCache.get(key);
  const uri = await contract.tokenURI(tokenId);
  cacheSet(tokenUriCache, key, uri, TOKEN_URI_CACHE_LIMIT);
  return uri;
}

async function readJsonFromURICached(uri) {
  if (!uri) return null;
  if (metaCache.has(uri)) return metaCache.get(uri);
  const json = await readJsonFromURI(uri);
  if (json) cacheSet(metaCache, uri, json, META_CACHE_LIMIT);
  return json;
}

function resolveImageUrlCached(imageField, metadataUri) {
  const key = `${metadataUri || ""}|${imageField || ""}`;
  if (imageCache.has(key)) return imageCache.get(key);
  const url = resolveImageUrl(imageField, metadataUri);
  if (url) cacheSet(imageCache, key, url, IMAGE_CACHE_LIMIT);
  return url;
}

/* ======================================================================== */
/* ============================== SMALL UTILS ============================== */
/* ======================================================================== */

async function mapLimit(items, limit, mapper) {
  const ret = [];
  let i = 0;
  const workers = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (i < items.length) {
        const cur = i++;
        ret[cur] = await mapper(items[cur], cur);
      }
    });
  await Promise.all(workers);
  return ret;
}

function canonBackgroundName(val) {
  if (!val) return null;
  const u = String(val).trim().toUpperCase();
  const codeIdx = BACKGROUND_CODES.indexOf(u);
  if (codeIdx !== -1) return BACKGROUND_NAMES[codeIdx];
  const nameIdx = BACKGROUND_NAMES.indexOf(u);
  if (nameIdx !== -1) return BACKGROUND_NAMES[nameIdx];
  return null;
}
function backgroundIndexFromAny(val) {
  if (!val) return null;
  const u = String(val).trim().toUpperCase();
  let idx = BACKGROUND_CODES.indexOf(u);
  if (idx !== -1) return idx + 1;
  idx = BACKGROUND_NAMES.indexOf(u);
  if (idx !== -1) return idx + 1;
  return null;
}

/* ======================================================================== */
/* =========================== DEVICE DETECTION ============================ */
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
/* ================================= UI ==================================== */
/* ======================================================================== */

const ICONS = [
  {
    src: "/images/rewards.png",
    alt: "REWARDS",
    modalText: MODAL_TEXTS.rewards || "",
  },
  {
    src: "/images/collection2.png",
    alt: "COLLECTION",
    modalText: MODAL_TEXTS.collection,
  },
  { src: "/images/vrf-mint.png", alt: "VRF MINT", modalText: MODAL_TEXTS.mint },
  {
    src: "/images/chance-rules.png",
    alt: "BIGGI ECOSYSTEM",
    modalText: MODAL_TEXTS.chance,
  },
  { src: "/images/community-aboutUs.png", alt: "USERS", modalText: "" },
  {
    src: "/images/expansion.png",
    alt: "COMMUNITY CENTER",
    modalText: MODAL_TEXTS.communityCenter || MODAL_TEXTS.expansion,
  },
];

// đź”µ WalletConnect helper
const connectWithWalletConnect = async () => {
  try {
    if (WC && typeof WC.connectWithWalletConnect === "function") {
      return await WC.connectWithWalletConnect();
    }
    throw new Error("WalletConnect is not available in this version");
  } catch (error) {
    console.error("WalletConnect error:", error);
    throw new Error("WalletConnect is not available right now");
  }
};

/* ======================================================================== */
/* ============================ RESERVE ABI =============================== */
/* ======================================================================== */

const ABI_RESERVE = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "bucket",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "waitingBal",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "refillBal",
        type: "uint256",
      },
    ],
    name: "BiggiNotified",
    type: "event",
  },
  /* ... zkráceno pro přehlednost v tomto bloku, ale v reálném souboru měj ABI kompletní jako dřív ... */
];

/* ======================================================================== */
/* ========================= Reader helpers & cache ======================== */
/* ======================================================================== */

// simple cache container (module-scoped)
const readersRef = { current: {} };

/**
 * getCachedReaderInstance(kind)
 * kind: "main" | "rewards" | "tokenomics" | "generic"
 * returns a read-only Contract instance (from utils/contract helpers) or fallback getReaderRO()
 */
function getCachedReaderInstance(kind = "main") {
  try {
    if (kind === "main" && typeof getBiggiMainReaderRO === "function") {
      if (!readersRef.current.BiggiMainReader)
        readersRef.current.BiggiMainReader = getBiggiMainReaderRO();
      return readersRef.current.BiggiMainReader;
    }
    if (kind === "rewards" && typeof getBiggiRewardsReaderRO === "function") {
      if (!readersRef.current.BiggiRewardsReader)
        readersRef.current.BiggiRewardsReader = getBiggiRewardsReaderRO();
      return readersRef.current.BiggiRewardsReader;
    }
    if (kind === "token" && typeof getBiggiTokenReaderRO === "function") {
      if (!readersRef.current.BiggiTokenReader)
        readersRef.current.BiggiTokenReader = getBiggiTokenReaderRO();
      return readersRef.current.BiggiTokenReader;
    }
    if (
      kind === "tokenomics" &&
      typeof getBiggiTokenomicsReaderRO === "function"
    ) {
      if (!readersRef.current.BiggiTokenomicsReader)
        readersRef.current.BiggiTokenomicsReader = getBiggiTokenomicsReaderRO();
      return readersRef.current.BiggiTokenomicsReader;
    }
  } catch (e) {
    // ignore
  }
  if (!readersRef.current.GenericReader)
    readersRef.current.GenericReader = getReaderRO();
  return readersRef.current.GenericReader;
}

/* ======================================================================== */
/* =========================== APPLICATION BODY =========================== */
/* ======================================================================== */

function App() {
  const [openNavIdx, setOpenNavIdx] = React.useState(null);
  const [walletAddress, setWalletAddress] = React.useState("");

  const [ticketPrice, setTicketPrice] = React.useState(null);
  const [biggiMinted, setBiggiMinted] = React.useState(0);
  const [maxSupply] = React.useState(550);
  const [ticketMinted, setTicketMinted] = React.useState(0);
  const [maxTickets] = React.useState(550);
  const [blockMintCounts, setBlockMintCounts] = React.useState(
    new Array(10).fill(0),
  );
  const [blockPrices, setBlockPrices] = React.useState(new Array(10).fill(0));
  const [backgroundMintCounts, setBackgroundMintCounts] = React.useState(
    new Array(10).fill(0),
  );

  const [myNFTs, setMyNFTs] = React.useState([]);
  const [galleryLoading, setGalleryLoading] = React.useState(false);
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
    rewards: {},
    router: {},
    liquidity: {},
    policy: {},
    buyback: {},
  });

  const [vrfUIData, setVrfUIData] = React.useState({
    network: "EVM",
    subscription: { id: "", linkBalance: "", consumers: [] },
    params: {
      keyHash: "",
      confirmations: 3,
      numWords: 1,
      callbackGasLimit: 300000,
    },
    last: {
      requestId: "",
      status: "idle",
      requestedAt: "",
      txHash: "",
      blockNumber: undefined,
      randomWords: [],
    },
    history: [],
  });

  const [vrfPending, setVrfPending] = React.useState(false);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [redeemMsg, setRedeemMsg] = React.useState("");
  const [redeemStartBlock, setRedeemStartBlock] = React.useState(null);
  const [redeemStartedAt, setRedeemStartedAt] = React.useState(null);
  const [pendingTicketId, setPendingTicketId] = React.useState(null);
  const [topFirstId, setTopFirstId] = React.useState(null);

  const [adminOpen, setAdminOpen] = React.useState(false);
  const [adminOwner, setAdminOwner] = React.useState("");
  const [cardsHelpOpen, setCardsHelpOpen] = React.useState(false);

  const statsTimer = React.useRef(null);
  const rewardsTimer = React.useRef(null);
  const contractRef = React.useRef(null);
  const unsubRef = React.useRef(() => {});
  const mintIdxCacheRef = React.useRef(new Map());
  const walletFetchRef = React.useRef({ inFlight: null, addr: null });

  const [epochStartTs, setEpochStartTs] = React.useState(null);
  const [userLastClaimTs, setUserLastClaimTs] = React.useState(null);

  const isMobile = useIsMobile(700);
  const {
    data: transparencyData,
    loading: transparencyLoading,
    refreshTransparency,
  } = useTransparencyData({ enabled: true });

  const formatEthNum = (bnOrNum) => {
    if (bnOrNum == null) return null;
    try {
      if (ethers.BigNumber.isBigNumber(bnOrNum)) {
        return Number(formatEther(bnOrNum));
      }
      return Number(bnOrNum);
    } catch {
      return null;
    }
  };

  const getRO = React.useCallback(() => {
    return contractRef.current || getReadOnlyContract();
  }, []);

  const isAdmin =
    adminOwner &&
    walletAddress &&
    adminOwner.toLowerCase() === walletAddress.toLowerCase();

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
  }, [getReadOnlyContract]);

  React.useEffect(() => {
    if (!isAdmin && adminOpen) setAdminOpen(false);
  }, [isAdmin, adminOpen]);

  const openAdmin = React.useCallback(() => {
    if (!isAdmin) return;
    setAdminOpen(true);
  }, [isAdmin]);

  const onRefreshPolicy = React.useCallback(async () => {
    try {
      const pol = await getPolicyRO();
      if (!pol) return;
      const { ethers } = await import("ethers");

      let splits = {
        reserveBps: null,
        buybackBps: null,
        collRewardsBps: null,
        treasuryBps: null,
      };
      try {
        if (typeof pol.getDistributorSplits === "function") {
          const s = await pol.getDistributorSplits();
          if (s && s.length === 4) {
            splits = {
              reserveBps: Number(s[0]),
              buybackBps: Number(s[1]),
              collRewardsBps: Number(s[2]),
              treasuryBps: Number(s[3]),
            };
          }
        }
      } catch {}
      try {
        const [resB, buyB, collB, treB] = await Promise.all([
          pol.distributorReserveBps?.(),
          pol.distributorBuybackBps?.(),
          pol.distributorCollectionRewardsBps?.(),
          pol.distributorTreasuryBps?.(),
        ]);
        if (resB != null) splits.reserveBps = Number(resB);
        if (buyB != null) splits.buybackBps = Number(buyB);
        if (collB != null) splits.collRewardsBps = Number(collB);
        if (treB != null) splits.treasuryBps = Number(treB);
      } catch {}

      const guards = {
        swapSlippageBps: null,
        lpSlippageBps: null,
        txDeadlineSec: null,
        minBuybackInterval: null,
        maxDailyBuybackNative: null,
      };
      try {
        if (typeof pol.getGuards === "function") {
          const g = await pol.getGuards();
          if (g && g.length >= 5) {
            guards.swapSlippageBps = Number(g[0]);
            guards.lpSlippageBps = Number(g[1]);
            guards.txDeadlineSec = Number(g[2]);
            guards.minBuybackInterval = Number(g[3]);
            guards.maxDailyBuybackNative = formatEther(g[4]);
          }
        }
      } catch {}
      try {
        const [swapSlip, lpSlip, deadline, cooldown, dailyCap] =
          await Promise.all([
            pol.swapSlippageBps?.(),
            pol.lpSlippageBps?.(),
            pol.txDeadlineSec?.(),
            pol.minBuybackInterval?.(),
            pol.maxDailyBuybackNative?.(),
          ]);
        if (swapSlip != null) guards.swapSlippageBps = Number(swapSlip);
        if (lpSlip != null) guards.lpSlippageBps = Number(lpSlip);
        if (deadline != null) guards.txDeadlineSec = Number(deadline);
        if (cooldown != null) guards.minBuybackInterval = Number(cooldown);
        if (dailyCap != null)
          guards.maxDailyBuybackNative = formatEther(dailyCap);
      } catch {}

      let buybacksPaused = null;
      try {
        buybacksPaused = !!(await pol.buybacksPaused());
      } catch {}

      setBiggiData((prev) => ({
        ...prev,
        policy: {
          alphaBuybackBps: splits.buybackBps ?? null,
          betaBurnBps: null,
          gammaStakingBps: splits.collRewardsBps ?? null,
          deltaReserveBps: splits.reserveBps ?? null,
          swapSlippageBps: guards.swapSlippageBps,
          lpSlippageBps: guards.lpSlippageBps,
          txDeadlineSec: guards.txDeadlineSec,
          minBuybackInterval: guards.minBuybackInterval,
          epsilonPriceBandBps: null,
          twapLookbackSec: null,
          maxDailyBuybackNative: guards.maxDailyBuybackNative,
          buybacksPaused,
          refillsPaused: null,
          lpAddsPaused: null,
          endOfCollectionPaused: null,
          operators: [],
        },
      }));
    } catch (e) {
      console.error("onRefreshPolicy", e);
    }
  }, []);
  /* ------------------- WRITE HELPERS for AdminPanel ------------------- */
  const parseEth = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num) || num < 0) throw new Error("Invalid number");
    return parseEther(String(num));
  };

  const writeTx = async (fn, ...args) => {
    const c = await getContract();
    const name = fn.name;
    // používáme estimateGas místo callStatic
    if (name && c.estimateGas?.[name]) {
      await c.estimateGas[name](...args);
    }
    const tx = await fn(...args);
    await tx.wait();
  };

  const writeFirst = async (targets, names, ...args) => {
    await ensureAmoy();
    for (const get of targets) {
      let c;
      try {
        c = await get();
      } catch {}
      if (!c) continue;
      for (const name of names) {
        const fn = c?.[name];
        if (typeof fn === "function") {
          await writeTx(fn.bind(c), ...args);
          return true;
        }
      }
    }
    throw new Error(
      `No matching method found (${names.join(" | ")}) on provided contracts`,
    );
  };

  const setVRFAllOrPartial = async (vrf) => {
    const targets = [getContract];
    const combinedNames = [
      "setVRFParams",
      "setVrfParams",
      "configureVRF",
      "configureVrf",
      "setChainlinkVRF",
    ];
    const argsCombo = [
      [
        vrf.keyHash,
        vrf.confirmations,
        vrf.callbackGasLimit,
        vrf.numWords,
        vrf.coordinator,
        vrf.subscriptionId,
      ],
      [
        vrf.keyHash,
        vrf.confirmations,
        vrf.numWords,
        vrf.callbackGasLimit,
        vrf.coordinator,
        vrf.subscriptionId,
      ],
    ];
    for (const a of argsCombo) {
      try {
        await writeFirst(targets, combinedNames, ...a);
        return;
      } catch {}
    }
    const c = await getContract();
    const trySet = async (name, ...a) => {
      if (typeof c[name] === "function") await writeTx(c[name].bind(c), ...a);
    };
    await ensureAmoy();
    try {
      await trySet("setKeyHash", vrf.keyHash);
    } catch {}
    try {
      await trySet("setRequestConfirmations", vrf.confirmations);
    } catch {}
    try {
      await trySet("setCallbackGasLimit", vrf.callbackGasLimit);
    } catch {}
    try {
      await trySet("setNumWords", vrf.numWords);
    } catch {}
    try {
      await trySet("setCoordinator", vrf.coordinator);
    } catch {}
    try {
      await trySet("setSubscriptionId", vrf.subscriptionId);
    } catch {}
  };

  const getNftIndexForTokenId = React.useCallback(async (contract, tokenId) => {
    const key = String(tokenId);
    const cached = mintIdxCacheRef.current.get(key);
    if (cached) return cached;
    try {
      const latest = await contract.provider.getBlockNumber();
      const from = await getSafeDeployBlock(contract.provider);
      const logs = await queryLogsBatched(
        contract,
        contract.filters.NFTMinted(),
        from,
        latest,
      );
      for (let i = logs.length - 1; i >= 0; i--) {
        const l = logs[i];
        const tid = l.args?.tokenId || l.args?.[1];
        if (tid && tid.toString() === key) {
          const idx = l.args?.nftIndex || l.args?.[2];
          if (idx) {
            const n = Number(idx.toString());
            mintIdxCacheRef.current.set(key, n);
            return n;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  /* -------------------------------------------------------------------- */
  /* Ticket price resolver: tolerantní názvy + fallback na specialized Readers */
  /* -------------------------------------------------------------------- */
  const resolveTicketPriceWei = React.useCallback(async () => {
    const c = contractRef.current || getReadOnlyContract();
    const candidates = [
      "getTicketPrice",
      "ticketPrice",
      "getTicketPriceWei",
      "ticketPriceWei",
    ];
    for (const n of candidates) {
      const f = c[n];
      if (typeof f === "function") {
        try {
          const v = await f();
          if (v != null) return v;
        } catch {}
      }
    }

    // preferované readery: main -> tokenomics -> rewards -> generic
    const readerKinds = ["main", "tokenomics", "rewards", "generic"];
    for (const k of readerKinds) {
      const reader = getCachedReaderInstance(k);
      if (!reader) continue;
      try {
        const snap = await getFrontendSnapshotLiteActive(reader);
        const wei = Array.isArray(snap) ? snap[0] : snap?.ticketPriceWei;
        if (wei != null) return wei;
        if (typeof reader.getTicketPrice === "function") {
          const v = await reader.getTicketPrice();
          if (v != null) return v;
        }
      } catch {}
    }

    throw new Error("Ticket price unavailable");
  }, []);
  /* -------------------------------------------------------------------- */

  const enrichMetaWithPrices = React.useCallback(
    async (_contract, tokenId, meta) => {
      try {
        const cached = getCachedPriceAttrs(tokenId);
        let attrs = Array.isArray(meta?.attributes) ? [...meta.attributes] : [];
        if (cached) attrs = mergeAttrs(attrs, cached);

        try {
          // prefer tokenomics reader first, fallback to main/generic
          const tokenomicsReader =
            getCachedReaderInstance("tokenomics") ||
            getCachedReaderInstance("main") ||
            getCachedReaderInstance("generic");
          const [tp, bp, fp] = await tokenomicsReader.getMintDataByTokenId(
            BigInt(String(tokenId)),
          );
          const ticket = formatEthNum(tp);
          const blockP = formatEthNum(bp);
          const finalP = formatEthNum(fp);

          const pushOrReplace = (trait_type, value) => {
            const i = attrs.findIndex(
              (a) => String(a?.trait_type) === trait_type,
            );
            const v = value != null ? `${value.toFixed(4)} POL` : "\u2014";
            if (i === -1) attrs.push({ trait_type, value: v });
            else attrs[i] = { ...attrs[i], value: v };
          };

          pushOrReplace("Ticket Price", ticket);
          pushOrReplace("Block Price", blockP);
          pushOrReplace("Final Price", finalP);

          setCachedPriceAttrs(tokenId, attrs);
        } catch {}

        return { ...(meta || {}), attributes: attrs };
      } catch {
        return meta;
      }
    },
    [],
  );

  const scheduleFetchStats = React.useCallback((delay = 500) => {
    if (statsTimer.current) return;
    statsTimer.current = setTimeout(async () => {
      statsTimer.current = null;
      try {
        await fetchStats();
      } catch {}
    }, delay);
  }, []);

  const scheduleFetchRewards = React.useCallback((delay = 500) => {
    if (rewardsTimer.current) return;
    rewardsTimer.current = setTimeout(async () => {
      rewardsTimer.current = null;
      try {
        await fetchRewards();
      } catch {}
    }, delay);
  }, []);

  const prettyError = React.useCallback((err) => {
    const name = err?.errorName || "";
    const reason =
      err?.reason || err?.data?.message || err?.message || "Unknown error";
    const map = {
      InsufficientPayment: "Sent value is lower than the ticket price.",
      MaxPerWallet: "Per-wallet limit (10 tickets) exceeded.",
      AllTicketsMinted: "All tickets are sold out.",
      NoTicketToRedeem: "You don't have any ticket to redeem.",
      NotTicket: "Selected token is not a ticket.",
      NotTicketOwner: "You are not the owner of this ticket.",
      AlreadyPending: "You already have a pending VRF draw.",
      PresaleNotActive: "Presale is turned off.",
      Paused: "Contract is paused.",
      NoEligibleTokens: "No eligible NFTs to claim this week.",
      CapExceeded: "Token cap would be exceeded.",
      NotFullyConfigured:
        "Contract metadata is not fully configured (owner must finish batch setup).",
      BiggiTokenNotSet: "BIGGI token is not configured yet.",
    };
    return map[name] || reason;
  }, []);

  const callFirst = React.useCallback(
    async (contract, candidates, args = []) => {
      for (const fn of candidates) {
        const callable = contract[fn];
        if (typeof callable === "function") {
          try {
            const res = await callable(...args);
            return res;
          } catch {}
        }
      }
      return null;
    },
    [],
  );

  const fetchRewards = React.useCallback(async () => {
    try {
      const main = contractRef.current || getReadOnlyContract();

      const volumeCandidates = [
        "totalMintVolume",
        "mintVolume",
        "getMintVolume",
        "totalRevenue",
        "totalRevenueMatic",
        "accMintValue",
        "mintedValue",
      ];
      let volWei = await callFirst(main, volumeCandidates);
      if (volWei) {
        const vol = Number(formatEther(volWei));
        setMintVolumeMatic(vol);
      } else {
        setMintVolumeMatic(null);
      }

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

      if (weeklyWei != null) {
        try {
          const isPositive = ethers.BigNumber.isBigNumber(weeklyWei)
            ? weeklyWei > 0n
            : Number(weeklyWei) > 0;
          if (isPositive) {
            setRewardPool(Number(formatEther(weeklyWei)));
          } else if (volWei) {
            setRewardPool(Number(formatEther(volWei)) * 0.22);
          } else {
            setRewardPool(0);
          }
        } catch {
          if (volWei)
            setRewardPool(Number(formatEther(volWei)) * 0.22);
          else setRewardPool(0);
        }
      } else {
        if (volWei)
          setRewardPool(Number(formatEther(volWei)) * 0.22);
        else setRewardPool(0);
      }

      if (walletAddress) {
        const brl = await getReadOnlyLiquidityContract();

        let tokenIds = myNFTs
          .filter((x) => !x.isTicket)
          .map((x) => BigInt(x.tokenId));

        if (!tokenIds.length) {
          const contract = contractRef.current || getReadOnlyContract();
          const latest = await contract.provider.getBlockNumber();
          const FROM = await getSafeDeployBlock(contract.provider);
          const toFilter = contract.filters.Transfer(null, walletAddress, null);
          const fromFilter = contract.filters.Transfer(
            walletAddress,
            null,
            null,
          );
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
          const me = String(walletAddress || "").toLowerCase();
          for (const l of all) {
            const from = String(
              l.args?.from ?? l.args?.[0] ?? "",
            ).toLowerCase();
            const to = String(l.args?.to ?? l.args?.[1] ?? "").toLowerCase();
            const tid = (l.args?.tokenId ?? l.args?.[2])?.toString?.() || "";
            if (!tid) continue;
            if (to === me) held.add(tid);
            if (from === me) held.delete(tid);
          }
          const arr = Array.from(held);
          const nonTickets = [];
          const cRO = contract;
          for (const tid of arr) {
            try {
              const isT =
                typeof cRO?.isTicket === "function"
                  ? await cRO.isTicket(tid)
                  : false;
              if (!isT) nonTickets.push(BigInt(tid));
            } catch {
              nonTickets.push(BigInt(tid));
            }
          }
          tokenIds = nonTickets;
        }

        if (tokenIds.length) {
          try {
            const [, amount] = await brl.claimablePreview(tokenIds);
            setMyClaimable(Number(formatEther(amount)));
          } catch {
            setMyClaimable(0);
          }
        } else {
          setMyClaimable(0);
        }
      }
    } catch (e) {
      console.error("fetchRewards", e);
    }
  }, [walletAddress, myNFTs, callFirst]);

  /* ---------- Stats přes specialized Readers (preferované) ---------- */
  const fetchStats = React.useCallback(async () => {
    try {
      // try specialized readers in priority
      const readerKinds = ["main", "tokenomics", "rewards", "generic"];
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

        setTicketPrice(Number(formatEther(ticketPriceWei)));
        setTicketMinted(Number(ticketMinted_));
        setBiggiMinted(Number(biggiMinted_));
        setBlockPrices(
          currentBlockPrices.map((x) => Number(formatEther(x))),
        );
        setBlockMintCounts(blocksMinted.map((x) => Number(x)));
        setBackgroundMintCounts(bgsMinted.map((x) => Number(x)));
        return;
      }
    } catch (err) {
      console.error("fetchStats(reader)", err);
      // Fallback below to main contract calls
    }

    // Fallback: query Main directly if Reader is unavailable/mismatched
    try {
      const main = contractRef.current || getReadOnlyContract();
      // ticket price
      const priceCandidates = [
        "getTicketPrice",
        "ticketPrice",
        "getTicketPriceWei",
        "ticketPriceWei",
      ];
      let priceWei = null;
      for (const fn of priceCandidates) {
        const f = main?.[fn];
        if (typeof f === "function") {
          try {
            const v = await f();
            if (v != null) {
              priceWei = v;
              break;
            }
          } catch {}
        }
      }
      if (priceWei != null)
        setTicketPrice(Number(formatEther(priceWei)));

      // minted counters
      try {
        const tm = await main.ticketMinted();
        setTicketMinted(Number(tm?.toString?.() || tm || 0));
      } catch {}
      try {
        const bm = await main.biggiMinted();
        setBiggiMinted(Number(bm?.toString?.() || bm || 0));
      } catch {}

      // block prices and counts
      const prices = [];
      const blkCounts = [];
      const bgCounts = [];
      for (let i = 1; i <= 10; i++) {
        try {
          const p = await main.getCurrentBlockPrice(i);
          prices.push(Number(formatEther(p)));
        } catch {
          prices.push(0);
        }
        try {
          const c = await main.getBlockMintCount(i);
          blkCounts.push(Number(c?.toString?.() || c || 0));
        } catch {
          blkCounts.push(0);
        }
      }
      // background counts are stored in a fixed-size public array -> index 0..9
      for (let j = 0; j < 10; j++) {
        try {
          const c = await main.backgroundMintCounts(j);
          bgCounts.push(Number(c?.toString?.() || c || 0));
        } catch {
          bgCounts.push(0);
        }
      }
      setBlockPrices(prices);
      setBlockMintCounts(blkCounts);
      setBackgroundMintCounts(bgCounts);
    } catch (e2) {
      console.error("fetchStats(fallback main)", e2);
    }
  }, []);
  /* pokračování souboru... */

  const fetchBackgroundMintCounts = React.useCallback(async () => {
    try {
      // prefer rewards reader
      const reader =
        getCachedReaderInstance("rewards") ||
        getCachedReaderInstance("main") ||
        getCachedReaderInstance("generic");
      if (typeof reader.getAllBackgroundMintCounts === "function") {
        const counts = await reader.getAllBackgroundMintCounts();
        setBackgroundMintCounts(counts.map((x) => Number(x)));
        return;
      }
      setBackgroundMintCounts(new Array(10).fill(0));
    } catch (e) {
      console.error("fetchBackgroundMintCounts(reader)", e);
      setBackgroundMintCounts(new Array(10).fill(0));
    }
  }, []);

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
        if (isT) onlyTickets.push(BigInt(tid));
      } catch {}
    }
    return onlyTickets;
  }, []);

  const fetchMyTickets = React.useCallback(
    async (addr) => {
      try {
        const contract = contractRef.current || getReadOnlyContract();

        let ids = [];
        try {
          if (typeof contract.findTicket === "function") {
            ids = await contract.findTicket(addr);
          } else {
            ids = await findTicketsViaLogs(contract, addr);
          }
        } catch {
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
            const j = await readJsonFromURICached(uri);
            if (j) {
              meta = j;
              const imgUrl = j?.image || j?.image_url;
              image = resolveImageUrlCached(imgUrl, uri) || image;
            }
          } catch {}
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
        const cached = loadWalletCache(addr);
        if (cached?.length) return cached;

        const contract = contractRef.current || getReadOnlyContract();
        const lower = String(addr || "").toLowerCase();
        let totalMinted = 0;
        try {
          if (typeof contract.biggiMinted === "function") {
            totalMinted = Number((await contract.biggiMinted()).toString());
          } else if (typeof contract.totalSupply === "function") {
            totalMinted = Number((await contract.totalSupply()).toString());
          }
        } catch {}
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
            } catch {}
            if (isTicket) return null;

            let meta = {};
            let image = "/images/Biggi.png";
            try {
              const uri = await getTokenUriCached(contract, tokenId);
              const j = await readJsonFromURICached(uri);
              const cached = getCachedPriceAttrs(tokenId);
              const base = j || {};
              base.attributes = mergeAttrs(base.attributes, cached);
              meta = await enrichMetaWithPrices(contract, tokenId, base);
              const imgUrl = j?.image || j?.image_url;
              image = resolveImageUrlCached(imgUrl, uri) || image;
            } catch {}

            return { tokenId: String(tokenId), image, meta, isTicket: false };
          } catch {
            return null;
          }
        });

        const filtered = owned.filter(Boolean);
        saveWalletCache(addr, filtered);
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
        const contract = contractRef.current || getReadOnlyContract();
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
          } catch {}
          if (isT) return null;

          let meta = {};
          let image = "/images/Biggi.png";
          try {
            const uri = await getTokenUriCached(contract, tid);
            const j = await readJsonFromURICached(uri);

            const cached = getCachedPriceAttrs(tid);
            const base = j || {};
            base.attributes = mergeAttrs(base.attributes, cached);
            meta = await enrichMetaWithPrices(contract, tid, base);

            const imgUrl = j?.image || j?.image_url;
            image = resolveImageUrlCached(imgUrl, uri) || image;
          } catch {}
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
        } catch {}

        saveWalletCache(addr, resolved);
        return resolved;
      } catch (e) {
        console.error("fetchOwnedNFTsViaTransfers", e);
        return fetchOwnedNFTsViaOwnerScan(addr);
      }
    },
    [enrichMetaWithPrices, fetchOwnedNFTsViaOwnerScan],
  );

  const mergeWithTopFirst = React.useCallback(
    (finalList) => {
      return setMyNFTs((prev) => {
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
      });
    },
    [vrfPending, topFirstId],
  );

  const upsertResolvedNFT = React.useCallback((card) => {
    if (!card || !card.tokenId) return;
    setMyNFTs((prev) => {
      const withoutPending = prev.filter((x) => !x.isPending);
      const withoutSame = withoutPending.filter(
        (x) => x.tokenId !== card.tokenId,
      );
      return [card, ...withoutSame];
    });
    setTopFirstId(card.tokenId);
    setPendingTicketId(null);
  }, []);

  const fetchWalletAssets = React.useCallback(
    async (addr) => {
      if (!addr) return [];
      if (
        walletFetchRef.current.inFlight &&
        walletFetchRef.current.addr === addr
      ) {
        return walletFetchRef.current.inFlight;
      }

      const cached = loadWalletCache(addr);
      if (cached?.length) {
        mergeWithTopFirst(cached);
      }

      const showSpinner = !cached?.length;
      const exec = (async () => {
        if (showSpinner) setGalleryLoading(true);
        try {
          const tickets = await fetchMyTickets(addr);
          const nfts = await fetchOwnedNFTsViaTransfers(addr, tickets.length);
          const byId = new Map();
          for (const t of tickets) byId.set(t.tokenId, t);
          for (const n of nfts) byId.set(n.tokenId, n);
          const final = Array.from(byId.values());
          mergeWithTopFirst(final);
          return final;
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
    [fetchMyTickets, fetchOwnedNFTsViaTransfers, mergeWithTopFirst],
  );

  const resolveLatestMintToUser = React.useCallback(
    async (contract, addr) => {
      if (!addr) return null;
      try {
        const latest = await contract.provider.getBlockNumber();
        const safeFrom = await getSafeDeployBlock(contract.provider);
        const hintFrom = redeemStartBlock
          ? Math.max(redeemStartBlock - 2000, 0)
          : 0;
        const from = Math.max(safeFrom, hintFrom || 0, latest - 120_000);
        const logs = await queryLogsBatched(
          contract,
          contract.filters.Transfer(null, addr, null),
          from,
          latest,
        );
        if (!logs?.length) return null;

        for (let i = logs.length - 1; i >= 0; i -= 1) {
          const tid =
            logs[i].args?.tokenId?.toString?.() ||
            logs[i].args?.[2]?.toString?.();
          if (!tid) continue;
          let isT = false;
          try {
            isT = await contract.isTicket(tid);
          } catch {}
          if (isT) continue;

          const uri = await getTokenUriCached(contract, tid);
          const raw = await readJsonFromURICached(uri);
          const meta = await enrichMetaWithPrices(contract, tid, raw || {});
          const imageUrl = raw?.image || raw?.image_url;
          const image =
            resolveImageUrlCached(imageUrl, uri) || "/images/Biggi.png";
          return {
            tokenId: String(tid),
            image,
            meta: meta || {},
            isTicket: false,
          };
        }
      } catch (e) {
        console.warn("resolveLatestMintToUser failed", e);
      }
      return null;
    },
    [redeemStartBlock, enrichMetaWithPrices],
  );

  const fetchLastMinted = React.useCallback(async () => {
    try {
      const contract = contractRef.current || getReadOnlyContract();
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
      const meta = await readJsonFromURICached(uri);
      let image =
        resolveImageUrlCached(meta?.image || meta?.image_url, uri) ||
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
  }, []);

  // duplicate fetchDynamicTraitsFor removed (keeps the later correct implementation)

  const fetchDynamicTraitsFor = React.useCallback(
    async (nft) => {
      try {
        if (!nft || !nft.tokenId) return;
        const tokenId = String(nft.tokenId);

        if (dynamicTraitsById[tokenId]) return;

        const contract = contractRef.current || getReadOnlyContract();
        contractRef.current = contract;

        const fmt = (n) =>
          typeof n === "number" && !Number.isNaN(n)
            ? `${n.toFixed(4)} POL`
            : "…";

        let meta = nft.meta;
        if (!meta) {
          try {
            const uri = await getTokenUriCached(contract, nft.tokenId);
            meta = await readJsonFromURICached(uri);
          } catch {}
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
          const tokenIdBN = BigInt(tokenId);
          const mintFilter = contract.filters.Transfer(
            ZERO_ADDRESS,
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
        } catch {}

        let mintTicket = null;
        let mintBlock = null;
        let mintFinal = null;

        if (mintBlockNumber != null) {
          try {
            const tokenomicsReader =
              getCachedReaderInstance("tokenomics") ||
              getCachedReaderInstance("main") ||
              getCachedReaderInstance("generic");
            // Try read-from-reader first (block-tagged calls may not be available on readers; fallback to contract)
            if (
              tokenomicsReader &&
              typeof tokenomicsReader.getMintDataByTokenId === "function"
            ) {
              try {
                const [tp, bp, fp] =
                  await tokenomicsReader.getMintDataByTokenId(
                    BigInt(tokenId),
                  );
                mintTicket = formatEthNum(tp);
                mintBlock = formatEthNum(bp);
                if (mintBlock != null) {
                  mintFinal = mintBlock * (1 + (bonusPct || 0) / 100);
                }
              } catch {}
            }
          } catch {}
          // Fallback to contract historical reads if available
          try {
            if (mintTicket == null) {
              const tpPast = await contract.getTicketPrice({
                blockTag: mintBlockNumber,
              });
              mintTicket = Number(formatEther(tpPast));
            }
          } catch {}
          try {
            if (mintBlock == null) {
              const bpPast = await contract.getCurrentBlockPrice(blockId, {
                blockTag: mintBlockNumber,
              });
              mintBlock = Number(formatEther(bpPast));
            }
          } catch {}
          if (mintBlock != null && mintFinal == null) {
            mintFinal = mintBlock * (1 + (bonusPct || 0) / 100);
          }
        }

        setDynamicTraitsById((prev) => ({
          ...prev,
          [tokenId]: {
            mintTicket: fmt(mintTicket),
            mintBlock: fmt(mintBlock),
            mintFinal:
              mintFinal != null
                ? `${mintFinal.toFixed(4)} POL (${bonusPct}% bonus)`
                : "…",
            ticketPrice: undefined,
            blockPrice: undefined,
            finalPrice: undefined,
          },
        }));
      } catch (e) {
        console.error("fetchDynamicTraitsFor error", e);
      }
    },
    [dynamicTraitsById],
  );

  /* ========== VRF helpers (PŘESUNUTO NAHOŘE PRO TDZ) ========== */
  // buildVRFHistory, resolvePendingFromHistoryOrOwnership, checkVrfResolution, refreshVRFPanel
  // (Tyto funkce byly přesunuty nad connectMetaMask aby se předešlo TDZ.)

  const buildVRFHistory = React.useCallback(
    async (c, address) => {
      const latest = await c.provider.getBlockNumber();
      const safeFrom = await getSafeDeployBlock(c.provider);
      const hintFrom = redeemStartBlock
        ? Math.max(redeemStartBlock - 2000, 0)
        : 0;
      const from = Math.max(safeFrom, hintFrom || 0, latest - 120_000);

      const reqLogs = await queryLogsBatched(
        c,
        c.filters.VRFRequested(address),
        from,
        latest,
      );

      const fulfillLogsRaw = await queryLogsBatched(
        c,
        c.filters.VRFFulfillStarted(),
        from,
        latest,
      );
      const fulfillLogs = fulfillLogsRaw.filter((l) => {
        const m = (l.args?.minter || l.args?.[1] || "").toLowerCase?.() || "";
        return m === address.toLowerCase();
      });

      const fulfillByReq = new Map();
      for (const l of fulfillLogs) {
        const rid = (l.args?.requestId || l.args?.[0])?.toString?.() || "";
        const rw = (l.args?.randomWord || l.args?.[2])?.toString?.() || "";
        fulfillByReq.set(rid, {
          requestId: rid,
          tx: l.transactionHash,
          blockNumber: l.blockNumber,
          randomWords: rw ? [rw] : [],
        });
      }

      const rows = [];
      for (const rl of reqLogs) {
        const rid = (rl.args?.requestId || rl.args?.[1])?.toString?.() || "";
        const f = fulfillByReq.get(rid);

        let time = "";
        try {
          const block = await c.provider.getBlock(rl.blockNumber);
          if (block?.timestamp)
            time = new Date(block.timestamp * 1000).toLocaleString();
        } catch {}

        rows.push({
          time,
          requestId: rid,
          status: f ? "fulfilled" : "pending",
          confirmations: undefined,
          words: f?.randomWords?.length || 0,
          tx: f?.tx || "",
          blockNumber: f?.blockNumber || rl.blockNumber,
          randomWords: f?.randomWords || [],
        });
      }

      rows.sort((a, b) => a.blockNumber - b.blockNumber);
      return rows.slice(-25).reverse();
    },
    [redeemStartBlock],
  );

  const resolvePendingFromHistoryOrOwnership = React.useCallback(
    async (c, user) => {
      if (!user) return false;

      try {
        const latest = await c.provider.getBlockNumber();
        const safeFrom = await getSafeDeployBlock(c.provider);
        const hintFrom = redeemStartBlock
          ? Math.max(redeemStartBlock - 2000, 0)
          : 0;
        const from = Math.max(safeFrom, hintFrom || 0);
        const toLogs = await queryLogsBatched(
          c,
          c.filters.Transfer(null, user, null),
          from,
          latest,
        );
        for (const l of toLogs.slice(-40).reverse()) {
          const tid = l.args?.tokenId?.toString?.();
          if (!tid) continue;
          try {
            const isTicket = await c.isTicket(tid);
            if (!isTicket) return true;
          } catch {}
        }

        try {
          const hist = await buildVRFHistory(c, user);
          const fulfilled = hist.find((h) => h.status === "fulfilled");
          if (fulfilled) return true;
        } catch {}

        return false;
      } catch (e) {
        console.error("resolvePendingFromHistoryOrOwnership", e);
        return false;
      }
    },
    [buildVRFHistory, redeemStartBlock],
  );

  const checkVrfResolution = React.useCallback(async () => {
    try {
      if (!walletAddress) return;
      const c = contractRef.current || getReadOnlyContract();

      let rid = null;
      try {
        rid = await c.pendingMintRequest(walletAddress);
      } catch {
        return;
      }
      const isZero =
        rid && typeof rid.isZero === "function"
          ? rid === 0n
          : String(rid || "0") === "0";

      const inferredFulfilled = isZero
        ? true
        : await resolvePendingFromHistoryOrOwnership(c, walletAddress);

      if (inferredFulfilled) {
        const card = await resolveLatestMintToUser(c, walletAddress);
        if (card) {
          upsertResolvedNFT(card);
        }
        await fetchStats();
        await fetchRewards();
        setVrfPending(false);
        setIsRedeeming(false);
        setRedeemMsg("Reveal complete!");
        setRedeemStartBlock(null);
        setRedeemStartedAt(null);
        setTimeout(() => setRedeemMsg(""), 3500);
        if (card) {
          setTimeout(() => {
            fetchWalletAssets(walletAddress).catch(() => {});
          }, 1500);
        } else {
          await fetchWalletAssets(walletAddress);
        }
      }
    } catch {}
  }, [
    walletAddress,
    fetchWalletAssets,
    fetchStats,
    fetchRewards,
    resolvePendingFromHistoryOrOwnership,
    resolveLatestMintToUser,
    upsertResolvedNFT,
  ]);

  const refreshVRFPanel = React.useCallback(async () => {
    try {
      const c = contractRef.current || getReadOnlyContract();
      const net = await c.provider.getNetwork();

      let params = {};
      let subId = "";
      try {
        const [keyHash, conf, numWords, gas, sub] = await Promise.all([
          c.keyHash().catch(() => ""),
          c.requestConfirmations().catch(() => 3),
          c.numWords().catch(() => 1),
          c.callbackGasLimit().catch(() => 300000),
          c.s_subscriptionId?.().catch?.(() => "") ?? "",
        ]);
        params = {
          keyHash: keyHash || "",
          confirmations: Number(conf ?? 3),
          numWords: Number(numWords ?? 1),
          callbackGasLimit: Number(gas ?? 300000),
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
          const pendingReqIdBN = await c
            .pendingMintRequest(walletAddress)
            .catch(() => BigInt(0));
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
            } else {
              last.status = "idle";
            }
          }
        } catch (e) {
          console.error("refreshVRFPanel history", e);
        }
      }

      setVrfUIData({
        network: net?.name
          ? `${net.name} (${net.chainId})`
          : `chainId ${net.chainId}`,
        chainId: Number(net?.chainId),
        userAddress: walletAddress || "",
        subscription: { id: subId, linkBalance: "", consumers: [] },
        params,
        last,
        history,
      });
    } catch (e) {
      console.error("refreshVRFPanel", e);
    }
  }, [walletAddress, buildVRFHistory]);

  /* -------------------------------------------------------------------- */
  /* Zbytek funkcí UI: connect, attach listeners, txs, mint/redeem atd.   */
  /* -------------------------------------------------------------------- */

  const onVRFRequest = React.useCallback(() => {
    redeemTicket();
  }, [redeemTicket]);

  const onVRFRefresh = React.useCallback(async () => {
    await fetchStats();
    await fetchRewards();
    if (walletAddress) await fetchWalletAssets(walletAddress);
    await refreshVRFPanel();
    await checkVrfResolution();
  }, [
    fetchStats,
    fetchRewards,
    fetchWalletAssets,
    walletAddress,
    refreshVRFPanel,
    checkVrfResolution,
  ]);

  const onVRFCancelPending = React.useCallback(() => {
    alert("Cancel pending is not available in this UI.");
  }, []);
  const onVRFUpdateParams = React.useCallback(() => {
    alert("Updating VRF params is owner-only and not wired in this UI.");
  }, []);

  const onVrfOpenExplorer = React.useCallback(async (hashOrId) => {
    try {
      const c = contractRef.current || getReadOnlyContract();
      const net = await c.provider.getNetwork();
      const base = explorerBaseFor(net?.chainId);
      if (!base) return window.open("", "_blank");
      const url = `${base}/tx/${hashOrId}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}
  }, []);

  const fetchChainNowTs = React.useCallback(async () => {
    try {
      const c = contractRef.current || getReadOnlyContract();
      const block = await c.provider.getBlock("latest");
      const ts = Number(block?.timestamp);
      return Number.isFinite(ts) && ts > 0 ? ts : Math.floor(Date.now() / 1000);
    } catch {
      return Math.floor(Date.now() / 1000);
    }
  }, []);

  const fetchCountdownMeta = React.useCallback(async () => {
    try {
      const brl = await getReadOnlyLiquidityContract();

      const epochRaw = await callFirst(brl, [
        "epochStart",
        "weekEpochStart",
        "firstWeekStart",
        "startEpoch",
        "rewardsEpochStart",
      ]);
      const epochNum =
        epochRaw != null
          ? Number(epochRaw.toString ? epochRaw.toString() : epochRaw)
          : null;
      setEpochStartTs(
        Number.isFinite(epochNum) && epochNum > 0 ? epochNum : null,
      );

      let lastRaw = null;
      if (walletAddress) {
        lastRaw = await callFirst(
          brl,
          ["lastClaim", "lastClaimedAt", "userLastClaim", "claimedAt"],
          [walletAddress],
        );
        if (!lastRaw) {
          const next = await callFirst(
            brl,
            ["nextClaimAt", "userNextClaimAt"],
            [walletAddress],
          );
          if (next) {
            const n =
              Number(next.toString ? next.toString() : next) - 7 * 24 * 60 * 60;
            lastRaw = n > 0 ? n : null;
          }
        }
      }
      const lastNum =
        lastRaw != null
          ? Number(lastRaw.toString ? lastRaw.toString() : lastRaw)
          : null;
      setUserLastClaimTs(
        Number.isFinite(lastNum) && lastNum > 0 ? lastNum : null,
      );
    } catch (e) {
      console.error("fetchCountdownMeta", e);
      setEpochStartTs(null);
      setUserLastClaimTs(null);
    }
  }, [walletAddress, callFirst]);

  const fetchLiveStatus = React.useCallback(async () => {
    try {
      const brl = await getReadOnlyLiquidityContract();
      const main = contractRef.current || getReadOnlyContract();
      const provider = brl.provider;
      const net = await provider.getNetwork();

      let tokenSymbol = "BIGGI";
      try {
        const meta = await callFirst(brl, ["tokenMeta"]);
        if (Array.isArray(meta) && meta[1]) tokenSymbol = meta[1];
        else {
          const tAddr = await callFirst(brl, [
            "tokenAddress",
            "biggi",
            "getToken",
            "getBIGGI",
          ]);
          if (tAddr) {
            const erc20 = new Contract(tAddr, ERC20_MINI, provider);
            tokenSymbol =
              (await erc20.symbol().catch(() => tokenSymbol)) || tokenSymbol;
          }
        }
      } catch {}

      const nativeSymbol = "POL";
      const policy =
        (await callFirst(main, ["policy", "policyAddress"])) || "\u2014";
      const treasury =
        (await callFirst(brl, [
          "treasury",
          "treasuryAddress",
          "getTreasury",
        ])) ||
        (await callFirst(main, ["treasury", "treasuryAddress"])) ||
        "\u2014";
      const reserve =
        (await callFirst(main, ["reserve", "reserveAddress"])) || "\u2014";
      const liquidity = brl.address || "\u2014";

      return {
        nativeSymbol,
        tokenSymbol,
        policy,
        treasury,
        reserve,
        liquidity,
        network: net?.name || "unknown",
        chainId: String(net?.chainId ?? ""),
      };
    } catch (e) {
      console.error("fetchLiveStatus", e);
      return {};
    }
  }, [callFirst]);

  React.useEffect(() => {
    if (!vrfPending || !walletAddress) return;
    let cancelled = false;
    let timer = null;
    let pollCount = 0;

    const tick = async () => {
      if (cancelled) return;
      pollCount += 1;
      try {
        await fetchStats();
        await fetchRewards();
        await refreshVRFPanel();
        await checkVrfResolution();
        if (pollCount % 5 === 0) {
          await fetchWalletAssets(walletAddress);
        }
      } catch {}

      const elapsed = redeemStartedAt ? Date.now() - redeemStartedAt : 0;
      let nextDelay = 8000;
      if (elapsed && elapsed < 120000) nextDelay = 4000;
      else if (elapsed && elapsed < 600000) nextDelay = 8000;
      else if (elapsed) nextDelay = 15000;
      timer = setTimeout(tick, nextDelay);
    };

    timer = setTimeout(tick, 2000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    vrfPending,
    walletAddress,
    fetchStats,
    fetchRewards,
    fetchWalletAssets,
    refreshVRFPanel,
    checkVrfResolution,
    redeemStartedAt,
  ]);

  React.useEffect(() => {
    if (walletAddress) fetchWalletAssets(walletAddress);
  }, [walletAddress, fetchWalletAssets]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchStats();
        if (cancelled) return;
        await fetchRewards();
        if (cancelled) return;
        await fetchLastMinted();
        if (cancelled) return;
        await refreshVRFPanel();
        if (cancelled) return;
        await fetchCountdownMeta();
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [
    fetchLastMinted,
    fetchStats,
    fetchRewards,
    refreshVRFPanel,
    fetchCountdownMeta,
  ]);

  React.useEffect(() => {
    return () => {
      if (statsTimer.current) clearTimeout(statsTimer.current);
      if (rewardsTimer.current) clearTimeout(rewardsTimer.current);
      unsubRef.current();
    };
  }, []);

  const navOpen = openNavIdx !== null;
  const navAlt = navOpen ? ICONS[openNavIdx].alt : "";
  const isInfoOpen = navOpen && navAlt === "INFO";

  const hideExtras =
    navOpen &&
    (navAlt === "COLLECTION" ||
      navAlt === "VRF MINT" ||
      navAlt === "BIGGI ECOSYSTEM" ||
      navAlt === "USERS" ||
      navAlt === "COMMUNITY CENTER");

  const goNextPanel = React.useCallback(() => {
    setOpenNavIdx((idx) => {
      if (idx === null) return 0;
      return (idx + 1) % ICONS.length;
    });
  }, []);
  const goPrevPanel = React.useCallback(() => {
    setOpenNavIdx((idx) => {
      if (idx === null) return ICONS.length - 1;
      return (idx - 1 + ICONS.length) % ICONS.length;
    });
  }, []);

  const adminSnapshot = {
    networkLabel: vrfUIData?.network || "EVM",
    contractAddress: contractRef.current?.address,
    paused: null,
    totalSupply: biggiMinted,
    maxSupply,
    ticketPrice,
    rewardsPool: rewardPool,
    treasury: undefined,
    liquiditySink: undefined,
    token: { address: biggiData?.token?.address },
    dex: { router: biggiData?.router?.routerAddress },
    baseURI: undefined,
    vrf: {
      keyHash: vrfUIData?.params?.keyHash,
      confirmations: vrfUIData?.params?.confirmations,
      numWords: vrfUIData?.params?.numWords,
      callbackGasLimit: vrfUIData?.params?.callbackGasLimit,
      coordinator: undefined,
      subscriptionId: vrfUIData?.subscription?.id,
    },
    blocks: BACKGROUND_NAMES.map((name, i) => ({
      name,
      basePrice: blockPrices[i] ?? 0,
      currentPrice: blockPrices[i] ?? 0,
      minted: blockMintCounts[i] ?? 0,
    })),
    owner: walletAddress || "",
  };

  const frontendInfo = {
    app: "BiggiEyes Frontend",
    react: React.version,
    network: vrfUIData?.network || "unknown",
    wallet: walletAddress || "-",
    minted: biggiMinted,
    ticketsMinted: ticketMinted,
    screen: `${typeof window !== "undefined" ? window.innerWidth : 0}x${typeof window !== "undefined" ? window.innerHeight : 0}`,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    lastRefreshAt: new Date().toLocaleString(),
  };

  /* --- specialized reader instances for panels/widgets --- */
  const mainReader = getCachedReaderInstance("main");
  const rewardsReader = getCachedReaderInstance("rewards");
  const tokenomicsReader = getCachedReaderInstance("tokenomics");

  /* ------------------ CONNECT / WALLET / EVENTS ------------------ */

  const connectMetaMask = React.useCallback(async () => {
    const eth = pickInjectedProvider();
    if (!eth) {
      alert("MetaMask extension is not installed.");
      return;
    }
    try {
      if (eth && eth !== window.ethereum) window.ethereum = eth;
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0];
      if (!addr) throw new Error("No account returned from wallet.");

      const injectedProvider = new BrowserProvider(eth, "any");
      const net = await injectedProvider.getNetwork().catch(() => null);
      if (Number(net?.chainId) !== 80002) {
        await ensureAmoy();
      }

      setWalletAddress(addr);

      contractRef.current = getContract();
      await fetchStats();
      await fetchRewards();
      await fetchWalletAssets(addr);
      await fetchLastMinted();
      await refreshVRFPanel();

      attachEventListeners(addr);
      await checkVrfResolution();
    } catch (err) {
      alert("Connection rejected.");
      console.error("connectMetaMask", err);
    }
  }, [
    fetchStats,
    fetchRewards,
    fetchWalletAssets,
    fetchLastMinted,
    refreshVRFPanel,
    attachEventListeners,
    checkVrfResolution,
  ]);

  const connectWalletConnect = React.useCallback(async () => {
    try {
      const { provider, signer } = await connectWithWalletConnect();
      const addr = await signer.getAddress();
      setWalletAddress(addr);

      if (typeof window !== "undefined") window.ethereum = provider;

      contractRef.current = getContract();
      await fetchStats();
      await fetchRewards();
      await fetchWalletAssets(addr);
      await fetchLastMinted();
      await refreshVRFPanel();

      attachEventListeners(addr);
      await checkVrfResolution();
    } catch (err) {
      console.error("connectWalletConnect", err);
      alert(err?.message || "WalletConnect failed");
    }
  }, [
    fetchStats,
    fetchRewards,
    fetchWalletAssets,
    fetchLastMinted,
    refreshVRFPanel,
    attachEventListeners,
    checkVrfResolution,
  ]);

  const attachEventListeners = React.useCallback(
    (addr) => {
      try {
        const contract = contractRef.current || getContract();
        contractRef.current = contract;

        const zeroL = ZERO_ADDRESS.toLowerCase();

        const onTransfer = async (from, to, tokenId) => {
          try {
            const fromL = (from || "").toLowerCase();
            const toL = (to || "").toLowerCase();
            const me = addr.toLowerCase();
            const tid = tokenId.toString();

            scheduleFetchStats(800);
            scheduleFetchRewards(800);
            refreshVRFPanel();

            if (fromL === me && toL === zeroL) {
              setVrfPending(true);
              setRedeemMsg("Redeem confirmed. Waiting for VRF reveal…");
              setRedeemStartedAt((prev) => prev || Date.now());
            }

            if (toL === me) {
              try {
                const uri = await getTokenUriCached(contract, tid);
                const raw = await readJsonFromURICached(uri);
                const meta = await enrichMetaWithPrices(
                  contract,
                  tid,
                  raw || {},
                );
                const imageUrl = raw?.image || raw?.image_url;
                const image =
                  resolveImageUrlCached(imageUrl, uri) || "/images/Biggi.png";

                let isT = false;
                try {
                  isT = await contract.isTicket(tid);
                } catch {}

                if (!isT) {
                  setVrfPending(false);
                  setIsRedeeming(false);
                  setRedeemMsg("Reveal complete!");
                  setRedeemStartBlock(null);
                  setRedeemStartedAt(null);
                  setTimeout(() => setRedeemMsg(""), 3500);

                  setMyNFTs((prev) => {
                    const withoutPending = prev.filter((x) => !x.isPending);
                    const withoutSame = withoutPending.filter(
                      (x) => x.tokenId !== tid,
                    );
                    const card = {
                      tokenId: tid,
                      image,
                      meta: meta || {},
                      isTicket: false,
                    };
                    return [card, ...withoutSame];
                  });
                  setTopFirstId(tid);
                  setPendingTicketId(null);

                  setTimeout(() => {
                    (async () => {
                      try {
                        await fetchWalletAssets(addr);
                      } catch {}
                    })();
                  }, 1500);
                } else {
                  setMyNFTs((prev) => [
                    { tokenId: tid, image, meta: meta || {}, isTicket: true },
                    ...prev,
                  ]);
                }
              } catch {}
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
          setVrfPending(false);
          setIsRedeeming(false);
          setRedeemMsg("");
          setTopFirstId(null);
          setPendingTicketId(null);
          setRedeemStartBlock(null);
          if (a) {
            await fetchStats();
            await fetchRewards();
            await fetchWalletAssets(a);
            await fetchLastMinted();
            await refreshVRFPanel();
          }
        };

        const onChainChanged = async () => {
          await fetchStats();
          await fetchRewards();
          if (walletAddress) await fetchWalletAssets(walletAddress);
          setDynamicTraitsById({});
          await refreshVRFPanel();
        };

        window.ethereum?.on?.("accountsChanged", onAccountsChanged);
        window.ethereum?.on?.("chainChanged", onChainChanged);

        const prev = unsubRef.current;
        unsubRef.current = () => {
          try {
            contract.off("Transfer", onTransfer);
          } catch {}
          try {
            window.ethereum?.removeListener?.(
              "accountsChanged",
              onAccountsChanged,
            );
          } catch {}
          try {
            window.ethereum?.removeListener?.("chainChanged", onChainChanged);
          } catch {}
          prev?.();
        };
      } catch (e) {
        console.error("attachEventListeners", e);
        unsubRef.current = () => {};
      }
    },
    [
      fetchStats,
      fetchWalletAssets,
      fetchLastMinted,
      fetchRewards,
      scheduleFetchStats,
      scheduleFetchRewards,
      walletAddress,
      enrichMetaWithPrices,
      refreshVRFPanel,
    ],
  );

  const preflightRedeemCheck = React.useCallback(async (contract) => {
    try {
      if (typeof contract?.findUnsetIndices === "function") {
        const unset = await contract.findUnsetIndices();
        const missing = Array.from(unset || []);
        if (missing.length > 0) {
          const sample = missing
            .slice(0, 10)
            .map((x) => x.toString())
            .join(", ");
          const e = new Error(
            `NotFullyConfigured: ${missing.length} unset NFT indices (sample: ${sample}).`,
          );
          e.errorName = "NotFullyConfigured";
          throw e;
        }
      } else if (typeof contract?.nftInfo === "function") {
        const picks = [1, 55, 110, 275, 550];
        for (const i of picks) {
          try {
            const info = await contract.nftInfo(i);
            const b = Number(info?.background || info?.[0] || 0);
            const bl = Number(info?.blockIdx || info?.[1] || 0);
            const m = Number(info?.mainId || info?.[2] || 0);
            if (
              !(b >= 1 && b <= 10 && bl >= 1 && bl <= 10 && m >= 1 && m <= 10)
            ) {
              const e = new Error(
                `NotFullyConfigured: index ${i} invalid (background=${b}, blockIdx=${bl}, mainId=${m}).`,
              );
              e.errorName = "NotFullyConfigured";
              throw e;
            }
          } catch {}
        }
      }
    } catch (e) {
      const err = new Error(e?.message || "NotFullyConfigured");
      err.errorName = e?.errorName || "NotFullyConfigured";
      throw err;
    }
  }, []);

  /* ------------------------ MINT TICKET ------------------------ */
  const mintTicket = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");
    try {
      await ensureAmoy();

      const contract = contractRef.current || getContract();
      const net = await contract.provider.getNetwork();
      if (Number(net?.chainId) !== 80002) await ensureAmoy();

      if (typeof contract.paused === "function" && (await contract.paused())) {
        return alert("Mint is paused.");
      }

      // Nově používáme resolver s fallbackem na Readers
      const price = await resolveTicketPriceWei();

      // používáme estimateGas
      await contract.estimateGas.mintTicket({ value: price });
      const tx = await contract.mintTicket({ value: price });
      await tx.wait();

      await fetchWalletAssets(walletAddress);
      await fetchStats();
      await fetchRewards();
      alert("Ticket minted.");
      refreshVRFPanel();
    } catch (err) {
      alert("Mint failed: " + prettyError(err));
      console.error("mintTicket", err);
    }
  }, [
    walletAddress,
    fetchStats,
    fetchRewards,
    fetchWalletAssets,
    prettyError,
    resolveTicketPriceWei,
    refreshVRFPanel,
  ]);

  const redeemTicket = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");
    if (isRedeeming || vrfPending) return;
    try {
      await ensureAmoy();

      const contract = contractRef.current || getContract();
      const net = await contract.provider.getNetwork();
      if (Number(net?.chainId) !== 80002) await ensureAmoy();

      if (typeof contract.paused === "function" && (await contract.paused())) {
        return alert("Redeem is paused.");
      }

      setIsRedeeming(true);
      setRedeemMsg("Submitting redeem transaction…");

      let tickets = [];
      try {
        if (typeof contract.findTicket === "function") {
          tickets = await contract.findTicket(walletAddress);
        } else {
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

      const startBlock = await contract.provider.getBlockNumber();
      setRedeemStartBlock(startBlock);
      setRedeemStartedAt(Date.now());

      const ticketIdBN = tickets[0];
      const ticketIdStr = ticketIdBN.toString();

      await preflightRedeemCheck(contract);

      // používáme estimateGas
      await contract.estimateGas.redeemTicketAndMintNFT(ticketIdBN);
      setRedeemMsg("Please confirm in your wallet…");
      const tx = await contract.redeemTicketAndMintNFT(ticketIdBN);
      setRedeemMsg("Waiting for transaction confirmation…");
      await tx.wait();

      const placeholder = {
        tokenId: ticketIdStr,
        image: "/images/Biggi.png",
        meta: {
          name: `Ticket #${ticketIdStr} — VRF pending`,
          description: "Your NFT is being selected via Chainlink VRF.",
        },
        isTicket: true,
        isPlaceholder: true,
        isPending: true,
      };

      setPendingTicketId(ticketIdStr);
      setVrfPending(true);
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
      setMyNFTs([placeholder, ...baseAssets]);

      await fetchRewards();
      await fetchStats();
      refreshVRFPanel();

      setTimeout(() => {
        (async () => {
          try {
            await fetchWalletAssets(walletAddress);
          } catch {}
        })();
      }, 2000);
    } catch (err) {
      setIsRedeeming(false);
      setVrfPending(false);
      setRedeemMsg("");
      setPendingTicketId(null);
      setRedeemStartBlock(null);
      setRedeemStartedAt(null);
      alert("Redeem failed: " + prettyError(err));
      console.error("redeemTicket", err);
    }
  }, [
    walletAddress,
    fetchRewards,
    fetchStats,
    fetchMyTickets,
    fetchOwnedNFTsViaTransfers,
    prettyError,
    isRedeeming,
    vrfPending,
    preflightRedeemCheck,
    findTicketsViaLogs,
    fetchWalletAssets,
    refreshVRFPanel,
  ]);

  const claimRewards = React.useCallback(async () => {
    if (!walletAddress) return alert("Please connect MetaMask first.");
    try {
      await ensureAmoy();

      let tokenIds = myNFTs
        .filter((x) => !x.isTicket)
        .map((x) => BigInt(x.tokenId));

      if (!tokenIds.length) {
        const contract = contractRef.current || getReadOnlyContract();
        const latest = await contract.provider.getBlockNumber();
        const FROM = await getSafeDeployBlock(contract.provider);
        const toFilter = contract.filters.Transfer(null, walletAddress, null);
        const fromFilter = contract.filters.Transfer(walletAddress, null, null);
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
        const me = String(walletAddress || "").toLowerCase();
        for (const l of all) {
          const from = String(l.args?.from ?? l.args?.[0] ?? "").toLowerCase();
          const to = String(l.args?.to ?? l.args?.[1] ?? "").toLowerCase();
          const tid = (l.args?.tokenId ?? l.args?.[2])?.toString?.() || "";
          if (!tid) continue;
          if (to === me) held.add(tid);
          if (from === me) held.delete(tid);
        }
        const arr = Array.from(held);
        const nonTickets = [];
        for (const tid of arr) {
          try {
            const isT =
              typeof contract?.isTicket === "function"
                ? await contract.isTicket(tid)
                : false;
            if (!isT) nonTickets.push(BigInt(tid));
          } catch {
            nonTickets.push(BigInt(tid));
          }
        }
        tokenIds = nonTickets;
      }

      if (!tokenIds.length) {
        return alert("No eligible NFTs to claim this week.");
      }

      const brl = await getLiquidityContract();
      const tx = await brl.claim(tokenIds);
      await tx.wait();

      await fetchRewards();
      await fetchStats();
      alert("Rewards claimed.");
    } catch (err) {
      alert("Claim failed: " + prettyError(err));
      console.error("claimRewards", err);
    }
  }, [walletAddress, myNFTs, fetchRewards, fetchStats, prettyError]);

  const parseIdsCsv = (csv) =>
    String(csv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        try {
          return BigInt(s);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

  const onRefreshTokenMeta = React.useCallback(async () => {
    try {
      const brl = await getReadOnlyLiquidityContract();

      const [tokenAddr, meta, capLeft] = await Promise.all([
        brl.tokenAddress(),
        brl.tokenMeta(),
        brl.remainingCap().catch(() => null),
      ]);

      // Query BiggiToken contract directly for richer metadata
      const biggi = new Contract(tokenAddr, ABI_TOKEN, brl.provider);

      let totalSupply = null;
      let cap = null;
      let remainingMintable = null;
      let reserveAddr = null;
      let dexRecipientAddr = null;
      let tokenRewardsAddr = null;
      let rewardsOperator = null;
      let distributed = null;
      try {
        const [ts, _cap, rem, res, dex, rwd, oper, dist] = await Promise.all([
          biggi.totalSupply().catch(() => null),
          biggi.cap?.().catch?.(() => null),
          biggi.remainingMintable?.().catch?.(() => null),
          biggi.reserveAddr?.().catch?.(() => null),
          biggi.dexRecipientAddr?.().catch?.(() => null),
          biggi.tokenRewardsAddr?.().catch?.(() => null),
          biggi.rewardsOperator?.().catch?.(() => null),
          biggi.distributed?.().catch?.(() => null),
        ]);
        if (ts) totalSupply = formatEther(ts);
        if (_cap) cap = formatEther(_cap);
        if (rem) remainingMintable = formatEther(rem);
        reserveAddr = res || null;
        dexRecipientAddr = dex || null;
        tokenRewardsAddr = rwd || null;
        rewardsOperator = oper || null;
        distributed =
          typeof dist === "boolean" ? dist : dist != null ? !!dist : null;
      } catch {}

      setBiggiData((prev) => ({
        ...prev,
        token: {
          address: tokenAddr,
          name: meta?.[0],
          symbol: meta?.[1],
          decimals: meta?.[2],
          rewardsRemainingCap:
            capLeft != null ? formatEther(capLeft) : "\u2014",
          totalSupply: totalSupply ?? "\u2014",
          cap: cap ?? null,
          remainingMintable: remainingMintable ?? null,
          reserveAddr,
          dexRecipientAddr,
          tokenRewardsAddr,
          rewardsOperator,
          distributed,
        },
      }));
    } catch (e) {
      console.error("onRefreshTokenMeta", e);
    }
  }, []);

  const onRefreshRewards = React.useCallback(async (tokenIdsCsv = "") => {
    try {
      const brl = await getReadOnlyLiquidityContract();

      const [week, weights, unit, ids] = await Promise.all([
        brl.currentWeek().catch(() => null),
        brl.getBlockWeights().catch(() => null),
        Promise.resolve("1 BIGGI"),
        Promise.resolve(parseIdsCsv(tokenIdsCsv)),
      ]);

      let previewUnits = "\u2014",
        previewAmount = "\u2014";
      try {
        if (ids.length) {
          const [u, a] = await brl.claimablePreview(ids);
          previewUnits = u.toString();
          previewAmount = `${formatEther(a)} BIGGI`;
        }
      } catch {}

      let stat = { tokenIds: [], claimableNow: [], weights: [], blockIdxs: [] };
      try {
        if (ids.length) {
          const [cNow, w, b] = await brl.claimStatus(ids);
          stat = {
            tokenIds: ids.map((x) => x.toString()),
            claimableNow: cNow,
            weights: w,
            blockIdxs: b,
          };
        }
      } catch {}

      setBiggiData((prev) => ({
        ...prev,
        rewards: {
          unitReward: unit,
          currentWeek: week != null ? Number(week) : "\u2014",
          blockWeights: Array.isArray(weights)
            ? Array.from(weights)
            : undefined,
          claimPreview: { units: previewUnits, amount: previewAmount },
          claimStatus: stat,
        },
      }));
    } catch (e) {
      console.error("onRefreshRewards", e);
    }
  }, []);

  const onRefreshRouterInfo = React.useCallback(async () => {
    try {
      const brl = await getReadOnlyLiquidityContract();
      const [ri, path] = await Promise.all([
        brl.routerInfo(),
        brl.getSwapPath(),
      ]);
      setBiggiData((prev) => ({
        ...prev,
        router: {
          routerAddress: ri?.[0],
          wrappedNative: ri?.[1],
          swapPath: Array.isArray(path) ? path : [],
        },
      }));
      try {
        await onRefreshPolicy();
      } catch {}
    } catch (e) {
      console.error("onRefreshRouterInfo", e);
    }
  }, [onRefreshPolicy]);

  const onRefreshLiquidityPreview = React.useCallback(async () => {
    try {
      const brl = await getReadOnlyLiquidityContract();
      const res = await brl.liquidityPreview();
      const f = (v) => (v != null ? formatEther(v) : "0");
      setBiggiData((prev) => ({
        ...prev,
        liquidity: {
          contractEthBalance: f(res?.[0]),
          lpBps: res?.[1]?.toString?.() ?? "\u2014",
          useAmount: f(res?.[2]),
          half: f(res?.[3]),
          otherHalf: f(res?.[4]),
        },
      }));
    } catch (e) {
      console.error("onRefreshLiquidityPreview", e);
    }
  }, []);

  const onRefreshBuybackInfo = React.useCallback(async () => {
    try {
      const b = await getBuybackRO();
      const [
        router,
        wrappedNative,
        policy,
        treasury,
        lastAt,
        slip,
        deadline,
        cooldown,
      ] = await Promise.all([
        b.router().catch(() => null),
        b.wrappedNative().catch(() => null),
        b.policy().catch(() => null),
        b.treasury().catch(() => null),
        b.lastBuybackAt().catch(() => 0),
        b.fallbackSwapSlippageBps?.().catch?.(() => null),
        b.fallbackTxDeadlineSec?.().catch?.(() => null),
        b.fallbackMinIntervalSec?.().catch?.(() => null),
      ]);
      setBiggiData((prev) => ({
        ...prev,
        buyback: {
          router: router || prev?.router?.routerAddress || null,
          wrappedNative: wrappedNative || prev?.router?.wrappedNative || null,
          policy: policy || null,
          treasury: treasury || null,
          lastBuybackAt: Number(lastAt || 0),
          fallbackSlipBps: slip != null ? Number(slip) : null,
          fallbackDeadlineSec: deadline != null ? Number(deadline) : null,
          fallbackCooldownSec: cooldown != null ? Number(cooldown) : null,
        },
      }));
    } catch (e) {
      console.error("onRefreshBuybackInfo", e);
    }
  }, []);

  const fetchReserveInfo = React.useCallback(async () => {
    try {
      const main = contractRef.current || getReadOnlyContract();
      const provider = main.provider;

      // Získání adresy reserve z main contractu
      const reserveAddress = await callFirst(main, [
        "reserve",
        "reserveAddress",
        "getReserve",
      ]);
      if (!reserveAddress || reserveAddress === ZERO_ADDRESS) {
        return {};
      }

      // Načtení ABI_RESERVE
      const reserveContract = new Contract(
        reserveAddress,
        ABI_RESERVE,
        provider,
      );

      // Paralelní načítání všech dat
      const [
        liquidityManager,
        totalMaticReceived,
        waitingBiggi,
        dexRefillBiggi,
        biggiBalance,
        maticBalance,
      ] = await Promise.all([
        reserveContract.liquidityManager().catch(() => "\u2014"),
        reserveContract.totalMaticReceived().catch(() => "0"),
        reserveContract.waitingBiggi().catch(() => "0"),
        reserveContract.dexRefillBiggi().catch(() => "0"),
        reserveContract.biggiBalance().catch(() => "0"),
        reserveContract.maticBalance().catch(() => "0"),
      ]);

      return {
        reserveAddress,
        liquidityManager:
          liquidityManager !== ZERO_ADDRESS ? liquidityManager : "\u2014",
        totalMaticReceived: formatEther(totalMaticReceived),
        waitingBiggi: formatEther(waitingBiggi),
        dexRefillBiggi: formatEther(dexRefillBiggi),
        biggiBalance: formatEther(biggiBalance),
        maticBalance: formatEther(maticBalance),
      };
    } catch (e) {
      console.error("fetchReserveInfo", e);
      return {};
    }
  }, [callFirst]);

  const fetchTreasuryInfo = React.useCallback(async () => {
    try {
      const brl = await getReadOnlyLiquidityContract();
      const provider = brl.provider;

      const treasuryAddr =
        (await callFirst(brl, [
          "treasury",
          "treasuryAddress",
          "getTreasury",
        ])) || null;

      const tokenAddr = await callFirst(brl, [
        "tokenAddress",
        "biggi",
        "getToken",
        "getBIGGI",
      ]);
      let tokenBalance = "\u2014";
      try {
        if (treasuryAddr && tokenAddr) {
          const erc20 = new Contract(tokenAddr, ERC20_MINI, provider);
          const [bal, sym] = await Promise.all([
            erc20.balanceOf(treasuryAddr),
            erc20.symbol().catch(() => "BIGGI"),
          ]);
          tokenBalance = `${formatEther(bal)} ${sym}`;
        }
      } catch {}

      let nativeBalance = "\u2014";
      try {
        if (treasuryAddr) {
          const wei = await provider.getBalance(treasuryAddr);
          nativeBalance = `${formatEther(wei)} POL`;
        }
      } catch {}

      let lastRefillAt = "\u2014";
      try {
        const ts = await callFirst(brl, [
          "lastRefillAt",
          "treasuryLastRefillAt",
        ]);
        if (ts) {
          const n = Number(ts.toString?.() || ts);
          if (Number.isFinite(n) && n > 0)
            lastRefillAt = new Date(n * 1000).toLocaleString();
        }
      } catch {}

      return {
        treasuryAddress: treasuryAddr || "\u2014",
        nativeBalance,
        tokenBalance,
        lastRefillAt,
        notes: "On-chain snapshot (read-only).",
      };
    } catch (e) {
      console.error("fetchTreasuryInfo", e);
      return {};
    }
  }, [callFirst]);

  const explorerBaseFor = (chainId) => {
    switch (Number(chainId)) {
      case 1:
        return "https://etherscan.io";
      case 5:
        return "https://goerli.etherscan.io";
      case 10:
        return "https://optimistic.etherscan.io";
      case 137:
        return "https://polygonscan.com";
      case 80001:
        return "https://mumbai.polygonscan.com";
      case 80002:
        return "https://amoy.polygonscan.com";
      case 8453:
        return "https://basescan.org";
      case 42161:
        return "https://arbiscan.io";
      default:
        return "";
    }
  };

  /* ===================== RENDER UI ===================== */

  return (
    <div className="full-bg">
      <style>{`
        .rewards-table { min-height: 520px !important; }
        .rewards-info table { min-height: 420px; }
        .wallet-row { display:flex; gap:10px; align-items:center; }
        .metamask-btn-top, .wc-btn-top {
          display:inline-flex; align-items:center; border:2px solid #ffe800; background:#08ffe6;
          color:#111; font-weight:800; padding:6px 12px; border-radius:8px; cursor:pointer;
        }
        .wc-btn-top { background:#b0ffea; }
        .fox-icon { width:18px; height:18px; }
      `}</style>

      <header style={{ width: "100%", zIndex: 1000, position: "relative" }}>
        <div className="wallet-row" style={{ padding: 8 }}>
          <button className="metamask-btn-top" onClick={connectMetaMask}>
            <img
              src="/images/metamask-fox.svg"
              alt="MetaMask"
              className="fox-icon"
            />
            {walletAddress ? (
              <span style={{ marginLeft: 8 }}>
                Connected: <Address address={walletAddress} />
              </span>
            ) : (
              <span style={{ marginLeft: 8 }}>Connect MetaMask</span>
            )}
          </button>

          {!walletAddress && (
            <button className="wc-btn-top" onClick={connectWalletConnect}>
              <img
                src="/images/walletconnect.svg"
                alt="WalletConnect"
                className="fox-icon"
              />
              <span style={{ marginLeft: 8 }}>Connect Wallet (WC)</span>
            </button>
          )}
        </div>

        <TopBar
          onMint={mintTicket}
          onRedeem={() => {
            if (!isRedeeming && !vrfPending) redeemTicket();
          }}
          onClaim={claimRewards}
          isRedeeming={isRedeeming}
          vrfPending={vrfPending}
          icons={ICONS}
          onIconClick={(idx) => setOpenNavIdx(idx)}
          isMobile={isMobile}
        />
      </header>

      <main>
        <div
          className="widget-center-wrapper"
          style={isMobile ? { paddingTop: 8 } : undefined}
        >
          <LiveStats
            walletAddress={walletAddress}
            lastImage={lastMinted.image}
            lastNftId={lastMinted.tokenId}
            lastBlockName={lastMinted.blockName}
            lastBackgroundName={lastMinted.backgroundName}
            biggiMinted={biggiMinted}
            maxSupply={maxSupply}
            ticketMinted={ticketMinted}
            maxTickets={maxTickets}
            ticketPrice={ticketPrice}
            blockMintCounts={blockMintCounts}
            blockNames={BACKGROUND_NAMES}
            blockPrices={blockPrices}
            backgroundMintCounts={backgroundMintCounts}
            rewardPool={rewardPool}
            myClaimable={myClaimable}
            items={myNFTs}
            mintVolumeMatic={mintVolumeMatic}
            sharePercent={22}
            epochStart={epochStartTs}
            userLastClaimTs={userLastClaimTs}
            weekSeconds={7 * 24 * 60 * 60}
            fetchChainNowTs={fetchChainNowTs}
            compact={isMobile}
            // pass main reader for richer snapshot reads
            reader={mainReader}
          />
        </div>

        {isAdmin ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              margin: "6px 12px 0",
            }}
          >
            <button
              onClick={openAdmin}
              style={{
                background: "transparent",
                border: "none",
                color: "#cfd2db",
                fontSize: 13,
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
              }}
              aria-label="Open admin menu"
            >
              Admin
            </button>
          </div>
        ) : null}

        {!hideExtras && (
          <div className="gallery-section">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ color: "#fff", margin: 0 }}>My NFTs</h2>
              <button
                type="button"
                onClick={() => setCardsHelpOpen((v) => !v)}
                aria-label="Open NFT card help"
                aria-expanded={cardsHelpOpen ? "true" : "false"}
                title="Info"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "#ffe800",
                  color: "#111",
                  border: "2px solid #00ffd0",
                  fontWeight: 900,
                  cursor: "pointer",
                  lineHeight: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 10px rgba(0,0,0,.35)",
                }}
              >
                i
              </button>
            </div>

            {cardsHelpOpen && (
              <div
                role="region"
                aria-label="NFT card help"
                style={{
                  marginTop: 10,
                  background: "rgba(0,0,0,0.55)",
                  border: "1px solid #00ffd0",
                  borderRadius: 12,
                  padding: 12,
                  boxShadow: "0 6px 18px rgba(0,0,0,.35)",
                }}
              >
                <table
                  className="nft-attributes-table"
                  style={{ width: "100%", fontSize: 14, color: "#e9f2ff" }}
                >
                  <tbody>
                    <tr>
                      <td style={{ opacity: 0.8, padding: "6px 8px" }}>
                        Image zoom
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        Click the thumbnail inside the card - a local zoom opens
                        with the X button.
                      </td>
                    </tr>
                    <tr>
                      <td style={{ opacity: 0.8, padding: "6px 8px" }}>
                        Details
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        The "Details" button expands the metadata: Mint-time
                        values and Attributes.
                      </td>
                    </tr>
                    <tr>
                      <td style={{ opacity: 0.8, padding: "6px 8px" }}>
                        Mint-time values
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        Prefer the values from metadata. When they are missing,
                        they are recalculated from on-chain data as a fallback.
                      </td>
                    </tr>
                    <tr>
                      <td style={{ opacity: 0.8, padding: "6px 8px" }}>
                        Ticket vs. NFT
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        A ticket is an entry pass. After "Redeem" the final NFT
                        is revealed via VRF.
                      </td>
                    </tr>
                    <tr>
                      <td style={{ opacity: 0.8, padding: "6px 8px" }}>
                        VRF pending
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        After the transaction is confirmed you may briefly see a
                        pending state; the NFT appears automatically.
                      </td>
                    </tr>
                    <tr>
                      <td style={{ opacity: 0.8, padding: "6px 8px" }}>
                        IPFS images
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        Images load from IPFS; the first view may take a bit
                        longer.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <StatusBanner
              isRedeeming={isRedeeming}
              vrfPending={vrfPending}
              redeemMsg={redeemMsg}
              onRefresh={async () => {
                await fetchStats();
                await fetchRewards();
                await fetchWalletAssets(walletAddress);
              }}
              compact={isMobile}
            />

            {galleryLoading && <Loader text="Loading..." />}
            {!galleryLoading && myNFTs.length === 0 && (
              <div style={{ color: "#aaa" }}>
                You don't own any NFTs or tickets.
              </div>
            )}

            <Gallery
              address={walletAddress}
              items={myNFTs}
              dynamicTraitsById={dynamicTraitsById}
              onOpenDetails={(nft) => {
                setTopFirstId((prev) => prev || (nft?.tokenId ?? null));
                fetchDynamicTraitsFor(nft);
              }}
              onZoom={(nft) => setZoomImg(nft.image)}
              compact={isMobile}
            />

            {vrfPending && (
              <div
                style={{
                  marginTop: 10,
                  color: "#ffe800",
                  textAlign: "center",
                  fontWeight: 700,
                }}
              >
                VRF pending – your NFT will appear automatically once
                revealed.
              </div>
            )}
          </div>
        )}
      </main>

      <AdminPanel
        open={adminOpen && isAdmin}
        onClose={() => setAdminOpen(false)}
        data={{ ...adminSnapshot, frontend: frontendInfo }}
        actions={{
          refresh: async () => {
            await fetchStats();
            await fetchRewards();
            try {
              await onRefreshRouterInfo();
            } catch {}
            try {
              await onRefreshLiquidityPreview();
            } catch {}
            try {
              await onRefreshPolicy();
            } catch {}
          },
          setPaused: async (flag) => {
            await writeFirst(
              [getContract],
              ["setPaused", "pauseMinting", "setPause"],
              !!flag,
            );
          },
          setBaseURI: async (uri) => {
            if (!uri) throw new Error("BaseURI is empty");
            await writeFirst(
              [getContract],
              ["setBaseURI", "setBaseUri", "setTokenURIBase"],
              uri,
            );
          },
          setTicketPrice: async (priceNum) => {
            await writeFirst(
              [getContract],
              ["setTicketPrice", "updateTicketPrice"],
              parseEth(priceNum),
            );
          },
          setBlockBasePrice: async (idx, priceNum) => {
            const p = parseEth(priceNum);
            await writeFirst(
              [getContract],
              ["setBlockBasePrice", "updateBlockBasePrice", "setBlockPrice"],
              idx,
              p,
            );
          },
          setVRFParams: async (vrf) => {
            await setVRFAllOrPartial(vrf);
          },
          setTreasury: async (addr) => {
            if (!addr) throw new Error("Treasury is empty");
            await writeFirst(
              [getContract, getLiquidityContract],
              ["setTreasury", "updateTreasury", "setTreasuryAddress"],
              addr,
            );
          },
          setLiquiditySink: async (addr) => {
            if (!addr) throw new Error("Liquidity sink is empty");
            await writeFirst(
              [getLiquidityContract, getContract],
              ["setLiquiditySink", "updateLiquiditySink", "setSinkAddress"],
              addr,
            );
          },
          setTokenAddress: async (addr) => {
            if (!addr) throw new Error("Token address is empty");
            await writeFirst(
              [getLiquidityContract, getContract],
              ["setTokenAddress", "setBIGGI", "updateTokenAddress"],
              addr,
            );
          },
          setRouter: async (addr) => {
            if (!addr) throw new Error("Router address is empty");
            await writeFirst(
              [getLiquidityContract, getContract],
              ["setRouter", "setDexRouter", "updateRouter"],
              addr,
            );
          },
          withdrawNative: async () => {
            await writeFirst(
              [getContract, getLiquidityContract],
              ["withdrawNative", "withdrawETH", "withdrawMatic"],
            );
          },
          withdrawToken: async () => {
            await writeFirst(
              [getLiquidityContract, getContract],
              ["withdrawToken", "withdrawBIGGI", "withdrawERC20"],
            );
          },
          sweepDust: async () => {
            await writeFirst(
              [getLiquidityContract, getContract],
              ["sweepDust", "sweep", "sweepTokens"],
            );
          },
          nft_setMainContract: async (addr) => {
            if (!addr) throw new Error("Main contract address is empty");
            await ensureAmoy();
            const c = getNFTRewards();
            const tx = await c.setMainContract(addr);
            await tx.wait();
          },
          nft_setVrfRouter: async (addr) => {
            if (!addr) throw new Error("VRF router address is empty");
            await ensureAmoy();
            const c = getNFTRewards();
            const tx = await c.setVrfRouter(addr);
            await tx.wait();
          },
          nft_createManualReward: async (winner, tokenUri) => {
            if (!winner) throw new Error("Winner address is empty");
            if (!tokenUri) throw new Error("Token URI is empty");
            await ensureAmoy();
            const c = getNFTRewards();
            const preview = await c.callStatic.createManualReward(
              winner,
              tokenUri,
            );
            const tx = await c.createManualReward(winner, tokenUri);
            await tx.wait();
            return {
              eventId:
                preview?.[0]?.toString?.() ?? preview?.eventId?.toString?.(),
              rewardId:
                preview?.[1]?.toString?.() ?? preview?.rewardId?.toString?.(),
            };
          },
          nft_createMysteryEvent: async (tokenUris, eligible) => {
            if (!Array.isArray(tokenUris) || !tokenUris.length)
              throw new Error("Token URIs are required");
            if (!Array.isArray(eligible) || !eligible.length)
              throw new Error("Eligible addresses are required");
            await ensureAmoy();
            const c = getNFTRewards();
            const eventId = await c.callStatic.createMysteryEvent(
              tokenUris,
              eligible,
            );
            const tx = await c.createMysteryEvent(tokenUris, eligible);
            await tx.wait();
            return { eventId: eventId?.toString?.() ?? String(eventId) };
          },
          nft_requestMysteryRandom: async (eventId) => {
            if (eventId == null || eventId === "")
              throw new Error("Event ID is empty");
            await ensureAmoy();
            const c = getNFTRewards();
            const reqId = await c.callStatic.requestMysteryRandom(eventId);
            const tx = await c.requestMysteryRandom(eventId);
            await tx.wait();
            return { requestId: reqId?.toString?.() ?? String(reqId) };
          },
        }}
      />

      <ZoomModal open={!!zoomImg} onClose={() => setZoomImg(null)} />

      <React.Suspense fallback={null}>
        <RedeemOverlay
          open={isRedeeming || vrfPending}
          isRedeeming={isRedeeming}
          vrfPending={vrfPending}
          redeemMsg={redeemMsg}
          pendingTicketId={pendingTicketId}
          onRefresh={() => {
            fetchWalletAssets(walletAddress);
            fetchStats();
            fetchRewards();
          }}
          compact={isMobile}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <ProjectInfoModal
          open={isInfoOpen}
          onClose={() => setOpenNavIdx(null)}
          onPrev={goPrevPanel}
          onNext={goNextPanel}
          initialSection="overview"
          compact={isMobile}
        />
      </React.Suspense>

      <FullscreenPanel
        open={navOpen && !isInfoOpen}
        title={navOpen ? ICONS[openNavIdx].alt : ""}
        onClose={() => setOpenNavIdx(null)}
        onPrev={goPrevPanel}
        onNext={goNextPanel}
        compact={isMobile}
        containerStyle={
          navOpen && !isInfoOpen && ICONS[openNavIdx]?.alt === "VRF MINT"
            ? {
                width: "100vw",
                maxWidth: "100vw",
                height: "100vh",
                maxHeight: "100vh",
                borderRadius: 0,
                border: "none",
                padding: isMobile ? 8 : 12,
                boxShadow: "none",
                background: "transparent",
              }
            : undefined
        }
        contentStyle={
          navOpen && !isInfoOpen && ICONS[openNavIdx]?.alt === "VRF MINT"
            ? {
                padding: 0,
                justifyContent: "stretch",
                alignItems: "stretch",
                maxHeight: "100vh",
              }
            : undefined
        }
      >
        {navOpen &&
          !isInfoOpen &&
          (ICONS[openNavIdx].alt === "REWARDS" ? (
            <RewardsPanel
              compact={isMobile}
              walletAddress={walletAddress}
              provider={(function () {
                try {
                  if (
                    walletAddress &&
                    typeof window !== "undefined" &&
                    window.ethereum
                  ) {
                    return getSignerProvider();
                  }
                } catch {}
                try {
                  return getROProvider();
                } catch {
                  return null;
                }
              })()}
            />
          ) : ICONS[openNavIdx].alt === "COLLECTION" ? (
            <React.Suspense fallback={<div>Loading Collection...</div>}>
              <CollectionBlocksGrid
                blockNames={BACKGROUND_NAMES}
                blockPrices={blockPrices}
                blockMintCounts={blockMintCounts}
                compact={isMobile}
              />
            </React.Suspense>
          ) : ICONS[openNavIdx].alt === "VRF MINT" ? (
            <VRFPanel
              data={vrfUIData}
              onRequestRandomness={onVRFRequest}
              onRefresh={onVRFRefresh}
              onCancelPending={onVRFCancelPending}
              onUpdateParams={onVRFUpdateParams}
              onOpenExplorer={onVrfOpenExplorer}
              compact={isMobile}
            />
          ) : ICONS[openNavIdx].alt === "BIGGI ECOSYSTEM" ? (
            <React.Suspense fallback={<div>Loading Token Info...</div>}>
              <BiggiToken
                data={biggiData}
                onRefreshTokenMeta={onRefreshTokenMeta}
                onRefreshRewards={onRefreshRewards}
                onPreviewClaim={onRefreshRewards}
                onCheckClaimStatus={onRefreshRewards}
                onRefreshRouterInfo={onRefreshRouterInfo}
                onRefreshLiquidityPreview={onRefreshLiquidityPreview}
                onRefreshBuybackInfo={onRefreshBuybackInfo}
                onRefreshPolicy={onRefreshPolicy}
                fetchTreasuryInfo={fetchTreasuryInfo}
                fetchReserveInfo={fetchReserveInfo}
                compact={isMobile}
                onReserveTopUp={async () => {
                  try {
                    await writeFirst([getReserve], ["requestTopUpToLM"]);
                  } catch (e) {
                    console.error("onReserveTopUp", e);
                    alert(e?.reason || e?.message || "Reserve top-up failed");
                  }
                }}
                onBootstrapLiquidity={async ({ tokenAmountWei, nativeEth }) => {
                  const amountBN = BigInt(
                    String(tokenAmountWei || "0"),
                  );
                  const overrides = {
                    value: parseEther(String(nativeEth || "0")),
                  };
                  await writeFirst(
                    [getLiquidityContract],
                    ["bootstrapLiquidity"],
                    amountBN,
                    overrides,
                  );
                  await onRefreshLiquidityPreview();
                }}
                onAddLiquidityFromBalance={async () => {
                  await writeFirst(
                    [getLiquidityContract],
                    ["addLiquidityFromBalance"],
                  );
                  await onRefreshLiquidityPreview();
                }}
                onBuybackAndSendToTreasury={async ({
                  minOutWei,
                  nativeEth,
                }) => {
                  const minOutBN = BigInt(
                    String(minOutWei || "0"),
                  );
                  const overrides = {
                    value: parseEther(String(nativeEth || "0")),
                  };
                  await writeFirst(
                    [getLiquidityContract],
                    [
                      "buyBiggiAndSendToTreasury",
                      "buybackAllToTreasury",
                      "buybackToTreasury",
                    ],
                    minOutBN,
                    overrides,
                  );
                  await onRefreshRouterInfo();
                  await onRefreshBuybackInfo();
                }}
                // pass tokenomics reader for enriched tokenomics reads
                reader={tokenomicsReader}
              />
            </React.Suspense>
          ) : ICONS[openNavIdx].alt === "USERS" ? (
            <UserPanel
              address={walletAddress}
              onConnect={connectMetaMask}
              ticketPrice={ticketPrice}
              minted={biggiMinted}
              maxSupply={maxSupply}
              ticketsLeft={Math.max(0, (maxTickets ?? 0) - (ticketMinted ?? 0))}
              claimable={myClaimable}
              rewardPool={rewardPool}
              mintVolumeMatic={mintVolumeMatic}
              sharePercent={
                biggiData?.policy?.gammaStakingBps != null
                  ? Number(biggiData.policy.gammaStakingBps) / 100
                  : null
              }
              tokenPrice={biggiData?.token?.price ?? null}
              liquidityPool={
                biggiData?.liquidity?.contractEthBalance != null
                  ? `${biggiData.liquidity.contractEthBalance} POL`
                  : null
              }
              items={myNFTs}
              onMint={mintTicket}
              onClaim={claimRewards}
              compact={isMobile}
            />
          ) : ICONS[openNavIdx].alt === "COMMUNITY CENTER" ? (
            <React.Suspense fallback={<div>Loading Community Center...</div>}>
              <CommunityCenterPanel
                compact={isMobile}
                walletAddress={walletAddress}
                onConnectMetaMask={connectMetaMask}
                onConnectWalletConnect={connectWalletConnect}
              />
            </React.Suspense>
          ) : (
            <InfoPanel
              compact={isMobile}
              data={transparencyData}
              loading={transparencyLoading}
              onRefresh={refreshTransparency}
            >
              {ICONS[openNavIdx].modalText}
            </InfoPanel>
          ))}
      </FullscreenPanel>
    </div>
  );
}

export default App;

