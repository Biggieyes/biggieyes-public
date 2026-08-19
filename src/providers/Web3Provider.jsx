/* @refresh reload */
// src/providers/Web3Provider.jsx
import * as React from "react";
import { BrowserProvider } from "ethers";

import {
  ACTIVE_CHAIN,
  clearInjectedProvider,
  ensurePolygon,
  getInjectedProvider,
  getROProvider,
  hasInjectedProviderOverride,
  setInjectedProvider,
  syncPolygonRpcIfNeeded,
} from "@/shared/utils/contract";
import {
  getInjectedProviderCandidates,
  isMetaMaskExtensionMissingError,
  isLikelyMetaMaskSdkProvider,
  startInjectedProviderDiscovery,
} from "@/shared/utils/injectedProviders";
import {
  clearWalletConnectResumeExpected,
  getWalletConnectResumeExpected,
  setWalletConnectResumeExpected,
} from "@/shared/utils/walletConnectResume";

const Ctx = React.createContext(null);
const WALLET_RESUME_DEBOUNCE_MS = 350;
let walletConnectModulePromise = null;

async function loadWalletConnectModule() {
  if (!walletConnectModulePromise) {
    walletConnectModulePromise = import("@/wallet/wc.js");
  }
  return walletConnectModulePromise;
}

async function clearWalletConnectSessionLazy(options) {
  try {
    const mod = await loadWalletConnectModule();
    if (typeof mod?.clearWalletConnectSession !== "function") return false;
    return await mod.clearWalletConnectSession(options);
  } catch {
    return false;
  }
}

async function restoreWalletConnectSessionLazy(options) {
  try {
    const mod = await loadWalletConnectModule();
    if (typeof mod?.restoreWalletConnectSession !== "function") return null;
    return await mod.restoreWalletConnectSession(options);
  } catch {
    return null;
  }
}

function applyPollingInterval(provider) {
  const pollMs = Number(
    import.meta.env.VITE_SIGNER_POLL_INTERVAL_MS ||
      import.meta.env.VITE_RPC_POLL_INTERVAL_MS ||
      8000,
  );
  if (provider && Number.isFinite(pollMs) && pollMs > 0) {
    try {
      provider.pollingInterval = Math.trunc(pollMs);
    } catch {
      // ignore providers that do not expose polling interval
    }
  }
  return provider;
}

const isDirectMetaMaskProvider = (provider) =>
  Boolean(
    provider &&
      provider.isMetaMask &&
      !provider.isBraveWallet &&
      !provider.isCoinbaseWallet &&
      !provider.isRabby &&
      !provider.isTrust,
  );

const getProviderErrorCode = (error) =>
  error?.code ??
  error?.error?.code ??
  error?.cause?.code ??
  error?.info?.error?.code ??
  error?.data?.originalError?.code ??
  error?.cause?.data?.originalError?.code;

function pickInjectedProvider() {
  const candidates = getInjectedProviderCandidates({
    preferred: getInjectedProvider(),
  });
  if (!candidates.length) return null;
  const mm = candidates.find((p) => isDirectMetaMaskProvider(p));
  return mm || candidates[0];
}

