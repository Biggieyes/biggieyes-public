// src/utils/contract.js
// Ethers v5 compatible helpers and contract factories
import { ethers } from "ethers";
import { ADDR } from "./addresses.js";
import {
  ABI_MAIN, ABI_MAIN2, ABI_VRF,
  ABI_TOKEN, ABI_DISTRIBUTOR, ABI_RESERVE, ABI_TREASURY, ABI_BUYBACK, ABI_POLICY,
  ABI_TOKEN_REWARDS, ABI_COLLECTION_REWARDS, ABI_LIQUIDITY_VAULT,
  ABI_FACTORY, ABI_ROUTER, ABI_PAIR,
  ABI_LM, ABI_UPKEEP, ABI_READER,
  ABI_BiggiMainReader, ABI_BiggiRewardsReader, ABI_BiggiTokenomicsReader, ABI_BiggiTokenReader,
  // granular fallbacks (if present)
  ABI_NFTRewardsReader, ABI_CollectionRewardsReader, ABI_TokenRewardsReader,
  ABI_ReserveReader, ABI_LiquidityManagerReader,
  ABI_COLLECTION_VRF, ABI_COLLECTION_PUBLIC,
  // nové ABI (pokud jsi je přidal do indexu)
  ABI_NFTREWARDS, ABI_EVENTS, ABI_DRIPLM, ABI_DRIP_DISTRIBUTOR,
  ABI_COMPUTE, ABI_LIQUIDITY_AUTOMATION, ABI_LIQUIDITY_SETUP, ABI_DRIP_KEEPER
} from "./abi/index.js";

const { StaticJsonRpcProvider, Web3Provider, FallbackProvider } = ethers.providers;
const { parseEther: _parseEther, formatEther: _formatEther } = ethers.utils;

const LOCAL_STORAGE_RPC_SYNC_KEY = "biggi_amoy_rpc_synced_v1";
const LOCAL_STORAGE_RPC_PREF_KEY = "biggi_last_amoy_rpc_v1";
const BAD_RPC_SUBSTRINGS = ["tenderly", "drpc.org"]; // noisy / rate-limited endpoints
const BAD_CORS_RPCS = ["rpc-amoy.polygon.technology"]; // official Amoy RPC blocks browser CORS

function _env(key) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) return import.meta.env[key];
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

function _splitCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function _uniq(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const v = (value || "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function _secureRandomInt(maxExclusive) {
  if (maxExclusive <= 1) return 0;
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] % maxExclusive;
    }
  } catch {
    // ignore crypto unavailability
  }
  return Math.floor(Math.random() * maxExclusive);
}

function _loadPreferredRpc() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(LOCAL_STORAGE_RPC_PREF_KEY) || null;
    }
  } catch {
    // ignore localStorage issues
  }
  return null;
}

function _storePreferredRpc(url) {
  if (!url) return;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_RPC_PREF_KEY, url);
    }
  } catch {
    // ignore store failures
  }
}

function _clearPreferredRpc() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(LOCAL_STORAGE_RPC_PREF_KEY);
    }
  } catch {
    // ignore clear failures
  }
}

function _rankRpcUrls(urls) {
  const deduped = _uniq(urls.filter(Boolean));
  if (!deduped.length) return deduped;
  const ignorePreferred = _env("VITE_FORCE_RPC") === "1" || _env("VITE_IGNORE_RPC_PREFERENCE") === "1";
  const preferred = ignorePreferred ? null : _loadPreferredRpc();
  if (ignorePreferred) _clearPreferredRpc();
  if (preferred && deduped.includes(preferred)) {
    return [preferred, ...deduped.filter((u) => u !== preferred)];
  }
  // Preserve declared order to avoid bouncing into rate-limited endpoints unexpectedly.
  return deduped;
}

