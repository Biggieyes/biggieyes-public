// src/utils/contract.js
// Ethers v6 helpers and contract factories
import { BrowserProvider, Contract, FallbackProvider, JsonRpcProvider, Network, parseEther, formatEther } from "ethers";
import { ADDR } from "./addresses.js";
import {
  AMOY,
  PUBLIC_AMOY_RPCS,
  getWalletRpcUrls,
  getPreferredRpc,
  getRpcUrls,
  setPreferredRpc,
} from "./rpcConfig.js";
import {
  BiggiBuybackAgent,
  BiggiCollectionRewards,
  BiggiDRIPDistributor,
  BiggiLiquidityHelperReader,
  BiggiDRIPKeeper,
  BiggiDRIPLM,
  BiggiLiquidityBranchUserReader,
  BiggiLiquidityManager,
  BiggiNftRewards,
  BiggiPolicy,
  BiggiReserveV4,
  BiggiMultiCollectionDistributor,
  BiggiMultiCollectionDistributorReader,
  BiggiMultiCollectionDistributorReaderV2,
  BiggiToken,
  BiggiMainReader,
  BiggiTokenomikReader,
  BiggiTokenRewards,
  BiggiTreasury,
  BiggiUpkeeperProxy,
  BiggiVRFRouter,
  LiquidityAutomation,
  LiquidityVault,
  UniswapV2Factory,
  UniswapV2Pair,
  UniswapV2Router02,
  BiggiMain,
  BiggiMain2,
  BiggiReserveTreasuryReader,
} from "@/config/abi/index.js";

// ABI aliases
const ABI_NFTREWARDS = BiggiNftRewards;
const ABI_DRIPLM = BiggiDRIPLM;
const ABI_LIQUIDITY_VAULT = LiquidityVault;
const ABI_MULTI_COLLECTION_DISTRIBUTOR = BiggiMultiCollectionDistributor;
const ABI_MULTI_COLLECTION_DISTRIBUTOR_V2 =
  BiggiMultiCollectionDistributorReaderV2;

// Map missing ABIs to available ones or fallback
const ABI_BiggiMainReader = BiggiMainReader;
const ABI_BiggiMain2 = BiggiMain2;
const ABI_NFTREWARDSReader = BiggiNftRewards;
const ABI_BiggiREWARDSReader = BiggiMultiCollectionDistributorReaderV2;
const ABI_BiggiTokenomicsReader = BiggiTokenomikReader;
const ABI_ReserveReader = BiggiReserveV4;
const ABI_LiquidityManagerReader = BiggiLiquidityBranchUserReader;
const ABI_BiggiTokenReader = BiggiToken;
const ABI_COLLECTIONREWARDSReader = BiggiCollectionRewards;
// Reader aliases
export const ABI_REWARDS_READER = BiggiMultiCollectionDistributorReader;
export const ABI_VRF_READER = BiggiVRFRouter;
export const ABI_LIQUIDITY_VAULT_READER = LiquidityVault;
export const ABI_LIQUIDITY_HELPER_READER = BiggiLiquidityHelperReader;
export const ABI_RESERVE_TREASURY_READER = BiggiReserveTreasuryReader;

// Factory for MultiCollectionDistributor (read-only)
export const getMultiCollectionDistributorRO = (provider) => {
  const addr =
    ADDR.MCD_READER_V2 ||
    ADDR.MULTI_COLLECTION_DISTRIBUTOR_READER ||
    ADDR.MULTI_COLLECTION_DISTRIBUTOR;
  return _mkRO(addr, ABI_MULTI_COLLECTION_DISTRIBUTOR_V2, provider);
};
// Factory for MultiCollectionDistributor (read-write)
export const getMultiCollectionDistributor = async (signerOverride) =>
  _mkRW(
    ADDR.MULTI_COLLECTION_DISTRIBUTOR,
    ABI_MULTI_COLLECTION_DISTRIBUTOR,
    signerOverride,
  );