export function Web3Provider({ children }) {
  const [provider, setProvider] = React.useState(null);
  const [signer, setSigner] = React.useState(null);
  const [account, setAccount] = React.useState("");
  const [chainId, setChainId] = React.useState(undefined);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [injectedVersion, setInjectedVersion] = React.useState(0);
  const resumeTimerRef = React.useRef(null);
  const explicitConnectionRef = React.useRef(false);

  React.useEffect(() => {
    startInjectedProviderDiscovery();
  }, []);

  /** Refresh state from the current wallet and attach signer + provider. */
  const refresh = React.useCallback(async () => {
    const injected = pickInjectedProvider();
    const isExplicitConnection =
      explicitConnectionRef.current || hasInjectedProviderOverride();
    if (!injected || !isExplicitConnection) {
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
      const nextProvider = applyPollingInterval(
        new BrowserProvider(injected, "any"),
      );
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

  React.useEffect(() => {
    if (!getWalletConnectResumeExpected()) return undefined;

    let cancelled = false;
    setIsConnecting(true);

    restoreWalletConnectSessionLazy()
      .then((restoredSession) => {
        if (cancelled || !restoredSession?.provider) return;
        explicitConnectionRef.current = true;
        setWalletConnectResumeExpected(true);
        setInjectedProvider(restoredSession.provider);
        setSigner(restoredSession.signer || null);
        setProvider(restoredSession.ethersProvider || null);
        setAccount(restoredSession.address || "");
        setChainId(restoredSession.chainId || ACTIVE_CHAIN.chainId);
      })
      .finally(() => {
        if (!cancelled) setIsConnecting(false);
      });

    return () => {
      cancelled = true;
    };
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
    clearWalletConnectResumeExpected();
    const metaMaskCandidates = getInjectedProviderCandidates({
      preferred: getInjectedProvider(),
      metaMaskOnly: true,
    });
    const allCandidates = getInjectedProviderCandidates({
      preferred: getInjectedProvider(),
      metaMaskOnly: false,
    });
    const candidates = metaMaskCandidates.filter(
      (p, i, list) =>
        p &&
        list.indexOf(p) === i &&
        isDirectMetaMaskProvider(p) &&
        !isLikelyMetaMaskSdkProvider(p),
    );
    setIsConnecting(true);
    try {
      if (!candidates.length) {
        console.warn(
          "Web3Provider.connectMetaMask: no direct MetaMask extension provider candidates found",
          {
            metaMaskCandidates: metaMaskCandidates.length,
            allCandidates: allCandidates.length,
          },
        );
        return false;
      }

      let eth = null;
      for (const candidate of candidates) {
        try {
          const accounts = await candidate.request({ method: "eth_requestAccounts" });
          if (Array.isArray(accounts) && accounts[0]) {
            eth = candidate;
            break;
          }
        } catch (candidateError) {
          const code = getProviderErrorCode(candidateError);
          if (isMetaMaskExtensionMissingError(candidateError)) continue;
          if (code === 4001 || code === "ACTION_REJECTED") throw candidateError;
          if (code === -32002 || code === 4100) throw candidateError;
        }
      }
      if (
        !eth &&
        window?.ethereum &&
        typeof window.ethereum.request === "function" &&
        isDirectMetaMaskProvider(window.ethereum) &&
        !isLikelyMetaMaskSdkProvider(window.ethereum)
      ) {
        try {
          const accounts = await window.ethereum.request({
            method: "eth_requestAccounts",
          });
          if (Array.isArray(accounts) && accounts[0]) {
            eth = window.ethereum;
          }
        } catch (rootError) {
          const rootCode = getProviderErrorCode(rootError);
          if (rootCode === 4001 || rootCode === "ACTION_REJECTED") {
            throw rootError;
          }
          if (rootCode === -32002 || rootCode === 4100) {
            throw rootError;
          }
        }
      }
      if (!eth) {
        return false;
      }

      explicitConnectionRef.current = true;
      clearWalletConnectResumeExpected();
      setInjectedProvider(eth);
      try {
        await syncPolygonRpcIfNeeded(eth);
      } catch {
        // non-fatal: continue connect flow even if chain metadata update is skipped
      }
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
      return true;
    } catch (err) {
      const code = getProviderErrorCode(err);
      if (code === 4001 || code === "ACTION_REJECTED") return false;
      if (code === -32002 || code === 4100) return false;
      if (isMetaMaskExtensionMissingError(err)) return false;
      console.error("Web3Provider.connectMetaMask", err);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [ensureChain, refresh]);

  const disconnect = React.useCallback(() => {
    explicitConnectionRef.current = false;
    clearWalletConnectResumeExpected();
    clearInjectedProvider();
    clearWalletConnectSessionLazy().catch(() => {});
    try {
      setProvider(getROProvider());
      setChainId(ACTIVE_CHAIN.chainId);
    } catch {
      setProvider(null);
      setChainId(undefined);
    }
    setSigner(null);
    setAccount("");
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
      if (!explicitConnectionRef.current) {
        await refresh();
        return;
      }
      await refresh();
    };
    const onChainChanged = async () => {
      await refresh();
    };
    const onDisconnect = () => {
      disconnect();
    };

    eth.on?.("accountsChanged", onAccountsChanged);
    eth.on?.("chainChanged", onChainChanged);
    eth.on?.("disconnect", onDisconnect);
    eth.on?.("session_delete", onDisconnect);
    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
      eth.removeListener?.("disconnect", onDisconnect);
      eth.removeListener?.("session_delete", onDisconnect);
    };
  }, [refresh, disconnect, injectedVersion]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const scheduleRefresh = () => {
      if (!explicitConnectionRef.current && !account) return;
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        refresh().catch(() => {});
      }, WALLET_RESUME_DEBOUNCE_MS);
    };
    const onVisibilityChange = () => {
      if (!document.hidden) scheduleRefresh();
    };

    window.addEventListener("focus", scheduleRefresh);
    window.addEventListener("pageshow", scheduleRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      window.removeEventListener("focus", scheduleRefresh);
      window.removeEventListener("pageshow", scheduleRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [account, refresh]);

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
