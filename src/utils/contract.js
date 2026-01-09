// Správné aliasy pro používané ABI (ponecháme pouze aliasy, importy jsou již výše)
const ABI_NFTREWARDS = BiggiNFTREWARDS;
const ABI_DRIPLM = BiggiDRIPLM;
const ABI_LIQUIDITY_VAULT = LiquidityVault;
const ABI_MULTI_COLLECTION_DISTRIBUTOR = BiggiMultiCOLLECTIONDistributor;
// src/utils/contract.js
// Ethers v5 compatible helpers and contract factories
import {
  JsonRpcProvider,
  FallbackProvider,
  Web3Provider,
} from "@ethersproject/providers";
// import * as ethers from "ethers";
import { Contract } from "ethers";
import { parseEther, formatEther } from "ethers/lib.esm/utils.js";
import { ADDR } from "./addresses.js";
import {
  AMOY,
  PUBLIC_AMOY_RPCS,
  getRpcUrls,
  setPreferredRpc,
} from "./rpcConfig.js";
import {
  BiggiBUYBACKAgent,
  BiggiCOLLECTIONReader,
  BiggiCOLLECTIONREWARDS,
  BiggiDistributor,
  BiggiDRIPDistributor,
  BiggiDRIPKeeper,
  BiggiDRIPLM,
  BiggiLiquidityManager,
  BiggiNFTREWARDS,
  BiggiPOLICY,
  BiggiReserve,
  // BiggiReserveV4, // odstraněno, soubor neexistuje
  BiggiREWARDSReader,
  BiggiVRFReader,
  // BiggiBUYBACKReader, // removed unused
  // BiggiDRIPReader, // removed unused
  BiggiLiquidityVaultReader,
  BiggiMultiCOLLECTIONDistributor,
  BiggiToken,
  BiggiTokenomicReader,
  BiggiTokenREWARDS,
  BiggiTreasury,
  BiggiUpkeeperProxy,
  LiquidityAutomation,
  LiquidityVault,
  UniswapV2Factory,
  UniswapV2Pair,
  UniswapV2Router02,
  BiggiMain,
  BiggiMain2,
} from "../config/abi/index.js";

// Map missing ABIs to available ones or fallback
const ABI_BiggiMainReader = BiggiMain; // fallback, real BiggiMainReader.json missing
const ABI_BiggiMain2 = BiggiMain2;
const ABI_NFTREWARDSReader = BiggiNFTREWARDS; // fallback
const ABI_BiggiREWARDSReader = BiggiREWARDSReader;
const ABI_BiggiTokenomicsReader = BiggiTokenomicReader;
const ABI_ReserveReader = BiggiReserve;
const ABI_LiquidityManagerReader = BiggiLiquidityManager;
const ABI_BiggiTokenReader = BiggiToken;
const ABI_COLLECTIONREWARDSReader = BiggiCOLLECTIONREWARDS;
// Nové aliasy pro nové readery
export const ABI_REWARDS_READER = BiggiREWARDSReader;
export const ABI_VRF_READER = BiggiVRFReader;
export const ABI_LIQUIDITY_VAULT_READER = BiggiLiquidityVaultReader;

// Factory for MultiCOLLECTIONDistributor (read-only)
export const getMultiCOLLECTIONDistributorRO = (provider) => {
  const addr =
    ADDR.MULTI_COLLECTION_DISTRIBUTOR_READER || ADDR.MULTI_COLLECTION_DISTRIBUTOR;
  return _mkRO(addr, ABI_MULTI_COLLECTION_DISTRIBUTOR, provider);
};
// Factory for MultiCOLLECTIONDistributor (read-write)
export const getMultiCOLLECTIONDistributor = () =>
  _mkRW(ADDR.MULTI_COLLECTION_DISTRIBUTOR, ABI_MULTI_COLLECTION_DISTRIBUTOR);
const ABI_READER = BiggiCOLLECTIONReader;
const ABI_COLLECTION_VRF = BiggiCOLLECTIONReader;
const ABI_COLLECTION_PUBLIC = BiggiCOLLECTIONReader;
const ABI_VRF = BiggiCOLLECTIONReader;
const ABI_TOKEN = BiggiToken;
const ABI_DISTRIBUTOR = BiggiDistributor;
const ABI_RESERVE = BiggiReserve;
const ABI_TREASURY = BiggiTreasury;
const ABI_BUYBACK = BiggiBUYBACKAgent;
const ABI_POLICY = BiggiPOLICY;
const ABI_LIQUIDITY_AUTOMATION = LiquidityAutomation;
const ABI_TOKEN_REWARDS = BiggiTokenREWARDS;
const ABI_COLLECTION_REWARDS = BiggiCOLLECTIONREWARDS;
const ABI_DRIP_DISTRIBUTOR = BiggiDRIPDistributor;
const ABI_DRIP_KEEPER = BiggiDRIPKeeper;
const ABI_FACTORY = UniswapV2Factory;
const ABI_ROUTER = UniswapV2Router02;
const ABI_PAIR = UniswapV2Pair;
const ABI_LM = BiggiLiquidityManager;
const ABI_UPKEEP = BiggiUpkeeperProxy;