function _filterOutBadRpcs(urls) {
  const allowTenderly = _env("VITE_ALLOW_TENDERLY_RPC") === "1";
  const isBrowser = typeof window !== "undefined";
  return urls.filter((u) => {
    if (!u) return false;
    const lower = String(u).toLowerCase();
    if (!allowTenderly && BAD_RPC_SUBSTRINGS.some((x) => lower.includes(x))) return false;
    if (isBrowser && BAD_CORS_RPCS.some((x) => lower.includes(x))) return false;
    return true;
  });
}

export const PUBLIC_AMOY_RPCS = [
  // Public endpoints that allow browser CORS; official RPC omitted because it blocks CORS.
  "https://polygon-amoy-bor.publicnode.com",
];

const AMOY_RPC_CANDIDATES = _uniq([
  _env("VITE_AMOY_RPC_URL"),
  ..._splitCsv(_env("VITE_ADDITIONAL_RPC_URLS")),
  ...PUBLIC_AMOY_RPCS,
]);

export const AMOY = {
  chainId: 80002,
  hex: "0x13882",
  name: "Polygon Amoy",
  rpcUrls: AMOY_RPC_CANDIDATES,
  rpcUrl: AMOY_RPC_CANDIDATES[0] || PUBLIC_AMOY_RPCS[0],
  currency: { name: "POL", symbol: "POL", decimals: 18 },
  explorer: "https://amoy.polygonscan.com",
};

export { ADDR };

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

function _candidateRpcUrls() {
  const primaryList = Array.isArray(AMOY.rpcUrls) && AMOY.rpcUrls.length ? AMOY.rpcUrls : [];
  const filtered = _filterOutBadRpcs(primaryList);
  if (!filtered.length && primaryList.length) {
    // preferred RPC was filtered out; clear stored preference to avoid stale Tenderly picks
    _clearPreferredRpc();
  }

  const rankedFiltered = _rankRpcUrls(filtered);
  if (rankedFiltered.length) return rankedFiltered;

  const fallback = [];
  if (AMOY.rpcUrl) fallback.push(AMOY.rpcUrl);
  fallback.push(...PUBLIC_AMOY_RPCS);
  return _rankRpcUrls(_filterOutBadRpcs(fallback));
}

export function getPrimaryRpcUrl() {
  const urls = _candidateRpcUrls();
  return urls[0] || PUBLIC_AMOY_RPCS[0] || "";
}

function _mkRpcProvider(url) {
  // Plain provider is more tolerant of flaky RPCs than batch in some gateways.
  return new StaticJsonRpcProvider({ url, chainId: AMOY.chainId, name: "polygon-amoy" }, AMOY.chainId);
}

export function getROProvider() {
  // Always rebuild provider to avoid sticky stale/blocked endpoints.
  _roProvider = undefined;

  const urls = _candidateRpcUrls();
  if (!urls.length) throw new Error("No RPC endpoints configured for Polygon Amoy. Set VITE_AMOY_RPC_URL.");

  // Prefer injected if allowed and on the right chain
  const preferInjectedEnv = _env("VITE_PREFER_INJECTED") === "true"; // default false
  const ethereum = typeof window !== "undefined" ? window.ethereum : null;
  const hasSelectedAddress = Boolean(ethereum?.selectedAddress);
  const isConnected = Boolean(
    hasSelectedAddress ||
      (typeof ethereum?.isConnected === "function" && ethereum.isConnected())
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
        const parsed = raw.startsWith("0x") ? Number.parseInt(raw, 16) : Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      }
    } catch {
      // ignore chainId parsing errors
    }
    return null;
  })();
  const allowInjected = injectedChainId === AMOY.chainId;

  if (!forceRpc && preferInjected && allowInjected && typeof window !== "undefined" && window.ethereum) {
    try {
      _roProvider = new Web3Provider(window.ethereum, "any");
      return _applyPollingInterval(_roProvider);
    } catch (err) {
      console.warn("getROProvider: failed to use injected provider, falling back to RPC:", err?.message || err);
      _roProvider = undefined;
    }
  }

  // RPC path (synchronous, no async health probes to avoid invalid provider objects)
  _storePreferredRpc(urls[0]);

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
    console.warn("getROProvider: FallbackProvider construction failed, using first RPC:", err?.message || err);
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

