import * as React from "react";
import * as WC from "../../wallet/wc";
import { ensureAmoy, getContract } from "../../utils/contract";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const pickInjectedProvider = () => {
  if (typeof window === "undefined") return null;
  const { ethereum } = window;
  if (!ethereum) return null;
  if (Array.isArray(ethereum.providers) && ethereum.providers.length) {
    const mm = ethereum.providers.find((prov) => prov && prov.isMetaMask);
    return mm || ethereum.providers[0];
  }
  return ethereum;
};

async function connectWithWalletConnect() {
  if (WC && typeof WC.connectWithWalletConnect === "function") {
    return await WC.connectWithWalletConnect();
  }
  throw new Error("WalletConnect is not available in this version");
}

export function useWallet({ onConnected } = {}) {
  const [walletAddress, setWalletAddress] = React.useState("");
  const contractRef = React.useRef(null);

  const connectMetaMask = React.useCallback(async () => {
    const eth = pickInjectedProvider();
    if (!eth) {
      alert("MetaMask extension is not installed.");
      return;
    }
    try {
      if (eth && eth !== window.ethereum) window.ethereum = eth;
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0];
      if (!addr) throw new Error("No account returned from wallet.");

      const chainHex = await eth
        .request({ method: "eth_chainId" })
        .catch(() => null);
      const currentId =
        typeof chainHex === "string"
          ? Number.parseInt(chainHex, 16)
          : undefined;
      if (currentId !== 80002) {
        await ensureAmoy();
      }

      setWalletAddress(addr);
      contractRef.current = getContract();
      if (typeof onConnected === "function") await onConnected(addr);
    } catch (err) {
      alert("Connection rejected.");
      console.error("connectMetaMask", err);
    }
  }, [onConnected]);

  const connectWalletConnect = React.useCallback(async () => {
    try {
      const { provider, signer } = await connectWithWalletConnect();
      const addr = await signer.getAddress();
      setWalletAddress(addr);
      if (typeof window !== "undefined") window.ethereum = provider;
      contractRef.current = getContract();
      if (typeof onConnected === "function") await onConnected(addr);
    } catch (err) {
      console.error("connectWalletConnect", err);
      alert(err?.message || "WalletConnect failed");
    }
  }, [onConnected]);

  /**
   * attachEventListeners se vrací funkci unsubscribe
   * Poznámka: onTransfer + account/chain listeners jsou přeneseny sem
   */
  const attachEventListeners = React.useCallback((handlers = {}) => {
    try {
      const contract = contractRef.current || getContract();
      contractRef.current = contract;

      const onTransfer = async (from, to, tokenId) => {
        if (typeof handlers.onTransfer === "function") {
          try {
            await handlers.onTransfer(from, to, tokenId);
          } catch (err) {
            console.error("onTransfer handler err", err);
          }
        }
      };

      contract.on("Transfer", onTransfer);
      const accountCb = async (accs) => {
        const a = accs?.[0] || "";
        setWalletAddress(a);
        if (typeof handlers.onAccountsChanged === "function")
          await handlers.onAccountsChanged(a);
      };
      const chainCb = async () => {
        if (typeof handlers.onChainChanged === "function")
          await handlers.onChainChanged();
      };

      window.ethereum?.on?.("accountsChanged", accountCb);
      window.ethereum?.on?.("chainChanged", chainCb);

      return () => {
        try {
          contract.off("Transfer", onTransfer);
        } catch (err) {
          console.debug("remove Transfer listener failed", err);
        }
        try {
          window.ethereum?.removeListener?.("accountsChanged", accountCb);
        } catch (err) {
          console.debug("remove accountsChanged listener failed", err);
        }
        try {
          window.ethereum?.removeListener?.("chainChanged", chainCb);
        } catch (err) {
          console.debug("remove chainChanged listener failed", err);
        }
      };
    } catch (e) {
      console.error("attachEventListeners", e);
      return () => {};
    }
  }, []);

  return {
    walletAddress,
    setWalletAddress,
    connectMetaMask,
    connectWalletConnect,
    attachEventListeners,
    contractRef,
    ZERO_ADDRESS,
  };
}