const LOCAL_STORAGE_RPC_SYNC_KEY = "biggi_amoy_rpc_synced_v1";

function _sameAddr(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

const MAIN_ADDR_ACTIVE = ADDR.COLLECTION_VRF || ADDR.MAIN;
const ABI_MAIN = BiggiMain;
const ABI_MAIN2 = BiggiMain2;
const ABI_MAIN_ACTIVE =
  _sameAddr(MAIN_ADDR_ACTIVE, ADDR.MAIN2) ||
  _sameAddr(MAIN_ADDR_ACTIVE, ADDR.COLLECTION_PUBLIC)
    ? ABI_MAIN2
    : ABI_MAIN;

function _env(key) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env)
      return import.meta.env[key];
  } catch {
    // ignore env lookup errors
  }
  try {
    if (typeof process !== "undefined" && process.env) return process.env[key];
  } catch {
    // ignore process env lookup errors
  }
  return undefined;
}

export function _secureRandomInt(maxExclusive) {
  if (maxExclusive <= 1) return 0;
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.getRandomValues === "function"
    ) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] % maxExclusive;
    }
  } catch {
    // ignore crypto unavailability
  }
  return Math.floor(Math.random() * maxExclusive);
}

export { ADDR, AMOY, PUBLIC_AMOY_RPCS };

let _roProvider = undefined;

function _applyPollingInterval(provider) {
  const pollMs = Number(_env("VITE_RPC_POLL_INTERVAL_MS") || 8000);
  if (provider && Number.isFinite(pollMs) && pollMs > 0) {
    try {
      provider.pollingInterval = pollMs;
    } catch {
      // ignore if provider does not allow setting
    }
  }
  return provider;
}

export function getPrimaryRpcUrl() {
  const urls = getRpcUrls();
  return urls[0] || "";
}

function _mkRpcProvider(url) {
  // Plain provider is more tolerant of flaky RPCs than batch in some gateways.
  return new JsonRpcProvider(
    url,
    AMOY.chainId
  );
}

export function getROProvider() {
  // Always rebuild provider to avoid sticky stale/blocked endpoints.
  _roProvider = undefined;

  const urls = getRpcUrls();
  if (!urls.length) {
    throw new Error(
      "No RPC endpoints configured for Polygon Amoy. Set VITE_JSON_RPC_URL or VITE_AMOY_RPC_URL.",
    );
  }

  // Prefer injected if allowed and on the right chain
  const preferInjectedEnv = _env("VITE_PREFER_INJECTED") === "true"; // default false
  const ethereum = typeof window !== "undefined" ? window.ethereum : null;
  const hasSelectedAddress = Boolean(ethereum?.selectedAddress);
  const isConnected = Boolean(
    hasSelectedAddress ||
      (typeof ethereum?.isConnected === "function" && ethereum.isConnected()),
  );
  const preferInjected = preferInjectedEnv && isConnected;
  const forceRpc = _env("VITE_FORCE_RPC") === "1";

  const injectedChainId = (() => {
    try {
      if (typeof window === "undefined" || !window.ethereum) return null;
      const raw = window.ethereum.chainId ?? window.ethereum.networkVersion;
      if (raw == null) return null;
      if (typeof raw === "number") return raw;
      if (typeof raw === "string") {
        const parsed = raw.startsWith("0x")
          ? Number.parseInt(raw, 16)
          : Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      }
    } catch {
      // ignore chainId parsing errors
    }
    return null;
  })();
  const allowInjected = injectedChainId === AMOY.chainId;

  if (
    !forceRpc &&
    preferInjected &&
    allowInjected &&
    typeof window !== "undefined" &&
    window.ethereum
  ) {
    try {
      _roProvider = new Web3Provider(window.ethereum, "any");
      return _applyPollingInterval(_roProvider);
    } catch (err) {
      console.warn(
        "getROProvider: failed to use injected provider, falling back to RPC:",
        err?.message || err,
      );
      _roProvider = undefined;
    }
  }

  // RPC path (synchronous, no async health probes to avoid invalid provider objects)
  setPreferredRpc(urls[0]);

  if (urls.length === 1) {
    _roProvider = _mkRpcProvider(urls[0]);
    return _applyPollingInterval(_roProvider);
  }

  const configs = urls.map((url, index) => ({
    provider: _mkRpcProvider(url),
    priority: index + 1,
    stallTimeout: 1500,
    weight: 1,
  }));

  try {
    _roProvider = new FallbackProvider(configs, 1);
    return _applyPollingInterval(_roProvider);
  } catch (err) {
    console.warn(
      "getROProvider: FallbackProvider construction failed, using first RPC:",
      err?.message || err,
    );
    _roProvider = _mkRpcProvider(urls[0]);
    return _applyPollingInterval(_roProvider);
  }
}