const ABI_READER = BiggiMainReader;
const ABI_LIQUIDITY_HELPER = BiggiLiquidityHelperReader;
const ABI_RESERVE_TREASURY = BiggiReserveTreasuryReader;
const ABI_COLLECTION_VRF = BiggiMain;
const ABI_COLLECTION_PUBLIC = BiggiMain2;
const ABI_VRF = BiggiVRFRouter;
const ABI_TOKEN = BiggiToken;
const ABI_DISTRIBUTOR = BiggiMultiCollectionDistributor;
const ABI_RESERVE = BiggiReserveV4;
const ABI_TREASURY = BiggiTreasury;
const ABI_BUYBACK = BiggiBuybackAgent;
const ABI_POLICY = BiggiPolicy;
const ABI_LIQUIDITY_AUTOMATION = LiquidityAutomation;
const ABI_TOKEN_REWARDS = BiggiTokenRewards;
const ABI_COLLECTION_REWARDS = BiggiCollectionRewards;
const ABI_DRIP_DISTRIBUTOR = BiggiDRIPDistributor;
const ABI_DRIP_KEEPER = BiggiDRIPKeeper;
const ABI_FACTORY = UniswapV2Factory;
const ABI_ROUTER = UniswapV2Router02;
const ABI_PAIR = UniswapV2Pair;
const ABI_LM = BiggiLiquidityManager;
const ABI_UPKEEP = BiggiUpkeeperProxy;

const LOCAL_STORAGE_RPC_SYNC_KEY = "biggi_amoy_rpc_sync_fingerprint_v2";

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
let _roProviderCacheKey = "";
let _roProviderCreatedAt = 0;
let _signerProvider = undefined;
let _signerProviderSource = null;
let _signerProviderCreatedAt = 0;
let _injectedProviderOverride = null;

function _emitInjectedProviderChanged() {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("biggi:injected-provider-changed", {
        detail: { hasOverride: Boolean(_injectedProviderOverride) },
      }),
    );
  } catch {
    // ignore event dispatch failures
  }
}

function _getWindowInjectedProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

function _getEffectiveInjectedProvider() {
  return _injectedProviderOverride || _getWindowInjectedProvider();
}

export function setInjectedProvider(provider) {
  _injectedProviderOverride = provider || null;
  resetROProvider();
  resetSignerProvider();
  _emitInjectedProviderChanged();
  return _getEffectiveInjectedProvider();
}

export function clearInjectedProvider() {
  _injectedProviderOverride = null;
  resetROProvider();
  resetSignerProvider();
  _emitInjectedProviderChanged();
}

export function getInjectedProvider() {
  return _getEffectiveInjectedProvider();
}

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
  const network = Network.from({ chainId: AMOY.chainId, name: AMOY.name });
  return new JsonRpcProvider(url, network, { staticNetwork: network });
}

function _resolveROProviderMaxAgeMs() {
  const configured = Number(_env("VITE_RO_PROVIDER_MAX_AGE_MS"));
  if (Number.isFinite(configured) && configured >= 0)
    return Math.trunc(configured);
  return 45_000;
}

function _resolveSignerProviderMaxAgeMs() {
  const configured = Number(_env("VITE_SIGNER_PROVIDER_MAX_AGE_MS"));
  if (Number.isFinite(configured) && configured >= 0)
    return Math.trunc(configured);
  return 45_000;
}

function _cacheROProvider(provider, cacheKey) {
  _roProvider = _applyPollingInterval(provider);
  _roProviderCacheKey = cacheKey;
  _roProviderCreatedAt = Date.now();
  return _roProvider;
}

