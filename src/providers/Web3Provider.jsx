/* @refresh reload */
// src/providers/Web3Provider.jsx
import * as React from "react";
import { BrowserProvider } from "ethers";

import {
  AMOY,
  ensureAmoy,
  getInjectedProvider,
  getROProvider,
  setInjectedProvider,
  syncAmoyRpcIfNeeded,
} from "@/shared/utils/contract";
import {
  getInjectedProviderCandidates,
  isMetaMaskExtensionMissingError,
  isLikelyMetaMaskSdkProvider,
  startInjectedProviderDiscovery,
} from "@/shared/utils/injectedProviders";

const Ctx = React.createContext(null);

function pickInjectedProvider() {
  const candidates = getInjectedProviderCandidates({
    preferred: getInjectedProvider(),
  });
  if (!candidates.length) return null;
  const mm = candidates.find(
    (p) =>
      p &&
      p.isMetaMask &&
      !p.isBraveWallet &&
      !p.isCoinbaseWallet &&
      !p.isRabby &&
      !p.isTrust,
  );
  return mm || candidates[0];
}

export function Web3Provider({ children }) {
  const [provider, setProvider] = React.useState(null);
  const [signer, setSigner] = React.useState(null);
  const [account, setAccount] = React.useState("");
  const [chainId, setChainId] = React.useState(undefined);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [injectedVersion, setInjectedVersion] = React.useState(0);

  React.useEffect(() => {
    startInjectedProviderDiscovery();
  }, []);

  /** Refresh state from the current wallet and attach signer + provider. */
  const refresh = React.useCallback(async () => {
    const injected = pickInjectedProvider();
    if (!injected) {
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
    const fallbackCandidates = getInjectedProviderCandidates({
      preferred: getInjectedProvider(),
      metaMaskOnly: false,
    });
    const candidates = [...metaMaskCandidates, ...fallbackCandidates].filter(
      (p, i, list) =>
        p &&
        list.indexOf(p) === i &&
        !isLikelyMetaMaskSdkProvider(p),
    );
    if (!candidates.length) throw new Error("Wallet is not available");
    setIsConnecting(true);
    try {
      let eth = null;
      for (const candidate of candidates) {
        try {
          const accounts = await candidate.request({ method: "eth_requestAccounts" });
          if (Array.isArray(accounts) && accounts[0]) {
            eth = candidate;
            break;
          }
        } catch (candidateError) {
          const code =
            candidateError?.code ??
            candidateError?.error?.code ??
            candidateError?.data?.originalError?.code;
          if (isMetaMaskExtensionMissingError(candidateError)) continue;
          if (code === 4001 || code === "ACTION_REJECTED") throw candidateError;
          if (code === -32002 || code === 4100) throw candidateError;
        }
      }
      if (
        !eth &&
        window?.ethereum &&
        typeof window.ethereum.request === "function" &&
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
          const rootCode =
            rootError?.code ??
            rootError?.error?.code ??
            rootError?.data?.originalError?.code;
          if (rootCode === 4001 || rootCode === "ACTION_REJECTED") {
            throw rootError;
          }
          if (rootCode === -32002 || rootCode === 4100) {
            throw rootError;
          }
        }
      }
      if (!eth) throw new Error("MetaMask extension not found");

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