export function resetROProvider() {
  _roProvider = undefined;
}

export function getSignerProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Injected provider not available");
  }
  return new Web3Provider(window.ethereum, "any");
}

function _hasRequest(provider) {
  return provider && typeof provider.request === "function";
}

function _markRpcSynced() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_RPC_SYNC_KEY, "1");
    }
  } catch {
    // ignore localStorage write failure
  }
}

function _hasSyncedRpc() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(LOCAL_STORAGE_RPC_SYNC_KEY) === "1";
    }
  } catch {
    // ignore localStorage read failure
  }
  return false;
}

export async function syncAmoyRpcIfNeeded(
  externalProvider,
  { force = false } = {},
) {
  const provider =
    externalProvider ||
    (typeof window !== "undefined" ? window.ethereum : null);
  if (!_hasRequest(provider))
    throw new Error("Ethereum provider not available");
  if (!force && _hasSyncedRpc()) return false;

  const rpcUrls = getRpcUrls();
  const params = {
    chainId: AMOY.hex,
    chainName: AMOY.name,
    nativeCurrency: AMOY.currency,
    rpcUrls,
    blockExplorerUrls: AMOY.explorer ? [AMOY.explorer] : [],
  };

  await provider.request({
    method: "wallet_addEthereumChain",
    params: [params],
  });

  _markRpcSynced();
  return true;
}

export async function ensureAmoy(externalProvider) {
  const provider =
    externalProvider ||
    (typeof window !== "undefined" ? window.ethereum : null);
  if (!_hasRequest(provider))
    throw new Error("Ethereum provider not available");

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AMOY.hex }],
    });
    return true;
  } catch (err) {
    const code = err?.code ?? err?.data?.originalError?.code;
    if (
      code === 4902 ||
      code === -32603 ||
      /unrecognized chain/i.test(err?.message || "")
    ) {
      await syncAmoyRpcIfNeeded(provider, { force: true });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: AMOY.hex }],
      });
      return true;
    }
    console.warn("ensureAmoy: failed to switch to Polygon Amoy", err);
    throw err;
  }
}

/* ---------------- small helper: resolve ABI with fallbacks and warn ---------------- */
function _resolveABI(primary, ...fallbacks) {
  if (Array.isArray(primary) && primary.length) return primary;
  for (const f of fallbacks) {
    if (Array.isArray(f) && f.length) {
      console.warn("contract.js: using fallback ABI (primary missing)");
      return f;
    }
  }
  console.warn(
    "contract.js: no ABI found for requested module (all candidates empty)",
  );
  return [];
}

const _mkRO = (addr, abi, providerOverride) => {
  if (!addr) throw new Error("Contract address not configured (addr is falsy)");
  const p = providerOverride || getROProvider();
  const resolvedAbi = _resolveABI(abi, ABI_READER);
  if (!resolvedAbi.length)
    console.warn(
      `Creating read-only contract for ${addr} with empty ABI — calls will fail.`,
    );
  return new Contract(addr, resolvedAbi, p);
};

const _mkRW = (addr, abi, signerProvider) => {
  if (!addr) throw new Error("Contract address not configured (addr is falsy)");
  const prov = signerProvider || getSignerProvider();
  const resolvedAbi = _resolveABI(abi, ABI_READER);
  if (!resolvedAbi.length)
    console.warn(
      `Creating write contract for ${addr} with empty ABI — calls will fail.`,
    );
  return new Contract(addr, resolvedAbi, prov.getSigner());
};

/* ---------------- Exports (contract factories) ---------------- */

/* Core contracts */
export const getReadOnlyMain = (provider) =>
  _mkRO(MAIN_ADDR_ACTIVE, ABI_MAIN_ACTIVE, provider);
export const getMain = () => _mkRW(MAIN_ADDR_ACTIVE, ABI_MAIN_ACTIVE);

export const getReadOnlyMain2 = (provider) =>
  _mkRO(ADDR.MAIN2, ABI_BiggiMain2, provider);
export const getMain2 = () => _mkRW(ADDR.MAIN2, ABI_BiggiMain2);
export const getCOLLECTIONVRFRO = (provider) =>
  _mkRO(ADDR.COLLECTION_VRF || ADDR.MAIN, ABI_COLLECTION_VRF, provider);
export const getCOLLECTIONVRF = () =>
  _mkRW(ADDR.COLLECTION_VRF || ADDR.MAIN, ABI_COLLECTION_VRF);
export const getCOLLECTIONPublicRO = (provider) =>
  _mkRO(ADDR.COLLECTION_PUBLIC || ADDR.MAIN2, ABI_COLLECTION_PUBLIC, provider);
export const getCOLLECTIONPublic = () =>
  _mkRW(ADDR.COLLECTION_PUBLIC || ADDR.MAIN2, ABI_COLLECTION_PUBLIC);