export function getROProvider() {
  const urls = getRpcUrls();
  if (!urls.length) {
    throw new Error(
      "No RPC endpoints configured for Polygon Amoy. Set VITE_JSON_RPC_URL or VITE_AMOY_RPC_URL.",
    );
  }

  // Prefer injected if allowed and on the right chain
  const preferInjectedEnv = _env("VITE_PREFER_INJECTED") === "true"; // default false
  const ethereum = _getEffectiveInjectedProvider();
  const hasSelectedAddress = Boolean(ethereum?.selectedAddress);
  const isConnected = Boolean(
    hasSelectedAddress ||
      (typeof ethereum?.isConnected === "function" && ethereum.isConnected()),
  );
  const preferInjected = preferInjectedEnv && isConnected;
  const forceRpc = _env("VITE_FORCE_RPC") === "1";

  const injectedChainId = (() => {
    try {
      if (!ethereum) return null;
      const raw = ethereum.chainId ?? ethereum.networkVersion;
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
  const useInjected = !forceRpc && preferInjected && allowInjected && ethereum;
  const cacheKey = `${useInjected ? "inj" : "rpc"}|${urls.join("|")}`;
  const maxAgeMs = _resolveROProviderMaxAgeMs();
  if (_roProvider && _roProviderCacheKey === cacheKey) {
    const isFresh =
      maxAgeMs <= 0 || Date.now() - _roProviderCreatedAt <= maxAgeMs;
    if (isFresh) return _roProvider;
  }

  if (useInjected) {
    try {
      return _cacheROProvider(new BrowserProvider(ethereum, "any"), cacheKey);
    } catch (err) {
      console.warn(
        "getROProvider: failed to use injected provider, falling back to RPC:",
        err?.message || err,
      );
    }
  }

  // RPC path (synchronous, no async health probes to avoid invalid provider objects)
  if (urls[0] && getPreferredRpc() !== urls[0]) {
    setPreferredRpc(urls[0]);
  }

  if (urls.length === 1) {
    return _cacheROProvider(_mkRpcProvider(urls[0]), cacheKey);
  }

  const configs = urls.map((url, index) => ({
    provider: _mkRpcProvider(url),
    priority: index + 1,
    stallTimeout: 1500,
    weight: 1,
  }));

  try {
    return _cacheROProvider(
      new FallbackProvider(configs, AMOY.chainId, { quorum: 1 }),
      cacheKey,
    );
  } catch (err) {
    console.warn(
      "getROProvider: FallbackProvider construction failed, using first RPC:",
      err?.message || err,
    );
    return _cacheROProvider(_mkRpcProvider(urls[0]), cacheKey);
  }
}

export function getProviderForContract(contract) {
  const direct = contract?.provider;
  if (direct && typeof direct.getNetwork === "function") return direct;
  const runner = contract?.runner;
  if (runner?.provider && typeof runner.provider.getNetwork === "function")
    return runner.provider;
  if (runner && typeof runner.getNetwork === "function") return runner;
  try {
    return getROProvider();
  } catch {
    return null;
  }
}

export function resetROProvider() {
  _roProvider = undefined;
  _roProviderCacheKey = "";
  _roProviderCreatedAt = 0;
}

export function resetSignerProvider() {
  _signerProvider = undefined;
  _signerProviderSource = null;
  _signerProviderCreatedAt = 0;
}

export function getSignerProvider() {
  const injected = _getEffectiveInjectedProvider();
  if (!injected) {
    throw new Error("Injected provider not available");
  }
  const maxAgeMs = _resolveSignerProviderMaxAgeMs();
  const hasFreshSignerProvider =
    _signerProvider &&
    _signerProviderSource === injected &&
    (maxAgeMs <= 0 || Date.now() - _signerProviderCreatedAt <= maxAgeMs);
  if (hasFreshSignerProvider) return _signerProvider;
  const provider = _applyPollingInterval(new BrowserProvider(injected, "any"));
  _signerProvider = provider;
  _signerProviderSource = injected;
  _signerProviderCreatedAt = Date.now();
  return _signerProvider;
}

function _hasRequest(provider) {
  return provider && typeof provider.request === "function";
}

function _getRpcSyncFingerprint(rpcUrls = null) {
  const urls = Array.isArray(rpcUrls) ? rpcUrls : getWalletRpcUrls();
  const joined = Array.isArray(urls)
    ? urls
        .map((url) => String(url || "").trim())
        .filter(Boolean)
        .join("|")
    : "";
  return `${AMOY.chainId}:${joined}`;
}

function _markRpcSynced(rpcUrls = null) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(
        LOCAL_STORAGE_RPC_SYNC_KEY,
        _getRpcSyncFingerprint(rpcUrls),
      );
    }
  } catch {
    // ignore localStorage write failure
  }
}

function _hasSyncedRpc(rpcUrls = null) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return (
        window.localStorage.getItem(LOCAL_STORAGE_RPC_SYNC_KEY) ===
        _getRpcSyncFingerprint(rpcUrls)
      );
    }
  } catch {
    // ignore localStorage read failure
  }
  return false;
}

export async function syncAmoyRpcIfNeeded(
  externalProvider,
  { force = false, preferPublicFirst = false } = {},
) {
  const provider = externalProvider || _getEffectiveInjectedProvider();
  if (!_hasRequest(provider))
    throw new Error("Ethereum provider not available");
  const rpcUrls = getWalletRpcUrls({ preferPublicFirst });
  if (!force && _hasSyncedRpc(rpcUrls)) return false;

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

  _markRpcSynced(rpcUrls);
  return true;
}

