/* @refresh reload */
// src/providers/Web3Provider.jsx
import * as React from "react";
import { BrowserProvider } from "ethers";

import {
  AMOY,
  clearInjectedProvider,
  ensureAmoy,
  getInjectedProvider,
  getROProvider,
  hasInjectedProviderOverride,
  setInjectedProvider,
  syncAmoyRpcIfNeeded,
} from "@/shared/utils/contract";
import {
  getInjectedProviderCandidates,
  isMetaMaskExtensionMissingError,
  isLikelyMetaMaskSdkProvider,
  startInjectedProviderDiscovery,
} from "@/shared/utils/injectedProviders";
import {
  getWalletConnectMobileLinks,
  shouldUseMetaMaskMobileFallback,
} from "@/shared/utils/mobileWallet";
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

async function connectWithWalletConnectLazy(options) {
  const mod = await loadWalletConnectModule();
  if (typeof mod?.connectWithWalletConnect !== "function") {
    throw new Error("WalletConnect module is unavailable");
  }
  return mod.connectWithWalletConnect(options);
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
        setChainId(AMOY.chainId);
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
        setChainId(restoredSession.chainId || AMOY.chainId);
      })
      .finally(() => {
        if (!cancelled) setIsConnecting(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Switch/add the target chain. Uses ensureAmoy for Amoy. */
  const ensureChain = React.useCallback(
    async (targetId = AMOY.chainId) => {
      const eth = pickInjectedProvider();
      if (!eth) return;
      const wantsAmoy = Number(targetId) === AMOY.chainId;
      try {
        if (wantsAmoy) {
          await ensureAmoy(eth);
        } else {
          const hex = "0x" + Number(targetId).toString(16);
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: hex }],
          });
        }
      } catch (e) {
        // If it fails and target is Amoy, try adding and switching again
        if (wantsAmoy) {
          try {
            await syncAmoyRpcIfNeeded(eth, { force: true });
            await eth.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: AMOY.hex }],
            });
          } catch {
            // ignore, refresh state below
          }
        }
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  /** Primary connect for MetaMask/injected. */
  const connectMetaMask = React.useCallback(async () => {
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
        if (shouldUseMetaMaskMobileFallback()) {
          setWalletConnectResumeExpected(true);
          const {
            provider: wcProvider,
            ethersProvider,
            signer: wcSigner,
            address,
            chainId: connectedChainId,
          } = await connectWithWalletConnectLazy({
            forceNewSession: true,
            mobileLinks: getWalletConnectMobileLinks({ preferMetaMask: true }),
          });
          explicitConnectionRef.current = true;
          setInjectedProvider(wcProvider);
          setSigner(wcSigner);
          setProvider(ethersProvider);
          setAccount(address || "");
          setChainId(connectedChainId || AMOY.chainId);
          return Boolean(address);
        }
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
        if (shouldUseMetaMaskMobileFallback()) {
          setWalletConnectResumeExpected(true);
          const {
            provider: wcProvider,
            ethersProvider,
            signer: wcSigner,
            address,
            chainId: connectedChainId,
          } = await connectWithWalletConnectLazy({
            forceNewSession: true,
            mobileLinks: getWalletConnectMobileLinks({ preferMetaMask: true }),
          });
          explicitConnectionRef.current = true;
          setInjectedProvider(wcProvider);
          setSigner(wcSigner);
          setProvider(ethersProvider);
          setAccount(address || "");
          setChainId(connectedChainId || AMOY.chainId);
          return Boolean(address);
        }
        return false;
      }

      explicitConnectionRef.current = true;
      clearWalletConnectResumeExpected();
      setInjectedProvider(eth);
      try {
        await syncAmoyRpcIfNeeded(eth);
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
      if (currentId !== AMOY.chainId) {
        await ensureChain(AMOY.chainId);
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
      setChainId(AMOY.chainId);
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
