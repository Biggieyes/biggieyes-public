/* @refresh reload */
// src/providers/Web3Provider.jsx
import * as React from "react";
import { BrowserProvider } from "ethers";
import { AMOY, ensureAmoy, syncAmoyRpcIfNeeded } from "../utils/contract";

const Ctx = React.createContext(null);

/** Prefer the injected provider (MetaMask) when multiple are present. */
function pickInjectedProvider() {
  if (typeof window === "undefined") return null;
  const eth = window.ethereum;
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

  /** Refresh state from the current wallet and attach signer + provider. */
  const refresh = React.useCallback(async () => {
    const injected = pickInjectedProvider();
    if (!injected) {
      setProvider(null);
      setSigner(null);
      setAccount("");
      setChainId(undefined);
      return;
    }
    try {
      const nextProvider = new BrowserProvider(injected);
      const nextSigner = nextProvider.getSigner();
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
          await ensureAmoy();
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
    const eth = pickInjectedProvider();
    if (!eth) throw new Error("Wallet is not available");
    setIsConnecting(true);
    try {
      await eth.request({ method: "eth_requestAccounts" });
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

  /** Initial load + listeners. */
  React.useEffect(() => {
    const eth = pickInjectedProvider();
    if (!eth) return;
    refresh();

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
  }, [refresh, disconnect]);

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