export const getVRFRO = (provider) => {
  if (!ADDR.VRF_ROUTER) {
    console.warn("getVRFRO: VRF router address not configured; returning null");
    return null;
  }
  return _mkRO(ADDR.VRF_ROUTER, ABI_VRF, provider);
};

export const getTokenRO = (provider) => _mkRO(ADDR.BIGGI, ABI_TOKEN, provider);
export const getToken = () => _mkRW(ADDR.BIGGI, ABI_TOKEN);

export const getDistributorRO = (provider) =>
  _mkRO(ADDR.DISTRIBUTOR, ABI_DISTRIBUTOR, provider);
export const getDistributor = () => _mkRW(ADDR.DISTRIBUTOR, ABI_DISTRIBUTOR);

export const getReserveRO = (provider) =>
  _mkRO(ADDR.RESERVE, ABI_RESERVE, provider);
export const getReserve = () => _mkRW(ADDR.RESERVE, ABI_RESERVE);

export const getTreasuryRO = (provider) =>
  _mkRO(ADDR.TREASURY, ABI_TREASURY, provider);
export const getTreasury = () => _mkRW(ADDR.TREASURY, ABI_TREASURY);

export const getBUYBACKRO = (provider) =>
  _mkRO(ADDR.BUYBACK_AGENT, ABI_BUYBACK, provider);
export const getBUYBACK = () => _mkRW(ADDR.BUYBACK_AGENT, ABI_BUYBACK);

export const getPOLICYRO = (provider) =>
  _mkRO(ADDR.POLICY, ABI_POLICY, provider);
export const getPOLICY = () => _mkRW(ADDR.POLICY, ABI_POLICY);

export const getLiquidityAutomationRO = (provider) =>
  _mkRO(ADDR.LIQUIDITY_AUTOMATION, ABI_LIQUIDITY_AUTOMATION, provider);
export const getLiquidityAutomation = () =>
  _mkRW(ADDR.LIQUIDITY_AUTOMATION, ABI_LIQUIDITY_AUTOMATION);

export const getTokenREWARDSRO = (provider) =>
  _mkRO(ADDR.TOKEN_REWARDS, ABI_TOKEN_REWARDS, provider);
export const getTokenREWARDS = () =>
  _mkRW(ADDR.TOKEN_REWARDS, ABI_TOKEN_REWARDS);

export const getCOLLECTIONREWARDSRO = (provider) =>
  _mkRO(ADDR.COLLECTION_REWARDS, ABI_COLLECTION_REWARDS, provider);
export const getCOLLECTIONREWARDS = () =>
  _mkRW(ADDR.COLLECTION_REWARDS, ABI_COLLECTION_REWARDS);

export const getDRIPDistributorRO = (provider) =>
  _mkRO(ADDR.DRIP_DISTRIBUTOR, ABI_DRIP_DISTRIBUTOR, provider);
export const getDRIPDistributor = () =>
  _mkRW(ADDR.DRIP_DISTRIBUTOR, ABI_DRIP_DISTRIBUTOR);

export const getDRIPKeeperRO = (provider) => {
  const addr = ADDR.DRIP_KEEPER_PROXY ?? ADDR.DRIP_KEEPER ?? null;
  if (!addr)
    throw new Error(
      "DRIPKeeper address not configured in ADDR (expected DRIP_KEEPER_PROXY)",
    );
  return _mkRO(addr, ABI_DRIP_KEEPER, provider);
};
export const getDRIPKeeper = () => {
  const addr = ADDR.DRIP_KEEPER_PROXY ?? ADDR.DRIP_KEEPER ?? null;
  if (!addr)
    throw new Error(
      "DRIPKeeper address not configured in ADDR (expected DRIP_KEEPER_PROXY)",
    );
  return _mkRW(addr, ABI_DRIP_KEEPER);
};

// legacy aliases
export const getREWARDSRO = getCOLLECTIONREWARDSRO;
export const getREWARDS = getCOLLECTIONREWARDS;

export const getFactoryRO = (provider) =>
  _mkRO(ADDR.FACTORY, ABI_FACTORY, provider);
export const getRouter = () => _mkRW(ADDR.ROUTER, ABI_ROUTER);
export const getRouterRO = (provider) =>
  _mkRO(ADDR.ROUTER, ABI_ROUTER, provider);
export const getPairRO = (provider) => _mkRO(ADDR.PAIR, ABI_PAIR, provider);

export const getLMRawRO = (provider) => _mkRO(ADDR.LM, ABI_LM, provider);
export const getLMRaw = () => _mkRW(ADDR.LM, ABI_LM);

export const getUpkeepRO = (provider) =>
  _mkRO(ADDR.UPKEEP_PROXY, ABI_UPKEEP, provider);
export const getUpkeep = () => _mkRW(ADDR.UPKEEP_PROXY, ABI_UPKEEP);

export const getReaderRO = (provider) => {
  const addr = ADDR.READER || ADDR.MAIN_READER || null;
  if (!addr) {
    console.warn(
      "getReaderRO: reader address not configured; falling back to MAIN",
    );
    return getReadOnlyMain(provider);
  }
  return _mkRO(addr, ABI_READER, provider);
};

