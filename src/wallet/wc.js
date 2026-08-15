// src/wallet/wc.js
import { BrowserProvider } from "ethers";
import { EthereumProvider } from "@walletconnect/ethereum-provider";
import {
  ACTIVE_CHAIN,
  PUBLIC_POLYGON_RPCS,
  getPrimaryRpcUrl,
  getWalletRpcUrls,
} from "@/shared/utils/contract";
import { getWalletConnectMobileLinks } from "@/shared/utils/mobileWallet";

const BIGGIEYES_PUBLIC_SITE_URL = "https://biggieyes.com/";
const BIGGIEYES_PUBLIC_APP_URL = "https://biggieyes.com/app/";
const BIGGIEYES_NATIVE_REDIRECT = "com.biggieyes.app://walletconnect";

// Public RPC fallback for Polygon mainnet. Prefer your own infra in production.
const DEFAULT_POLYGON_RPC =
  getPrimaryRpcUrl() || ACTIVE_CHAIN?.rpcUrl || PUBLIC_POLYGON_RPCS[0];
const DEFAULT_POLYGON_RPC_URLS = getWalletRpcUrls({ preferPublicFirst: true });

const RPC_MAP = {
  [ACTIVE_CHAIN.chainId]: DEFAULT_POLYGON_RPC,
  1: "https://cloudflare-eth.com", // Ethereum Mainnet
};
if (ACTIVE_CHAIN.chainId !== 137) RPC_MAP[137] = "https://polygon.drpc.org";

function normalizeWalletAddress(value) {
  const raw = String(value || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) return "";
  return raw;
}

async function resolveWalletConnectAccounts(provider) {
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const normalized = normalizeWalletAddress(value);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  };

  try {
    const directAccounts = await provider?.request?.({ method: "eth_accounts" });
    if (Array.isArray(directAccounts)) {
      directAccounts.forEach(push);
    }
  } catch {
    // ignore direct account lookup failures
  }

  const sessionAccounts = provider?.session?.namespaces?.eip155?.accounts;
  if (Array.isArray(sessionAccounts)) {
    sessionAccounts.forEach((entry) => {
      const parts = String(entry || "").split(":");
      push(parts[parts.length - 1] || "");
    });
  }

  if (Array.isArray(provider?.accounts)) {
    provider.accounts.forEach(push);
  }

  return out;
}

function resolvePollingIntervalMs() {
  const fromEnv = Number(
    import.meta.env.VITE_SIGNER_POLL_INTERVAL_MS ||
      import.meta.env.VITE_RPC_POLL_INTERVAL_MS ||
      8000,
  );
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.trunc(fromEnv);
  return 8000;
}

function resolvePublicSiteUrl() {
  if (typeof window !== "undefined") {
    try {
      const { origin, protocol } = window.location;
      if (protocol === "http:" || protocol === "https:") {
        return new URL("/", origin).href;
      }
    } catch {
      // ignore non-http origins
    }
  }
  return BIGGIEYES_PUBLIC_SITE_URL;
}

function resolvePublicAppUrl() {
  if (typeof window !== "undefined") {
    try {
      const { origin, protocol } = window.location;
      if (protocol === "http:" || protocol === "https:") {
        return new URL("/app/", origin).href;
      }
    } catch {
      // ignore non-http origins
    }
  }
  return BIGGIEYES_PUBLIC_APP_URL;
}

function resolveWalletMetadata() {
  const siteUrl = resolvePublicSiteUrl();
  return {
    name: "BiggiEyes",
    description: "BiggiEyes DApp",
    url: siteUrl,
    icons: [new URL("/apple-touch-icon.png", siteUrl).href],
    redirect: {
      native: BIGGIEYES_NATIVE_REDIRECT,
      universal: resolvePublicAppUrl(),
    },
  };
}

function getWalletConnectProjectId() {
  return import.meta.env.VITE_WC_PROJECT_ID;
}

function assertWalletConnectProjectId() {
  if (!getWalletConnectProjectId()) {
    throw new Error("Missing VITE_WC_PROJECT_ID in .env");
  }
}

async function initWalletConnectProvider(options = {}) {
  const {
    mobileLinks,
    qrModalOptions,
    showQrModal = true,
  } = options;
  const resolvedMobileLinks =
    Array.isArray(mobileLinks) && mobileLinks.length
      ? [...mobileLinks]
      : getWalletConnectMobileLinks();

  return await EthereumProvider.init({
    projectId: getWalletConnectProjectId(),
    chains: [ACTIVE_CHAIN.chainId],
    optionalChains: Array.from(
      new Set([137, 1].filter((id) => id !== ACTIVE_CHAIN.chainId)),
    ),
    rpcMap: RPC_MAP,
    showQrModal,
    qrModalOptions: {
      ...qrModalOptions,
      mobileLinks: resolvedMobileLinks,
    },
    methods: [
      "eth_requestAccounts",
      "eth_sendTransaction",
      "personal_sign",
      "eth_sign",
      "eth_signTypedData",
      "eth_signTypedData_v4",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
    ],
    optionalMethods: [
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "eth_signTypedData",
      "eth_signTypedData_v4",
    ],
    events: ["chainChanged", "accountsChanged", "disconnect", "session_delete"],
    metadata: resolveWalletMetadata(),
  });
}