export async function ensureAmoy(externalProvider) {
  const provider = externalProvider || _getEffectiveInjectedProvider();
  if (!_hasRequest(provider))
    throw new Error("Ethereum provider not available");

  // Best effort update of chain metadata (RPC URLs/explorer) before switching.
  // This helps recover from stale or rate-limited RPC endpoints in existing wallets.
  try {
    await syncAmoyRpcIfNeeded(provider);
  } catch {
    // ignore sync failures; switch flow below still attempts to continue
  }

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
  const contract = new Contract(addr, resolvedAbi, p);
  // Ensure contract.provider is available across ethers v5/v6 usages.
  try {
    if (!contract.provider) {
      const fallback =
        (p && p.provider) ||
        (_looksLikeProvider(p) ? p : undefined) ||
        undefined;
      if (fallback) contract.provider = fallback;
    }
  } catch {
    // ignore if provider is read-only on the contract instance
  }
  return contract;
};

const _isSigner = (value) =>
  Boolean(
    value &&
      typeof value === "object" &&
      typeof value.getAddress === "function" &&
      typeof value.signMessage === "function",
  );

const _resolveSigner = async (signerProvider) => {
  if (_isSigner(signerProvider)) return signerProvider;
  const prov =
    signerProvider && _looksLikeProvider(signerProvider)
      ? signerProvider
      : getSignerProvider();
  if (!prov || typeof prov.getSigner !== "function") {
    throw new Error("Signer provider not available");
  }
  return await prov.getSigner();
};

const _mkRW = async (addr, abi, signerProvider) => {
  if (!addr) throw new Error("Contract address not configured (addr is falsy)");
  const resolvedAbi = _resolveABI(abi, ABI_READER);
  if (!resolvedAbi.length)
    console.warn(
      `Creating write contract for ${addr} with empty ABI — calls will fail.`,
    );
  const signer = await _resolveSigner(signerProvider);
  const contract = new Contract(addr, resolvedAbi, signer);
  // Ensure contract.provider is available for downstream reads.
  try {
    if (!contract.provider) contract.provider = signer?.provider;
  } catch {
    // ignore if provider is read-only on the contract instance
  }
  return contract;
};

/* ---------------- Exports (contract factories) ---------------- */

/* Core contracts */
export const getReadOnlyMain = (provider) =>
  _mkRO(MAIN_ADDR_ACTIVE, ABI_MAIN_ACTIVE, provider);
export const getMain = async (signerOverride) =>
  _mkRW(MAIN_ADDR_ACTIVE, ABI_MAIN_ACTIVE, signerOverride);

export const getReadOnlyMain2 = (provider) => {
  const addr = ADDR.MAIN2;
  const useMainAbi =
    _sameAddr(addr, ADDR.MAIN) || _sameAddr(addr, ADDR.COLLECTION_VRF);
  const abi = useMainAbi ? ABI_MAIN : ABI_BiggiMain2;
  return _mkRO(addr, abi, provider);
};
export const getMain2 = async (signerOverride) => {
  const addr = ADDR.MAIN2;
  const useMainAbi =
    _sameAddr(addr, ADDR.MAIN) || _sameAddr(addr, ADDR.COLLECTION_VRF);
  const abi = useMainAbi ? ABI_MAIN : ABI_BiggiMain2;
  return _mkRW(addr, abi, signerOverride);
};
export const getCOLLECTIONVRFRO = (provider) =>
  _mkRO(ADDR.COLLECTION_VRF || ADDR.MAIN, ABI_COLLECTION_VRF, provider);
export const getCOLLECTIONVRF = async (signerOverride) =>
  _mkRW(ADDR.COLLECTION_VRF || ADDR.MAIN, ABI_COLLECTION_VRF, signerOverride);
export const getCOLLECTIONPublicRO = (provider) => {
  const addr = ADDR.COLLECTION_PUBLIC || ADDR.MAIN2;
  const useMainAbi =
    _sameAddr(addr, ADDR.MAIN) || _sameAddr(addr, ADDR.COLLECTION_VRF);
  const abi = useMainAbi ? ABI_MAIN : ABI_COLLECTION_PUBLIC;
  return _mkRO(addr, abi, provider);
};
export const getCOLLECTIONPublic = async (signerOverride) => {
  const addr = ADDR.COLLECTION_PUBLIC || ADDR.MAIN2;
  const useMainAbi =
    _sameAddr(addr, ADDR.MAIN) || _sameAddr(addr, ADDR.COLLECTION_VRF);
  const abi = useMainAbi ? ABI_MAIN : ABI_COLLECTION_PUBLIC;
  return _mkRW(addr, abi, signerOverride);
};

