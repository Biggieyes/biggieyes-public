// src/wallet/wc.js
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { EthereumProvider } from "@walletconnect/ethereum-provider";
import { AMOY, PUBLIC_AMOY_RPCS, getPrimaryRpcUrl } from "../utils/contract";

const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID;

// Public RPC fallback for Amoy. Prefer your own infra in production.
const DEFAULT_AMOY_RPC =
  getPrimaryRpcUrl() || AMOY?.rpcUrl || PUBLIC_AMOY_RPCS[0];

const RPC_MAP = {
  80002: DEFAULT_AMOY_RPC, // Polygon Amoy
  137: "https://polygon-rpc.com", // Polygon Mainnet
  1: "https://cloudflare-eth.com", // Ethereum Mainnet
};

export async function connectWithWalletConnect() {
  if (!WC_PROJECT_ID) throw new Error("Missing VITE_WC_PROJECT_ID in .env");

  const wc = await EthereumProvider.init({
    projectId: WC_PROJECT_ID,
    chains: [80002],
    optionalChains: [137, 1],
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
    metadata: {
      name: "BiggiEyes",
      description: "BiggiEyes DApp",
      url:
        typeof window !== "undefined"
          ? window.location.origin
          : "https://example.org",
      icons: ["https://walletconnect.com/walletconnect-logo.png"],
    },
  });

  // Open QR and establish session
  await wc.connect();

  const ethersProvider = new BrowserProvider(wc, "any");
  ethersProvider.pollingInterval = 4000;

  const signer = ethersProvider.getSigner();

  const chainId = await resolveChainId(wc);
  if (chainId && chainId !== AMOY.chainId) {
    await ensureAmoy(wc);
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

async function ensureAmoy(wc) {
  const CHAIN_HEX = AMOY?.hex || "0x13882";
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
          chainName: AMOY?.name || "Polygon Amoy",
          nativeCurrency: AMOY?.currency || {
            name: "POL",
            symbol: "POL",
            decimals: 18,
          },
          rpcUrls:
            Array.isArray(AMOY?.rpcUrls) && AMOY.rpcUrls.length
              ? AMOY.rpcUrls
              : [DEFAULT_AMOY_RPC],
          blockExplorerUrls: [AMOY?.explorer].filter(Boolean),
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

