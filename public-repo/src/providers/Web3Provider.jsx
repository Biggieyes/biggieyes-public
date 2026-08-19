/* @refresh reload */
// src/providers/Web3Provider.jsx
import * as React from "react";
import { BrowserProvider } from "ethers";

import {
  ACTIVE_CHAIN,
  ensurePolygon,
  getInjectedProvider,
  getROProvider,
  setInjectedProvider,
  syncPolygonRpcIfNeeded,
} from "@/shared/utils/contract";

const Ctx = React.createContext(null);

/** Prefer the injected provider (MetaMask) when multiple are present. */
function pickInjectedProvider() {
  const eth = getInjectedProvider();
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length) {
    const mm = eth.providers.find((p) => p && p.isMetaMask);
    return mm || eth.providers[0];
  }
  return eth;
}

export function Web3Provider({ children }) {
  const [provider, setProvider] = React.useState(null);
  const [signer, setSigner] = React.useState(null);
  const [account, setAccount] = React.useState("");
  const [chainId, setChainId] = React.useState(undefined);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [injectedVersion, setInjectedVersion] = React.useState(0);

  /** Refresh state from the current wallet and attach signer + provider. */
  const refresh = React.useCallback(async () => {
    const injected = pickInjectedProvider();
    if (!injected) {
      try {
        const roProvider = getROProvider();
        setProvider(roProvider);
        setSigner(null);
        setAccount("");
        setChainId(ACTIVE_CHAIN.chainId);
      } catch {
        setProvider(null);
        setSigner(null);
        setAccount("");
        setChainId(undefined);
      }
      return;
    }
    try {
      const nextProvider = new BrowserProvider(injected, "any");
      const nextSigner = await nextProvider.getSigner();
      const addr = await nextSigner.getAddress().catch(() => "");
      const net = await nextProvider.getNetwork().catch(() => ({}));
      const normalizedChainId =
        typeof net?.chainId === "bigint" ? Number(net.chainId) : net?.chainId;

      setSigner(nextSigner);
      setProvider(nextProvider);
      setAccount(addr || "");
      setChainId(normalizedChainId);
    } catch {
      setProvider(null);
      setSigner(null);
      setAccount("");
      setChainId(undefined);
    }
  }, []);

  /** Switch/add the target chain. Uses ensurePolygon for Polygon mainnet. */
  const ensureChain = React.useCallback(
    async (targetId = ACTIVE_CHAIN.chainId) => {
      if (Number(targetId) !== ACTIVE_CHAIN.chainId) {
        console.warn(
          `Unsupported chain ${targetId}; BIGGI supports Polygon mainnet (${ACTIVE_CHAIN.chainId}) only.`,
        );
        return false;
      }
      const eth = pickInjectedProvider();
      if (!eth) return false;
      try {
        await ensurePolygon(eth);
        return true;
      } catch {
        try {
          await syncPolygonRpcIfNeeded(eth, { force: true });
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: ACTIVE_CHAIN.hex }],
          });
          return true;
        } catch {
          return false;
        }
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  /** Primary connect for MetaMask/injected. */
  const connectMetaMask = React.useCallback(async () => {
    const eth = pickInjectedProvider();
    if (!eth) throw new Error("Wallet is not available");
    setIsConnecting(true);
    try {
      setInjectedProvider(eth);
      await eth.request({ method: "eth_requestAccounts" });
      const chainHex = await eth
        .request({ method: "eth_chainId" })
        .catch(() => null);
      const currentId =
        typeof chainHex === "string"
          ? Number.parseInt(chainHex, 16)
          : undefined;
      if (currentId !== ACTIVE_CHAIN.chainId) {
        await ensureChain(ACTIVE_CHAIN.chainId);
      } else {
        await refresh();
      }
    } finally {
      setIsConnecting(false);
    }
  }, [ensureChain, refresh]);

  const disconnect = React.useCallback(() => {
    setSigner(null);
    setProvider(null);
    setAccount("");
    setChainId(undefined);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onInjectedChanged = () => setInjectedVersion((v) => v + 1);
    window.addEventListener("biggi:injected-provider-changed", onInjectedChanged);
    return () =>
      window.removeEventListener(
        "biggi:injected-provider-changed",
        onInjectedChanged,
      );
  }, []);

  /** Initial load + listeners. */
  React.useEffect(() => {
    const eth = pickInjectedProvider();
    refresh();
    if (!eth) return;

    const onAccountsChanged = async (accs = []) => {
      if (!accs.length) {
        disconnect();
        return;
      }
      await refresh();
    };
    const onChainChanged = async () => {
      await refresh();
    };

    eth.on?.("accountsChanged", onAccountsChanged);
    eth.on?.("chainChanged", onChainChanged);
    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, [refresh, disconnect, injectedVersion]);

  const value = {
    provider,
    signer,
    account,
    chainId,
    isConnecting,
    connectMetaMask,
    ensureChain,
    disconnect,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWeb3() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useWeb3 must be used inside <Web3Provider>");
  return v;
}