export async function syncAmoyRpcIfNeeded(externalProvider, { force = false } = {}) {
  const provider = externalProvider || (typeof window !== "undefined" ? window.ethereum : null);
  if (!_hasRequest(provider)) throw new Error("Ethereum provider not available");
  if (!force && _hasSyncedRpc()) return false;

  const rpcUrls = _candidateRpcUrls();
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
  const provider = externalProvider || (typeof window !== "undefined" ? window.ethereum : null);
  if (!_hasRequest(provider)) throw new Error("Ethereum provider not available");

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AMOY.hex }],
    });
    return true;
  } catch (err) {
    const code = err?.code ?? err?.data?.originalError?.code;
    if (code === 4902 || code === -32603 || /unrecognized chain/i.test(err?.message || "")) {
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
  console.warn("contract.js: no ABI found for requested module (all candidates empty)");
  return [];
}

const _mkRO = (addr, abi, providerOverride) => {
  if (!addr) throw new Error("Contract address not configured (addr is falsy)");
  const p = providerOverride || getROProvider();
  const resolvedAbi = _resolveABI(abi, ABI_READER);
  if (!resolvedAbi.length) console.warn(`Creating read-only contract for ${addr} with empty ABI — calls will fail.`);
  return new ethers.Contract(addr, resolvedAbi, p);
};

const _mkRW = (addr, abi, signerProvider) => {
  if (!addr) throw new Error("Contract address not configured (addr is falsy)");
  const prov = signerProvider || getSignerProvider();
  const resolvedAbi = _resolveABI(abi, ABI_READER);
  if (!resolvedAbi.length) console.warn(`Creating write contract for ${addr} with empty ABI — calls will fail.`);
  return new ethers.Contract(addr, resolvedAbi, prov.getSigner());
};

/* ---------------- Exports (contract factories) ---------------- */

/* Core contracts */
export const getReadOnlyMain   = (provider) => _mkRO(ADDR.MAIN,  ABI_MAIN, provider);
export const getMain           = () => _mkRW(ADDR.MAIN,  ABI_MAIN);

export const getReadOnlyMain2  = (provider) => _mkRO(ADDR.MAIN2, ABI_MAIN2, provider);
export const getMain2          = () => _mkRW(ADDR.MAIN2, ABI_MAIN2);
export const getCollectionVRFRO    = (provider) => _mkRO(ADDR.COLLECTION_VRF || ADDR.MAIN, ABI_COLLECTION_VRF, provider);
export const getCollectionVRF      = () => _mkRW(ADDR.COLLECTION_VRF || ADDR.MAIN, ABI_COLLECTION_VRF);
export const getCollectionPublicRO = (provider) => _mkRO(ADDR.COLLECTION_PUBLIC || ADDR.MAIN2, ABI_COLLECTION_PUBLIC, provider);
export const getCollectionPublic   = () => _mkRW(ADDR.COLLECTION_PUBLIC || ADDR.MAIN2, ABI_COLLECTION_PUBLIC);

export const getVRFRO          = (provider) => _mkRO(ADDR.VRF_ROUTER, ABI_VRF, provider);

export const getTokenRO        = (provider) => _mkRO(ADDR.BIGGI,  ABI_TOKEN, provider);
export const getToken          = () => _mkRW(ADDR.BIGGI,  ABI_TOKEN);

export const getDistributorRO  = (provider) => _mkRO(ADDR.DISTRIBUTOR, ABI_DISTRIBUTOR, provider);
export const getDistributor    = () => _mkRW(ADDR.DISTRIBUTOR, ABI_DISTRIBUTOR);

export const getReserveRO      = (provider) => _mkRO(ADDR.RESERVE,  ABI_RESERVE, provider);
export const getReserve        = () => _mkRW(ADDR.RESERVE,  ABI_RESERVE);

export const getTreasuryRO     = (provider) => _mkRO(ADDR.TREASURY, ABI_TREASURY, provider);
export const getTreasury       = () => _mkRW(ADDR.TREASURY,  ABI_TREASURY);

export const getBuybackRO      = (provider) => _mkRO(ADDR.BUYBACK_AGENT, ABI_BUYBACK, provider);
export const getBuyback        = () => _mkRW(ADDR.BUYBACK_AGENT, ABI_BUYBACK);

export const getPolicyRO       = (provider) => _mkRO(ADDR.POLICY, ABI_POLICY, provider);
export const getPolicy         = () => _mkRW(ADDR.POLICY, ABI_POLICY);

export const getComputeRO      = (provider) => _mkRO(ADDR.COMPUTE, ABI_COMPUTE, provider);

export const getLiquidityAutomationRO = (provider) => _mkRO(ADDR.LIQUIDITY_AUTOMATION, ABI_LIQUIDITY_AUTOMATION, provider);
export const getLiquidityAutomation   = () => _mkRW(ADDR.LIQUIDITY_AUTOMATION, ABI_LIQUIDITY_AUTOMATION);

export const getLiquiditySetupRO = (provider) => _mkRO(ADDR.LIQUIDITY_SETUP, ABI_LIQUIDITY_SETUP, provider);
export const getLiquiditySetup   = () => _mkRW(ADDR.LIQUIDITY_SETUP, ABI_LIQUIDITY_SETUP);

export const getTokenRewardsRO = (provider) => _mkRO(ADDR.TOKEN_REWARDS,      ABI_TOKEN_REWARDS, provider);
export const getTokenRewards   = () => _mkRW(ADDR.TOKEN_REWARDS,      ABI_TOKEN_REWARDS);

export const getCollectionRewardsRO = (provider) => _mkRO(ADDR.COLLECTION_REWARDS, ABI_COLLECTION_REWARDS, provider);
export const getCollectionRewards   = () => _mkRW(ADDR.COLLECTION_REWARDS, ABI_COLLECTION_REWARDS);

export const getDripDistributorRO = (provider) => _mkRO(ADDR.DRIP_DISTRIBUTOR, ABI_DRIP_DISTRIBUTOR, provider);
export const getDripDistributor   = () => _mkRW(ADDR.DRIP_DISTRIBUTOR, ABI_DRIP_DISTRIBUTOR);

export const getDripKeeperRO = (provider) => {
  const addr = ADDR.DRIP_KEEPER_PROXY ?? ADDR.DRIP_KEEPER ?? null;
  if (!addr) throw new Error("DripKeeper address not configured in ADDR (expected DRIP_KEEPER_PROXY)");
  return _mkRO(addr, ABI_DRIP_KEEPER, provider);
};
export const getDripKeeper = () => {
  const addr = ADDR.DRIP_KEEPER_PROXY ?? ADDR.DRIP_KEEPER ?? null;
  if (!addr) throw new Error("DripKeeper address not configured in ADDR (expected DRIP_KEEPER_PROXY)");
  return _mkRW(addr, ABI_DRIP_KEEPER);
};

// legacy aliases
export const getRewardsRO = getCollectionRewardsRO;
export const getRewards   = getCollectionRewards;

export const getFactoryRO = (provider) => _mkRO(ADDR.FACTORY, ABI_FACTORY, provider);
export const getRouter    = () => _mkRW(ADDR.ROUTER,  ABI_ROUTER);
export const getRouterRO  = (provider) => _mkRO(ADDR.ROUTER,  ABI_ROUTER, provider);
export const getPairRO    = (provider) => _mkRO(ADDR.PAIR,    ABI_PAIR, provider);

export const getLMRawRO   = (provider) => _mkRO(ADDR.LM,         ABI_LM, provider);
export const getLMRaw     = () => _mkRW(ADDR.LM,         ABI_LM);

export const getUpkeepRO  = (provider) => _mkRO(ADDR.UPKEEP_PROXY, ABI_UPKEEP, provider);
export const getUpkeep    = () => _mkRW(ADDR.UPKEEP_PROXY, ABI_UPKEEP);

export const getReaderRO  = (provider) => {
  const addr = ADDR.READER ?? ADDR.MAIN_READER ?? null;
  if (!addr) throw new Error("Reader address not configured in ADDR (expected READER or MAIN_READER)");
  return _mkRO(addr, ABI_READER, provider);
};

/* ---------------- New reader factories (explicit names) ---------------- */

// BiggiMainReader (full main reader)
export const getBiggiMainReaderRO = (provider) => {
  const addr = ADDR.READER ?? ADDR.MAIN_READER ?? null;
  if (!addr) throw new Error("BiggiMainReader address not configured in ADDR (expected MAIN_READER or READER)");
  const abi = ABI_BiggiMainReader.length ? ABI_BiggiMainReader : ABI_READER;
  return _mkRO(addr, abi, provider);
};
export const getBiggiMainReader   = () => {
  const addr = ADDR.READER ?? ADDR.MAIN_READER ?? null;
  if (!addr) throw new Error("BiggiMainReader address not configured in ADDR (expected MAIN_READER or READER)");
  const abi = ABI_BiggiMainReader.length ? ABI_BiggiMainReader : ABI_READER;
  return _mkRW(addr, abi);
};

// BiggiRewardsReader
export const getBiggiRewardsReaderRO = (provider) => {
  const addr =
    ADDR.BIGGI_REWARDS_READER ??
    ADDR.COLLECTION_REWARDS_READER ??
    ADDR.NFT_REWARDS_READER ??
    null;
  if (!addr) throw new Error("BiggiRewardsReader address not configured in ADDR (expected *_REWARDS_READER)");
  const abi = ABI_BiggiRewardsReader.length ? ABI_BiggiRewardsReader : (ABI_CollectionRewardsReader || ABI_NFTRewardsReader || ABI_READER);
  return _mkRO(addr, abi, provider);
};
export const getBiggiRewardsReader   = () => {
  const addr =
    ADDR.BIGGI_REWARDS_READER ??
    ADDR.COLLECTION_REWARDS_READER ??
    ADDR.NFT_REWARDS_READER ??
    null;
  if (!addr) throw new Error("BiggiRewardsReader address not configured in ADDR (expected *_REWARDS_READER)");
  const abi = ABI_BiggiRewardsReader.length ? ABI_BiggiRewardsReader : (ABI_CollectionRewardsReader || ABI_NFTRewardsReader || ABI_READER);
  return _mkRW(addr, abi);
};

export const getTokenRewardsReaderRO = (provider) => {
  const addr =
    ADDR.TOKEN_REWARDS_READER ??
    ADDR.TokenRewardsReader ??
    null;
  if (!addr) throw new Error("TokenRewardsReader address not configured in ADDR (expected TOKEN_REWARDS_READER)");
  const abi = ABI_TokenRewardsReader.length ? ABI_TokenRewardsReader : ABI_TOKEN_REWARDS;
  return _mkRO(addr, abi, provider);
};
export const getTokenRewardsReader   = () => {
  const addr =
    ADDR.TOKEN_REWARDS_READER ??
    ADDR.TokenRewardsReader ??
    null;
  if (!addr) throw new Error("TokenRewardsReader address not configured in ADDR (expected TOKEN_REWARDS_READER)");
  const abi = ABI_TokenRewardsReader.length ? ABI_TokenRewardsReader : ABI_TOKEN_REWARDS;
  return _mkRW(addr, abi);
};

// BiggiTokenReader (token-centric snapshot helper)
export const getBiggiTokenReaderRO = (provider) => {
  const addr =
    ADDR.BIGGI_TOKEN_READER ??
    ADDR.LM_READER ??
    ADDR.RESERVE_READER ??
    null;
  if (!addr) throw new Error("BiggiTokenReader address not configured in ADDR (expected *_READER)");
  const abi = ABI_BiggiTokenReader.length ? ABI_BiggiTokenReader : ABI_BiggiTokenomicsReader;
  return _mkRO(addr, abi, provider);
};
export const getBiggiTokenReader   = () => {
  const addr =
    ADDR.BIGGI_TOKEN_READER ??
    ADDR.LM_READER ??
    ADDR.RESERVE_READER ??
    null;
  if (!addr) throw new Error("BiggiTokenReader address not configured in ADDR (expected *_READER)");
  const abi = ABI_BiggiTokenReader.length ? ABI_BiggiTokenReader : ABI_BiggiTokenomicsReader;
  return _mkRW(addr, abi);
};

// BiggiTokenomicsReader
export const getBiggiTokenomicsReaderRO = (provider) => {
  const addr = ADDR.BIGGI_TOKENOMICS_READER ?? null;
  if (!addr) throw new Error("BiggiTokenomicsReader address not configured in ADDR (expected BIGGI_TOKENOMICS_READER)");
  const abi = ABI_BiggiTokenomicsReader.length ? ABI_BiggiTokenomicsReader : (ABI_ReserveReader || ABI_LiquidityManagerReader || ABI_READER);
  return _mkRO(addr, abi, provider);
};
export const getBiggiTokenomicsReader   = () => {
  const addr = ADDR.BIGGI_TOKENOMICS_READER ?? null;
  if (!addr) throw new Error("BiggiTokenomicsReader address not configured in ADDR (expected BIGGI_TOKENOMICS_READER)");
  const abi = ABI_BiggiTokenomicsReader.length ? ABI_BiggiTokenomicsReader : (ABI_ReserveReader || ABI_LiquidityManagerReader || ABI_READER);
  return _mkRW(addr, abi);
};

/* ---------------- New explicit factories for newly added contracts ---------------- */

/* NFTRewards (viewer + claim) */
export const getNFTRewardsRO = (provider) => {
  const addr =
    ADDR.NFT_REWARDS ??
    ADDR.NFTRewards ??
    ADDR.NFT_REWARDS_CONTRACT ??
    ADDR.NFT_REWARDS_READER ??
    null;
  if (!addr) throw new Error("NFTRewards address not configured in ADDR (expected NFT_REWARDS)");
  const abi = Array.isArray(ABI_NFTREWARDS) && ABI_NFTREWARDS.length ? ABI_NFTREWARDS : ABI_NFTRewardsReader || ABI_READER;
  return _mkRO(addr, abi, provider);
};
export const getNFTRewards = () => {
  const addr =
    ADDR.NFT_REWARDS ??
    ADDR.NFTRewards ??
    ADDR.NFT_REWARDS_CONTRACT ??
    ADDR.NFT_REWARDS_READER ??
    null;
  if (!addr) throw new Error("NFTRewards address not configured in ADDR (expected NFT_REWARDS)");
  const abi = Array.isArray(ABI_NFTREWARDS) && ABI_NFTREWARDS.length ? ABI_NFTREWARDS : ABI_NFTRewardsReader || ABI_READER;
  return _mkRW(addr, abi);
};

/* Events / Pool (viewer + claim) */
export const getEventsRO = (provider) => {
  const addr =
    ADDR.EVENTS ??
    ADDR.Events ??
    ADDR.EVENTS_CONTRACT ??
    ADDR.EVENTS_READER ??
    null;
  if (!addr) throw new Error("Events address not configured in ADDR (expected EVENTS)");
  const abi = Array.isArray(ABI_EVENTS) && ABI_EVENTS.length ? ABI_EVENTS : ABI_READER;
  return _mkRO(addr, abi, provider);
};
export const getEvents = () => {
  const addr =
    ADDR.EVENTS ??
    ADDR.Events ??
    ADDR.EVENTS_CONTRACT ??
    ADDR.EVENTS_READER ??
    null;
  if (!addr) throw new Error("Events address not configured in ADDR (expected EVENTS)");
  const abi = Array.isArray(ABI_EVENTS) && ABI_EVENTS.length ? ABI_EVENTS : ABI_READER;
  return _mkRW(addr, abi);
};

/* Drip Liquidity Manager */
export const getDripLMRO = (provider) => {
  const addr =
    ADDR.DRIP_LM ??
    ADDR.DRIPLM ??
    ADDR.DRIP_LIQUIDITY_MANAGER ??
    null;
  if (!addr) throw new Error("DripLM address not configured in ADDR (expected DRIP_LM / DRIPLM)");
  const abi = Array.isArray(ABI_DRIPLM) && ABI_DRIPLM.length ? ABI_DRIPLM : ABI_LM || ABI_READER;
  return _mkRO(addr, abi, provider);
};
export const getDripLM = () => {
  const addr =
    ADDR.DRIP_LM ??
    ADDR.DRIPLM ??
    ADDR.DRIP_LIQUIDITY_MANAGER ??
    null;
  if (!addr) throw new Error("DripLM address not configured in ADDR (expected DRIP_LM / DRIPLM)");
  const abi = Array.isArray(ABI_DRIPLM) && ABI_DRIPLM.length ? ABI_DRIPLM : ABI_LM || ABI_READER;
  return _mkRW(addr, abi);
};

/* Events / NFTReaders already added above; if you need more reader aliases add here */

/* ---------------- Helpers ---------------- */
export const toWei   = (n)  => _parseEther(String(n));
export const fromWei = (bn) => Number(_formatEther(bn));

/* -------- Compat for older code -------- */
function _looksLikeProvider(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      (typeof value.getNetwork === "function" ||
        typeof value.call === "function" ||
        // ethers v5 providers have this
        value._isProvider)
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
export function getReadOnlyContract(kindOrAddressOrProvider, abiOrProvider, providerOverride) {
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
    const provider = _looksLikeProvider(providerOverride) ? providerOverride : undefined;
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
    main: { addr: () => ADDR.MAIN, abi: ABI_MAIN },
    main2: { addr: () => ADDR.MAIN2, abi: ABI_MAIN2 },
    token: { addr: () => ADDR.BIGGI, abi: ABI_TOKEN },
    biggi: { addr: () => ADDR.BIGGI, abi: ABI_TOKEN },
    vrf: { addr: () => ADDR.VRF_ROUTER, abi: ABI_VRF },
    distributor: { addr: () => ADDR.DISTRIBUTOR, abi: ABI_DISTRIBUTOR },
    reserve: { addr: () => ADDR.RESERVE, abi: ABI_RESERVE },
    treasury: { addr: () => ADDR.TREASURY, abi: ABI_TREASURY },
    buyback: { addr: () => ADDR.BUYBACK_AGENT, abi: ABI_BUYBACK },
    buybackagent: { addr: () => ADDR.BUYBACK_AGENT, abi: ABI_BUYBACK },
    policy: { addr: () => ADDR.POLICY, abi: ABI_POLICY },
    compute: { addr: () => ADDR.COMPUTE, abi: ABI_COMPUTE },
    liquidityautomation: { addr: () => ADDR.LIQUIDITY_AUTOMATION, abi: ABI_LIQUIDITY_AUTOMATION },
    liquiditysetup: { addr: () => ADDR.LIQUIDITY_SETUP, abi: ABI_LIQUIDITY_SETUP },
    dripdistributor: { addr: () => ADDR.DRIP_DISTRIBUTOR, abi: ABI_DRIP_DISTRIBUTOR },
    driplm: { addr: () => ADDR.DRIP_LM ?? ADDR.DRIPLM ?? ADDR.DRIP_LIQUIDITY_MANAGER, abi: ABI_DRIPLM },
    dripkeeper: { addr: () => ADDR.DRIP_KEEPER_PROXY ?? ADDR.DRIP_KEEPER, abi: ABI_DRIP_KEEPER },
    tokenrewards: { addr: () => ADDR.TOKEN_REWARDS, abi: ABI_TOKEN_REWARDS },
    collectionrewards: { addr: () => ADDR.COLLECTION_REWARDS, abi: ABI_COLLECTION_REWARDS },
    nftrewards: { addr: () => ADDR.NFT_REWARDS, abi: Array.isArray(ABI_NFTREWARDS) && ABI_NFTREWARDS.length ? ABI_NFTREWARDS : ABI_READER },
    liquidityvault: { addr: () => ADDR.LIQUIDITY_VAULT, abi: ABI_LIQUIDITY_VAULT },
    liquiditymanager: { addr: () => ADDR.LM, abi: ABI_LM },
    lm: { addr: () => ADDR.LM, abi: ABI_LM },
    router: { addr: () => ADDR.ROUTER, abi: ABI_ROUTER },
    factory: { addr: () => ADDR.FACTORY, abi: ABI_FACTORY },
    pair: { addr: () => ADDR.PAIR, abi: ABI_PAIR },
    reader: { addr: () => ADDR.READER, abi: ABI_READER },
    mainreader: { addr: () => ADDR.MAIN_READER || ADDR.READER, abi: ABI_BiggiMainReader || ABI_READER },
    biggitokenomicsreader: { addr: () => ADDR.BIGGI_TOKENOMICS_READER, abi: ABI_BiggiTokenomicsReader || ABI_READER },
    tokenomicsreader: { addr: () => ADDR.BIGGI_TOKENOMICS_READER, abi: ABI_BiggiTokenomicsReader || ABI_READER },
    biggirewardsreader: { addr: () => ADDR.BIGGI_REWARDS_READER || ADDR.COLLECTION_REWARDS_READER, abi: ABI_BiggiRewardsReader || ABI_READER },
    rewardsreader: { addr: () => ADDR.BIGGI_REWARDS_READER || ADDR.COLLECTION_REWARDS_READER, abi: ABI_BiggiRewardsReader || ABI_READER },
  };

  const entry = kindMap[kind];
  if (!entry) {
    // Fallback to MAIN (prevents accidental passing of "distributor" as provider)
    console.warn(`getReadOnlyContract: unknown kind '${input}', falling back to MAIN`);
    return getReadOnlyMain(provider);
  }

  const addr = entry.addr();
  if (!addr) throw new Error(`getReadOnlyContract: address not configured for kind '${input}'`);
  return _mkRO(addr, abi || entry.abi || ABI_READER, provider);
}
export const getContract         = getMain;

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
        if (typeof lm.liquidityPreview === "function") return lm.liquidityPreview();
      } catch {
        // ignore parsing failure for this part
      }
      const prov = signerMode ? getSignerProvider() : getROProvider();
      const addr = ADDR.BUYBACK_AGENT;
      const bal = await prov.getBalance(addr).catch(() => ethers.constants.Zero);
      return [bal, 0, 0, 0, 0];
    };
  }
  return target;
}

export function getLMRO() {
  const merged = _mergeTargets(getTokenRewardsRO(), getBuybackRO(), getLMRawRO());
  return _attachHelpers(merged, false);
}
export async function getLM() {
  const merged = _mergeTargets(await getTokenRewards(), await getBuyback(), await getLMRaw());
  return _attachHelpers(merged, true);
}
export function getReadOnlyLiquidityContract() { return getLMRO(); }
export async function getLiquidityContract() { return getLM(); }

export async function resolveTicketPriceWeiFromHub() {
  const c = getReadOnlyMain();
  const tryFns = ["getTicketPrice", "ticketPrice", "getTicketPriceWei", "ticketPriceWei"];
  for (const name of tryFns) {
    const f = c[name];
    if (typeof f === "function") {
      try {
        const v = await f();
        if (v != null) return ethers.BigNumber.from(v);
      } catch {
        // try next candidate
      }
    }
  }
  const reader = getReaderRO();
  try {
    const snap = await reader.getFrontendSnapshotLite();
    const wei = Array.isArray(snap) ? snap[0] : snap?.ticketPriceWei;
    if (wei != null) return ethers.BigNumber.from(wei);
  } catch {
    // ignore reader failure, will throw below
  }
  throw new Error("Ticket price unavailable");
}
