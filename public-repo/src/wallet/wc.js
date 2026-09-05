// src/wallet/wc.js
import { BrowserProvider } from "ethers";
import { EthereumProvider } from "@walletconnect/ethereum-provider";
import { ACTIVE_CHAIN, PUBLIC_POLYGON_RPCS, getPrimaryRpcUrl } from "@/shared/utils/contract";

const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID;

// Public RPC fallback for Polygon mainnet. Prefer your own infra in production.
const DEFAULT_POLYGON_RPC =
  getPrimaryRpcUrl() || ACTIVE_CHAIN?.rpcUrl || PUBLIC_POLYGON_RPCS[0];

const RPC_MAP = {
  [ACTIVE_CHAIN.chainId]: DEFAULT_POLYGON_RPC,
};

export async function connectWithWalletConnect() {
  if (!WC_PROJECT_ID) throw new Error("Missing VITE_WC_PROJECT_ID in .env");

  const wc = await EthereumProvider.init({
    projectId: WC_PROJECT_ID,
    chains: [ACTIVE_CHAIN.chainId],
    rpcMap: RPC_MAP,
    showQrModal: true,
    qrModalOptions: {
      mobileLinks: [
        "metamask",
        "trust",
        "okx",
        "rainbow",
        "zerion",
        "bitget",
        "coinbase",
      ],
    },
    methods: [
      "eth_requestAccounts",
      "eth_sendTransaction",
      "personal_sign",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
    ],
    optionalMethods: [
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
    ],
    events: ["chainChanged", "accountsChanged", "disconnect", "session_delete"],
    metadata: {
      name: "BiggiEyes",
      description: "BiggiEyes DApp",
      url:
        typeof window !== "undefined"
          ? window.location.origin
          : "https://biggieyes.com",
      icons: ["https://biggieyes.com/apple-touch-icon.png"],
    },
  });

  // Open QR and establish session
  await wc.connect();

  const ethersProvider = new BrowserProvider(wc, "any");
  if (typeof ethersProvider.pollingInterval === "number") {
    ethersProvider.pollingInterval = 4000;
  }

  const signer = await ethersProvider.getSigner();

  const chainId = await resolveChainId(wc);
  if (chainId && chainId !== ACTIVE_CHAIN.chainId) {
    await ensurePolygon(wc);
  }

  // Basic listeners
  const hardReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };
  wc.on("chainChanged", hardReload);
  wc.on("accountsChanged", hardReload);
  wc.on("disconnect", () => {
    // session ended
  });
  wc.on("session_delete", () => {
    // wallet forcibly closed session
  });

  const address = await signer.getAddress();
  const net = await ethersProvider.getNetwork();
  const connectedChainId = Number(net?.chainId ?? 0);

  const disconnect = () => {
    try {
      wc.removeListener?.("chainChanged", hardReload);
      wc.removeListener?.("accountsChanged", hardReload);
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
          chainName: ACTIVE_CHAIN?.name || "Polygon mainnet",
          nativeCurrency: ACTIVE_CHAIN?.currency || {
            name: "POL",
            symbol: "POL",
            decimals: 18,
          },
          rpcUrls:
            Array.isArray(ACTIVE_CHAIN?.rpcUrls) && ACTIVE_CHAIN.rpcUrls.length
              ? ACTIVE_CHAIN.rpcUrls
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