export const getVRFRO = (provider) => {
  if (!ADDR.VRF_ROUTER) {
    console.warn("getVRFRO: VRF router address not configured; returning null");
    return null;
  }
  return _mkRO(ADDR.VRF_ROUTER, ABI_VRF, provider);
};
export const getVRF = async (signerOverride) => {
  if (!ADDR.VRF_ROUTER) {
    throw new Error("VRF router address not configured");
  }
  return _mkRW(ADDR.VRF_ROUTER, ABI_VRF, signerOverride);
};

export const getTokenRO = (provider) => _mkRO(ADDR.BIGGI, ABI_TOKEN, provider);
export const getToken = async (signerOverride) =>
  _mkRW(ADDR.BIGGI, ABI_TOKEN, signerOverride);

export const getDistributorRO = (provider) =>
  _mkRO(ADDR.DISTRIBUTOR, ABI_DISTRIBUTOR, provider);
export const getDistributor = async (signerOverride) =>
  _mkRW(ADDR.DISTRIBUTOR, ABI_DISTRIBUTOR, signerOverride);

export const getReserveRO = (provider) => {
  const reserve = _mkRO(ADDR.RESERVE, ABI_RESERVE, provider);
  try {
    const rtReader = getReserveTreasuryReaderRO(provider);
    const readSnap = async () => {
      const snap = await rtReader.reserveSnapshot();
      return {
        reservePol: snap?.reservePol ?? snap?.[0] ?? 0n,
        reserveBiggi: snap?.reserveBiggi ?? snap?.[1] ?? 0n,
        waiting: snap?.waiting ?? snap?.[2] ?? 0n,
        dexRefill: snap?.dexRefill ?? snap?.[3] ?? 0n,
        totalReceived: snap?.totalReceivedPol ?? snap?.[4] ?? 0n,
      };
    };
    reserve.maticBalance = async () => (await readSnap()).reservePol;
    reserve.totalMaticReceived = async () => (await readSnap()).totalReceived;
    reserve.waitingBiggi = async () => (await readSnap()).waiting;
    reserve.dexRefillBiggi = async () => (await readSnap()).dexRefill;
    reserve.biggiBalance = async () => (await readSnap()).reserveBiggi;
  } catch {
    // best-effort compatibility shim
  }
  return reserve;
};
export const getReserve = async (signerOverride) =>
  _mkRW(ADDR.RESERVE, ABI_RESERVE, signerOverride);

export const getTreasuryRO = (provider) => {
  const treasury = _mkRO(ADDR.TREASURY, ABI_TREASURY, provider);
  try {
    const rtReader = getReserveTreasuryReaderRO(provider);
    const readSnap = async () => {
      const snap = await rtReader.treasurySnapshot();
      return {
        treasuryPol: snap?.treasuryPol ?? snap?.[0] ?? 0n,
        treasuryBiggi: snap?.treasuryBiggi ?? snap?.[1] ?? 0n,
        totalBiggiFromBuyback: snap?.totalBiggiFromBuyback ?? snap?.[2] ?? 0n,
        totalPolFromDistributor:
          snap?.totalPolFromDistributor ?? snap?.[3] ?? 0n,
      };
    };
    treasury.maticBalance = async () => (await readSnap()).treasuryPol;
    treasury.totalMaticReceived = async () =>
      (await readSnap()).totalPolFromDistributor;
    treasury.totalMaticReceivedFromDistributor = async () =>
      (await readSnap()).totalPolFromDistributor;
  } catch {
    // optional shim
  }
  return treasury;
};
export const getTreasury = async (signerOverride) =>
  _mkRW(ADDR.TREASURY, ABI_TREASURY, signerOverride);

export const getBUYBACKRO = (provider) =>
  _mkRO(ADDR.BUYBACK_AGENT, ABI_BUYBACK, provider);
export const getBUYBACK = async (signerOverride) =>
  _mkRW(ADDR.BUYBACK_AGENT, ABI_BUYBACK, signerOverride);