async function buildWalletConnectSessionResult(wc) {
  const ethersProvider = new BrowserProvider(wc, "any");
  if (typeof ethersProvider.pollingInterval === "number") {
    ethersProvider.pollingInterval = resolvePollingIntervalMs();
  }

  const chainId = await resolveChainId(wc);
  if (chainId && chainId !== ACTIVE_CHAIN.chainId) {
    await ensurePolygon(wc);
  }

  const resolvedAccounts = await resolveWalletConnectAccounts(wc);
  const signer = resolvedAccounts[0]
    ? await ethersProvider.getSigner(resolvedAccounts[0])
    : await ethersProvider.getSigner();

  const address =
    resolvedAccounts[0] ||
    normalizeWalletAddress(await signer.getAddress().catch(() => ""));
  if (!address) {
    throw new Error(
      "WalletConnect session opened, but no wallet address was confirmed.",
    );
  }
  const net = await ethersProvider.getNetwork();
  const connectedChainId = Number(net?.chainId ?? 0);

  const disconnect = () => {
    try {
      wc.disconnect();
    } catch {
      // ignore disconnect cleanup errors
    }
  };

  return {
    provider: wc,
    ethersProvider,
    signer,
    address,
    chainId: connectedChainId,
    disconnect,
  };
}

export async function connectWithWalletConnect(options = {}) {
  assertWalletConnectProjectId();
  const { connectOptions, forceNewSession = false } = options;
  const wc = await initWalletConnectProvider(options);

  if (forceNewSession && wc.session) {
    try {
      await wc.disconnect();
    } catch {
      // ignore stale session cleanup errors
    }
    return await connectWithWalletConnect({
      ...options,
      forceNewSession: false,
    });
  }

  if (wc.session) {
    await wc.enable();
  } else {
    await wc.connect(connectOptions);
  }

  return await buildWalletConnectSessionResult(wc);
}

export async function restoreWalletConnectSession(options = {}) {
  if (!getWalletConnectProjectId()) return null;

  const wc = await initWalletConnectProvider({
    ...options,
    showQrModal: false,
  });

  if (!wc?.session) return null;

  try {
    await wc.enable();
    return await buildWalletConnectSessionResult(wc);
  } catch (error) {
    try {
      await wc.disconnect();
    } catch {
      // ignore stale session cleanup errors
    }
    console.debug("restoreWalletConnectSession", error);
    return null;
  }
}

export async function clearWalletConnectSession(options = {}) {
  if (!getWalletConnectProjectId()) return false;

  try {
    const wc = await initWalletConnectProvider({
      ...options,
      showQrModal: false,
    });
    if (!wc?.session) return false;
    await wc.disconnect();
    return true;
  } catch (error) {
    console.debug("clearWalletConnectSession", error);
    return false;
  }
}

/* ---------------- Helpers ---------------- */

async function ensurePolygon(wc) {
  const CHAIN_HEX = ACTIVE_CHAIN?.hex || "0x89";
  try {
    await wc.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }],
    });
  } catch {
    await wc.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: ACTIVE_CHAIN?.name || "Polygon",
          nativeCurrency: ACTIVE_CHAIN?.currency || {
            name: "POL",
            symbol: "POL",
            decimals: 18,
          },
          rpcUrls:
            Array.isArray(DEFAULT_POLYGON_RPC_URLS) && DEFAULT_POLYGON_RPC_URLS.length
              ? DEFAULT_POLYGON_RPC_URLS
              : [DEFAULT_POLYGON_RPC],
          blockExplorerUrls: [ACTIVE_CHAIN?.explorer].filter(Boolean),
        },
      ],
    });
    await wc.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }],
    });
  }
}

async function resolveChainId(provider) {
  const raw = provider?.chainId;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = raw.startsWith("0x")
      ? Number.parseInt(raw, 16)
      : Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  try {
    const hex = await provider.request({ method: "eth_chainId" });
    if (typeof hex === "string") {
      const parsed = hex.startsWith("0x")
        ? Number.parseInt(hex, 16)
        : Number(hex);
      if (Number.isFinite(parsed)) return parsed;
    }
  } catch {
    // ignore chainId lookup failures
  }
  return null;
}

/**
 * Batched getLogs utility to avoid provider range limits.
 * provider: ethers provider
 * filter: { address?, topics? }
 * from/to: block numbers
 * step: batch size (default 10k)
 */
export async function getLogsBatched(
  provider,
  filter,
  from,
  to,
  step = 10_000,
) {
  const logs = [];
  for (let start = from; start <= to; start += step) {
    const end = Math.min(start + step - 1, to);
    // ethers v5/v6 compatible getLogs call
    const part = await provider.getLogs({
      ...filter,
      fromBlock: start,
      toBlock: end,
    });
    if (part?.length) logs.push(...part);
  }
  return logs;
}