export async function getFrontendSnapshotLiteActive(readerOverride) {
  const reader = readerOverride || getReaderRO();
  const useMain2 =
    _sameAddr(ADDR.MAIN, ADDR.MAIN2) ||
    _sameAddr(ADDR.MAIN, ADDR.COLLECTION_PUBLIC);
  const targetMain = ADDR.COLLECTION_VRF || ADDR.MAIN || null;
  const targetPublic = ADDR.COLLECTION_PUBLIC || ADDR.MAIN2 || null;

  const tryCall = async (fn, ...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      return { __error: err };
    }
  };

  if (useMain2 && typeof reader.getFrontendSnapshotLiteMain2 === "function") {
    const res = await tryCall(reader.getFrontendSnapshotLiteMain2.bind(reader));
    if (!res?.__error) return res;
  }
  if (
    useMain2 &&
    typeof reader.getFrontendSnapshotLiteFor === "function" &&
    targetPublic
  ) {
    const res = await tryCall(
      reader.getFrontendSnapshotLiteFor.bind(reader),
      targetPublic,
    );
    if (!res?.__error) return res;
  }
  if (typeof reader.getFrontendSnapshotLiteFor === "function" && targetMain) {
    const res = await tryCall(
      reader.getFrontendSnapshotLiteFor.bind(reader),
      targetMain,
    );
    if (!res?.__error) return res;
  }
  if (typeof reader.getFrontendSnapshotLite === "function") {
    const res = await tryCall(reader.getFrontendSnapshotLite.bind(reader));
    if (!res?.__error) return res;
  }

  // Fallback: build snapshot directly from main contract to avoid reader reverts.
  const main = getReadOnlyMain();
  const safeBn = (v) =>
    typeof v === "bigint" ? v : BigInt(v || 0);
  const [ticketPriceWei, ticketMinted_, biggiMinted_] = await Promise.all([
    main
      .getTicketPrice?.()
      .catch(() => main.ticketPrice?.().catch(() => 0n)),
    main.ticketMinted?.().catch(() => 0n),
    main.biggiMinted?.().catch(() => 0n),
  ]);

  const blockPricePromises = [];
  const blockMintPromises = [];
  for (let i = 1; i <= 10; i += 1) {
    blockPricePromises.push(
      main.getCurrentBlockPrice?.(i).catch(() => 0n),
    );
    blockMintPromises.push(
      main.getBlockMintCount?.(i).catch(() => 0n),
    );
  }
  const bgMintPromises = [];
  for (let j = 0; j < 10; j += 1) {
    bgMintPromises.push(
      main.backgroundMintCounts?.(j).catch(() => 0n),
    );
  }

  const currentBlockPrices = (await Promise.all(blockPricePromises)).map(
    safeBn,
  );
  const blocksMinted = (await Promise.all(blockMintPromises)).map(safeBn);
  const bgsMinted = (await Promise.all(bgMintPromises)).map(safeBn);
  const charactersMinted = BigInt(0);

  return [
    safeBn(ticketPriceWei),
    safeBn(ticketMinted_),
    safeBn(biggiMinted_),
    currentBlockPrices,
    blocksMinted,
    bgsMinted,
    charactersMinted,
  ];
}

/* ---------------- New reader factories (explicit names) ---------------- */

// BiggiMainReader (full main reader)
export const getBiggiMainReaderRO = (provider) => {
  const addr = ADDR.READER ?? ADDR.MAIN_READER ?? null;
  if (!addr)
    throw new Error(
      "BiggiMainReader address not configured in ADDR (expected MAIN_READER or READER)",
    );
  const abi = ABI_BiggiMainReader.length ? ABI_BiggiMainReader : ABI_READER;
  return _mkRO(addr, abi, provider);
};
export const getBiggiMainReader = () => {
  const addr = ADDR.READER ?? ADDR.MAIN_READER ?? null;
  if (!addr)
    throw new Error(
      "BiggiMainReader address not configured in ADDR (expected MAIN_READER or READER)",
    );
  const abi = ABI_BiggiMainReader.length ? ABI_BiggiMainReader : ABI_READER;
  return _mkRW(addr, abi);
};