export const getPOLICYRO = (provider) =>
  _mkRO(ADDR.POLICY, ABI_POLICY, provider);
export const getPOLICY = async (signerOverride) =>
  _mkRW(ADDR.POLICY, ABI_POLICY, signerOverride);

export const getLiquidityAutomationRO = (provider) => {
  const addr = ADDR.LIQUIDITY_AUTOMATION ?? null;
  if (!addr) {
    console.warn("getLiquidityAutomationRO: address not configured");
    return null;
  }
  return _mkRO(addr, ABI_LIQUIDITY_AUTOMATION, provider);
};
export const getLiquidityAutomation = async (signerOverride) => {
  const addr = ADDR.LIQUIDITY_AUTOMATION ?? null;
  if (!addr) {
    throw new Error(
      "LiquidityAutomation address not configured in ADDR (expected LIQUIDITY_AUTOMATION)",
    );
  }
  return _mkRW(addr, ABI_LIQUIDITY_AUTOMATION, signerOverride);
};

export const getTokenREWARDSRO = (provider) =>
  _mkRO(ADDR.TOKEN_REWARDS, ABI_TOKEN_REWARDS, provider);
export const getTokenREWARDS = async (signerOverride) =>
  _mkRW(ADDR.TOKEN_REWARDS, ABI_TOKEN_REWARDS, signerOverride);

export const getCOLLECTIONREWARDSRO = (provider) =>
  _mkRO(ADDR.COLLECTION_REWARDS, ABI_COLLECTION_REWARDS, provider);
export const getCOLLECTIONREWARDS = async (signerOverride) =>
  _mkRW(ADDR.COLLECTION_REWARDS, ABI_COLLECTION_REWARDS, signerOverride);

export const getDRIPDistributorRO = (provider) => {
  const addr = ADDR.DRIP_DISTRIBUTOR ?? null;
  if (!addr) {
    console.warn("getDRIPDistributorRO: address not configured");
    return null;
  }
  return _mkRO(addr, ABI_DRIP_DISTRIBUTOR, provider);
};
export const getDRIPDistributor = async (signerOverride) => {
  const addr = ADDR.DRIP_DISTRIBUTOR ?? null;
  if (!addr) {
    throw new Error(
      "DRIPDistributor address not configured in ADDR (expected DRIP_DISTRIBUTOR)",
    );
  }
  return _mkRW(addr, ABI_DRIP_DISTRIBUTOR, signerOverride);
};

export const getDRIPKeeperRO = (provider) => {
  const addr = ADDR.DRIP_KEEPER_PROXY ?? ADDR.DRIP_KEEPER ?? null;
  if (!addr)
    throw new Error(
      "DRIPKeeper address not configured in ADDR (expected DRIP_KEEPER_PROXY)",
    );
  return _mkRO(addr, ABI_DRIP_KEEPER, provider);
};
export const getDRIPKeeper = async (signerOverride) => {
  const addr = ADDR.DRIP_KEEPER_PROXY ?? ADDR.DRIP_KEEPER ?? null;
  if (!addr)
    throw new Error(
      "DRIPKeeper address not configured in ADDR (expected DRIP_KEEPER_PROXY)",
    );
  return _mkRW(addr, ABI_DRIP_KEEPER, signerOverride);
};

// legacy aliases
export const getREWARDSRO = getCOLLECTIONREWARDSRO;
export const getREWARDS = getCOLLECTIONREWARDS;

export const getFactoryRO = (provider) =>
  _mkRO(ADDR.FACTORY, ABI_FACTORY, provider);
export const getRouter = async (signerOverride) =>
  _mkRW(ADDR.ROUTER, ABI_ROUTER, signerOverride);
export const getRouterRO = (provider) =>
  _mkRO(ADDR.ROUTER, ABI_ROUTER, provider);
export const getPairRO = (provider) => _mkRO(ADDR.PAIR, ABI_PAIR, provider);

export const getLMRawRO = (provider) => _mkRO(ADDR.LM, ABI_LM, provider);
export const getLMRaw = async (signerOverride) =>
  _mkRW(ADDR.LM, ABI_LM, signerOverride);

export const getUpkeepRO = (provider) =>
  _mkRO(ADDR.UPKEEP_PROXY, ABI_UPKEEP, provider);
export const getUpkeep = async (signerOverride) =>
  _mkRW(ADDR.UPKEEP_PROXY, ABI_UPKEEP, signerOverride);

export const getLiquidityHelperRO = (provider) =>
  _mkRO(ADDR.LIQ_HELPER_READER, ABI_LIQUIDITY_HELPER, provider);

export const getReserveTreasuryReaderRO = (provider) => {
  const addr =
    ADDR.RESERVE_TREASURY_READER ||
    ADDR.RESERVE_READER ||
    ADDR.TREASURY_READER;
  if (!addr)
    throw new Error(
      "Reserve/Treasury reader address not configured (RESERVE_TREASURY_READER).",
    );
  return _mkRO(addr, ABI_RESERVE_TREASURY, provider);
};

export const getMultiCollectionDistributorReaderV2RO = (provider) =>
  _mkRO(
    ADDR.MCD_READER_V2 || ADDR.MULTI_COLLECTION_DISTRIBUTOR_READER,
    ABI_MULTI_COLLECTION_DISTRIBUTOR_V2,
    provider,
  );

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
export const getBiggiMainReader = async (signerOverride) => {
  const addr = ADDR.READER ?? ADDR.MAIN_READER ?? null;
  if (!addr)
    throw new Error(
      "BiggiMainReader address not configured in ADDR (expected MAIN_READER or READER)",
    );
  const abi = ABI_BiggiMainReader.length ? ABI_BiggiMainReader : ABI_READER;
  return _mkRW(addr, abi, signerOverride);
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
export const getBiggiREWARDSReader = async (signerOverride) => {
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
  return _mkRW(addr, abi, signerOverride);
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
export const getBiggiTokenReader = async (signerOverride) => {
  const addr =
    ADDR.BIGGI_TOKEN_READER ?? ADDR.LM_READER ?? ADDR.RESERVE_READER ?? null;
  if (!addr)
    throw new Error(
      "BiggiTokenReader address not configured in ADDR (expected *_READER)",
    );
  const abi = ABI_BiggiTokenReader.length
    ? ABI_BiggiTokenReader
    : ABI_BiggiTokenomicsReader;
  return _mkRW(addr, abi, signerOverride);
};

export const getLiquidityHelperReaderRO = (provider) =>
  getLiquidityHelperRO(provider);
export const getReserveTreasurySnapshotRO = (provider) =>
  getReserveTreasuryReaderRO(provider);
export const getMCDReaderV2RO = (provider) =>
  getMultiCollectionDistributorReaderV2RO(provider);

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
export const getBiggiTokenomicsReader = async (signerOverride) => {
  const addr = ADDR.BIGGI_TOKENOMICS_READER ?? null;
  if (!addr)
    throw new Error(
      "BiggiTokenomicsReader address not configured in ADDR (expected BIGGI_TOKENOMICS_READER)",
    );
  const abi = ABI_BiggiTokenomicsReader.length
    ? ABI_BiggiTokenomicsReader
    : ABI_ReserveReader || ABI_LiquidityManagerReader || ABI_READER;
  return _mkRW(addr, abi, signerOverride);
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
export const getNFTREWARDS = async (signerOverride) => {
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
  return _mkRW(addr, abi, signerOverride);
};

/* DRIP Liquidity Manager (disabled) */
export const getDRIPLMRO = (provider) => {
  const addr = ADDR.DRIP_LM ?? null;
  if (!addr) {
    console.warn("getDRIPLMRO: address not configured");
    return null;
  }
  return _mkRO(addr, ABI_DRIPLM, provider);
};
export const getDRIPLM = async (signerOverride) => {
  const addr = ADDR.DRIP_LM ?? null;
  if (!addr) {
    throw new Error(
      "DRIPLM address not configured in ADDR (expected DRIP_LM)",
    );
  }
  return _mkRW(addr, ABI_DRIPLM, signerOverride);
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
export const getContract = getReadOnlyMain;
export const getMainRW = getMain;

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
  if (typeof target.claimStatus !== "function") {
    target.claimStatus = async () => [0n, [], []];
  }
  return target;
}

export function getLMRO() {
  const merged = _mergeTargets(
    getLiquidityHelperRO(),
    getTokenREWARDSRO(),
    getBUYBACKRO(),
    getLMRawRO(),
  );
  return _attachHelpers(merged, false);
}
export async function getLM() {
  const merged = _mergeTargets(
    getLiquidityHelperRO(),
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