// BiggiREWARDSReader
export const getBiggiREWARDSReaderRO = (provider) => {
  const addr =
    ADDR.BIGGI_REWARDS_READER ??
    ADDR.COLLECTION_REWARDS_READER ??
    ADDR.NFT_REWARDS_READER ??
    null;
  if (!addr)
    throw new Error(
      "BiggiREWARDSReader address not configured in ADDR (expected *_REWARDS_READER)",
    );
  const abi = ABI_BiggiREWARDSReader.length
    ? ABI_BiggiREWARDSReader
    : ABI_COLLECTIONREWARDSReader || ABI_NFTREWARDSReader || ABI_READER;
  return _mkRO(addr, abi, provider);
};
export const getBiggiREWARDSReader = () => {
  const addr =
    ADDR.BIGGI_REWARDS_READER ??
    ADDR.COLLECTION_REWARDS_READER ??
    ADDR.NFT_REWARDS_READER ??
    null;
  if (!addr)
    throw new Error(
      "BiggiREWARDSReader address not configured in ADDR (expected *_REWARDS_READER)",
    );
  const abi = ABI_BiggiREWARDSReader.length
    ? ABI_BiggiREWARDSReader
    : ABI_COLLECTIONREWARDSReader || ABI_NFTREWARDSReader || ABI_READER;
  return _mkRW(addr, abi);
};

// BiggiTokenReader (token-centric snapshot helper)
export const getBiggiTokenReaderRO = (provider) => {
  const addr =
    ADDR.BIGGI_TOKEN_READER ?? ADDR.LM_READER ?? ADDR.RESERVE_READER ?? null;
  if (!addr)
    throw new Error(
      "BiggiTokenReader address not configured in ADDR (expected *_READER)",
    );
  const abi = ABI_BiggiTokenReader.length
    ? ABI_BiggiTokenReader
    : ABI_BiggiTokenomicsReader;
  return _mkRO(addr, abi, provider);
};
export const getBiggiTokenReader = () => {
  const addr =
    ADDR.BIGGI_TOKEN_READER ?? ADDR.LM_READER ?? ADDR.RESERVE_READER ?? null;
  if (!addr)
    throw new Error(
      "BiggiTokenReader address not configured in ADDR (expected *_READER)",
    );
  const abi = ABI_BiggiTokenReader.length
    ? ABI_BiggiTokenReader
    : ABI_BiggiTokenomicsReader;
  return _mkRW(addr, abi);
};

// BiggiTokenomicsReader
export const getBiggiTokenomicsReaderRO = (provider) => {
  const addr = ADDR.BIGGI_TOKENOMICS_READER ?? null;
  if (!addr)
    throw new Error(
      "BiggiTokenomicsReader address not configured in ADDR (expected BIGGI_TOKENOMICS_READER)",
    );
  const abi = ABI_BiggiTokenomicsReader.length
    ? ABI_BiggiTokenomicsReader
    : ABI_ReserveReader || ABI_LiquidityManagerReader || ABI_READER;
  return _mkRO(addr, abi, provider);
};
export const getBiggiTokenomicsReader = () => {
  const addr = ADDR.BIGGI_TOKENOMICS_READER ?? null;
  if (!addr)
    throw new Error(
      "BiggiTokenomicsReader address not configured in ADDR (expected BIGGI_TOKENOMICS_READER)",
    );
  const abi = ABI_BiggiTokenomicsReader.length
    ? ABI_BiggiTokenomicsReader
    : ABI_ReserveReader || ABI_LiquidityManagerReader || ABI_READER;
  return _mkRW(addr, abi);
};

/* ---------------- New explicit factories for newly added contracts ---------------- */

/* NFTREWARDS (viewer + claim) */
export const getNFTREWARDSRO = (provider) => {
  const addr =
    ADDR.NFT_REWARDS ??
    ADDR.NFTREWARDS ??
    ADDR.NFT_REWARDS_CONTRACT ??
    ADDR.NFT_REWARDS_READER ??
    null;
  if (!addr)
    throw new Error(
      "NFTREWARDS address not configured in ADDR (expected NFT_REWARDS)",
    );
  const abi =
    Array.isArray(ABI_NFTREWARDS) && ABI_NFTREWARDS.length
      ? ABI_NFTREWARDS
      : ABI_NFTREWARDSReader || ABI_READER;
  return _mkRO(addr, abi, provider);
};
export const getNFTREWARDS = () => {
  const addr =
    ADDR.NFT_REWARDS ??
    ADDR.NFTREWARDS ??
    ADDR.NFT_REWARDS_CONTRACT ??
    ADDR.NFT_REWARDS_READER ??
    null;
  if (!addr)
    throw new Error(
      "NFTREWARDS address not configured in ADDR (expected NFT_REWARDS)",
    );
  const abi =
    Array.isArray(ABI_NFTREWARDS) && ABI_NFTREWARDS.length
      ? ABI_NFTREWARDS
      : ABI_NFTREWARDSReader || ABI_READER;
  return _mkRW(addr, abi);
};

/* DRIP Liquidity Manager */
export const getDRIPLMRO = (provider) => {
  const addr =
    ADDR.DRIP_LM ?? ADDR.DRIPLM ?? ADDR.DRIP_LIQUIDITY_MANAGER ?? null;
  if (!addr)
    throw new Error(
      "DRIPLM address not configured in ADDR (expected DRIP_LM / DRIPLM)",
    );
  const abi =
    Array.isArray(ABI_DRIPLM) && ABI_DRIPLM.length
      ? ABI_DRIPLM
      : ABI_LM || ABI_READER;
  return _mkRO(addr, abi, provider);
};
export const getDRIPLM = () => {
  const addr =
    ADDR.DRIP_LM ?? ADDR.DRIPLM ?? ADDR.DRIP_LIQUIDITY_MANAGER ?? null;
  if (!addr)
    throw new Error(
      "DRIPLM address not configured in ADDR (expected DRIP_LM / DRIPLM)",
    );
  const abi =
    Array.isArray(ABI_DRIPLM) && ABI_DRIPLM.length
      ? ABI_DRIPLM
      : ABI_LM || ABI_READER;
  return _mkRW(addr, abi);
};

/* Reader aliases already added above; if you need more reader aliases add here */

/* ---------------- Helpers ---------------- */
export const toWei = (n) => parseEther(String(n));
export const fromWei = (bn) => Number(formatEther(bn));

/* -------- Compat for older code -------- */
function _looksLikeProvider(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      (typeof value.getNetwork === "function" ||
        typeof value.call === "function" ||
        // ethers v5 providers have this
        value._isProvider),
  );
}

function _normalizeKind(kind) {
  return String(kind || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * Back-compat generic contract getter.
 *
 * Supported call forms:
 * - `getReadOnlyContract()` -> MAIN
 * - `getReadOnlyContract(provider)` -> MAIN with provider override
 * - `getReadOnlyContract("distributor", ABI_DISTRIBUTOR, provider?)` -> by kind
 * - `getReadOnlyContract(address, abi, provider?)` -> by address
 */
export function getReadOnlyContract(
  kindOrAddressOrProvider,
  abiOrProvider,
  providerOverride,
) {
  // 0 args: MAIN
  if (kindOrAddressOrProvider == null) {
    return getReadOnlyMain();
  }

  // provider passed as first arg
  if (_looksLikeProvider(kindOrAddressOrProvider)) {
    return getReadOnlyMain(kindOrAddressOrProvider);
  }

  const input = String(kindOrAddressOrProvider).trim();

  // address passed as first arg
  if (/^0x[0-9a-fA-F]{40}$/.test(input)) {
    const abi = Array.isArray(abiOrProvider) ? abiOrProvider : ABI_READER;
    const provider = _looksLikeProvider(providerOverride)
      ? providerOverride
      : undefined;
    return _mkRO(input, abi, provider);
  }

  // Parse remaining args (either ABI or provider)
  const abi = Array.isArray(abiOrProvider) ? abiOrProvider : null;
  const provider = _looksLikeProvider(providerOverride)
    ? providerOverride
    : _looksLikeProvider(abiOrProvider)
      ? abiOrProvider
      : undefined;

  const kind = _normalizeKind(input);
  const kindMap = {
    main: { addr: () => MAIN_ADDR_ACTIVE, abi: ABI_MAIN_ACTIVE },
    main2: { addr: () => ADDR.MAIN2, abi: ABI_MAIN2 },
    token: { addr: () => ADDR.BIGGI, abi: ABI_TOKEN },
    biggi: { addr: () => ADDR.BIGGI, abi: ABI_TOKEN },
    VRF: { addr: () => ADDR.VRF_ROUTER, abi: ABI_VRF },
    distributor: { addr: () => ADDR.DISTRIBUTOR, abi: ABI_DISTRIBUTOR },
    reserve: { addr: () => ADDR.RESERVE, abi: ABI_RESERVE },
    treasury: { addr: () => ADDR.TREASURY, abi: ABI_TREASURY },
    BUYBACK: { addr: () => ADDR.BUYBACK_AGENT, abi: ABI_BUYBACK },
    BUYBACKagent: { addr: () => ADDR.BUYBACK_AGENT, abi: ABI_BUYBACK },
    POLICY: { addr: () => ADDR.POLICY, abi: ABI_POLICY },
    liquidityautomation: {
      addr: () => ADDR.LIQUIDITY_AUTOMATION,
      abi: ABI_LIQUIDITY_AUTOMATION,
    },
    DRIPdistributor: {
      addr: () => ADDR.DRIP_DISTRIBUTOR,
      abi: ABI_DRIP_DISTRIBUTOR,
    },
    DRIPlm: {
      addr: () => ADDR.DRIP_LM ?? ADDR.DRIPLM ?? ADDR.DRIP_LIQUIDITY_MANAGER,
      abi: ABI_DRIPLM,
    },
    DRIPkeeper: {
      addr: () => ADDR.DRIP_KEEPER_PROXY ?? ADDR.DRIP_KEEPER,
      abi: ABI_DRIP_KEEPER,
    },
    tokenREWARDS: { addr: () => ADDR.TOKEN_REWARDS, abi: ABI_TOKEN_REWARDS },
    COLLECTIONREWARDS: {
      addr: () => ADDR.COLLECTION_REWARDS,
      abi: ABI_COLLECTION_REWARDS,
    },
    nftREWARDS: {
      addr: () => ADDR.NFT_REWARDS,
      abi:
        Array.isArray(ABI_NFTREWARDS) && ABI_NFTREWARDS.length
          ? ABI_NFTREWARDS
          : ABI_READER,
    },
    liquidityvault: {
      addr: () => ADDR.LIQUIDITY_VAULT,
      abi: ABI_LIQUIDITY_VAULT,
    },
    liquiditymanager: { addr: () => ADDR.LM, abi: ABI_LM },
    lm: { addr: () => ADDR.LM, abi: ABI_LM },
    router: { addr: () => ADDR.ROUTER, abi: ABI_ROUTER },
    factory: { addr: () => ADDR.FACTORY, abi: ABI_FACTORY },
    pair: { addr: () => ADDR.PAIR, abi: ABI_PAIR },
    reader: { addr: () => ADDR.READER, abi: ABI_READER },
    mainreader: {
      addr: () => ADDR.MAIN_READER || ADDR.READER,
      abi: ABI_BiggiMainReader || ABI_READER,
    },
    biggitokenomicsreader: {
      addr: () => ADDR.BIGGI_TOKENOMICS_READER,
      abi: ABI_BiggiTokenomicsReader || ABI_READER,
    },
    tokenomicsreader: {
      addr: () => ADDR.BIGGI_TOKENOMICS_READER,
      abi: ABI_BiggiTokenomicsReader || ABI_READER,
    },
    biggiREWARDSreader: {
      addr: () => ADDR.BIGGI_REWARDS_READER || ADDR.COLLECTION_REWARDS_READER,
      abi: ABI_BiggiREWARDSReader || ABI_READER,
    },
    REWARDSreader: {
      addr: () => ADDR.BIGGI_REWARDS_READER || ADDR.COLLECTION_REWARDS_READER,
      abi: ABI_BiggiREWARDSReader || ABI_READER,
    },
  };

  const entry = kindMap[kind];
  if (!entry) {
    // Fallback to MAIN (prevents accidental passing of "distributor" as provider)
    console.warn(
      `getReadOnlyContract: unknown kind '${input}', falling back to MAIN`,
    );
    return getReadOnlyMain(provider);
  }

  const addr = entry.addr();
  if (!addr)
    throw new Error(
      `getReadOnlyContract: address not configured for kind '${input}'`,
    );
  return _mkRO(addr, abi || entry.abi || ABI_READER, provider);
}
export const getContract = getMain;

/* ---------------- "Liquidity hub" helpers ---------------- */
function _mergeTargets(...parts) {
  return new Proxy(parts[0] || {}, {
    get(_t, prop) {
      for (const p of parts) if (p && prop in p) return p[prop];
      return undefined;
    },
  });
}
function _attachHelpers(target, signerMode = false) {
  if (typeof target.routerInfo !== "function") {
    target.routerInfo = async () => [ADDR.ROUTER, ADDR.WETH];
  }
  if (typeof target.getSwapPath !== "function") {
    target.getSwapPath = async () => [ADDR.WETH, ADDR.BIGGI];
  }
  if (typeof target.liquidityPreview !== "function") {
    target.liquidityPreview = async () => {
      try {
        const lm = signerMode ? await getLMRaw() : getLMRawRO();
        if (typeof lm.liquidityPreview === "function")
          return lm.liquidityPreview();
      } catch {
        // ignore parsing failure for this part
      }
      const prov = signerMode ? getSignerProvider() : getROProvider();
      const addr = ADDR.BUYBACK_AGENT;
      const bal = await prov
        .getBalance(addr)
        .catch(() => 0n);
      return [bal, 0, 0, 0, 0];
    };
  }
  return target;
}

export function getLMRO() {
  const merged = _mergeTargets(
    getTokenREWARDSRO(),
    getBUYBACKRO(),
    getLMRawRO(),
  );
  return _attachHelpers(merged, false);
}
export async function getLM() {
  const merged = _mergeTargets(
    await getTokenREWARDS(),
    await getBUYBACK(),
    await getLMRaw(),
  );
  return _attachHelpers(merged, true);
}
export function getReadOnlyLiquidityContract() {
  return getLMRO();
}
export async function getLiquidityContract() {
  return getLM();
}

export async function resolveTicketPriceWeiFromHub() {
  const c = getReadOnlyMain();
  const tryFns = [
    "getTicketPrice",
    "ticketPrice",
    "getTicketPriceWei",
    "ticketPriceWei",
  ];
  for (const name of tryFns) {
    const f = c[name];
    if (typeof f === "function") {
      try {
        const v = await f();
        if (v != null) return BigInt(v);
      } catch {
        // try next candidate
      }
    }
  }
  const reader = getReaderRO();
  try {
    const snap = await getFrontendSnapshotLiteActive(reader);
    const wei = Array.isArray(snap) ? snap[0] : snap?.ticketPriceWei;
    if (wei != null) return BigInt(wei);
  } catch {
    // ignore reader failure, will throw below
  }
  throw new Error("Ticket price unavailable");
}




