// src/components/ImportNftButton.jsx
import * as React from "react";
import { ADDR } from "../utils/addresses.js";
import { AMOY } from "@/shared/utils/contract";
import { addNftToMetaMask } from "../lib/addNftToMetaMask";

const STORE_KEY = "biggi_imported_nfts_simple_v1";
const FALLBACK_STORE = new Map<string, boolean>();

let storageCache: Storage | null | undefined;

function getStorage(): Storage | null {
  if (storageCache !== undefined) return storageCache;
  if (typeof window === "undefined" || !("localStorage" in window)) {
    storageCache = null;
    return storageCache;
  }
  try {
    const ls = window.localStorage;
    const probeKey = `${STORE_KEY}__probe`;
    ls.setItem(probeKey, "1");
    ls.removeItem(probeKey);
    storageCache = ls;
  } catch {
    storageCache = null;
  }
  return storageCache;
}

function readStore(): Record<string, boolean> {
  const ls = getStorage();
  if (!ls) {
    const obj: Record<string, boolean> = {};
    FALLBACK_STORE.forEach((value, key) => {
      if (value) obj[key] = true;
    });
    return obj;
  }
  try {
    const raw = ls.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, boolean>;
      FALLBACK_STORE.clear();
      Object.entries(obj).forEach(([key, value]) => {
        if (value) FALLBACK_STORE.set(key, true);
      });
      return obj;
    }
  } catch {
    // ignore, fall through to reset storage
  }
  FALLBACK_STORE.clear();
  return {};
}

function writeStore(obj: Record<string, boolean>): void {
  const ls = getStorage();
  if (!ls) {
    FALLBACK_STORE.clear();
    Object.entries(obj).forEach(([key, value]) => {
      if (value) FALLBACK_STORE.set(key, true);
    });
    return;
  }
  try {
    ls.setItem(STORE_KEY, JSON.stringify(obj));
    // keep fallback in sync in case storage becomes unavailable later
    FALLBACK_STORE.clear();
    Object.entries(obj).forEach(([key, value]) => {
      if (value) FALLBACK_STORE.set(key, true);
    });
  } catch {
    // if writing fails (e.g. private mode), fall back to memory store
    FALLBACK_STORE.clear();
    Object.entries(obj).forEach(([key, value]) => {
      if (value) FALLBACK_STORE.set(key, true);
    });
  }
}

function key(
  address: string | null | undefined,
  tokenId: string | number | null | undefined,
): string {
  const addr = String(address || "").toLowerCase();
  const tid = String(tokenId ?? "");
  return `${addr}:${tid}`;
}
function isImported(
  address: string | null | undefined,
  tokenId: string | number | null | undefined,
): boolean {
  const db = readStore();
  return !!db[key(address, tokenId)];
}
function markImported(
  address: string | null | undefined,
  tokenId: string | number | null | undefined,
): void {
  const db = readStore();
  db[key(address, tokenId)] = true;
  writeStore(db);
}

/**
 * Props:
 * - contractAddress (string, required)
 * - tokenId (string|number, required)
 * - name (string, optional)
 * - image (string, optional)
 * - onImported(tokenId) (function, optional)
 */
interface ImportNftButtonProps {
  contractAddress?: string | null;
  tokenId?: string | number | null;
  name?: string;
  image?: string;
  onImported?: (_tokenId: string) => void;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}

type EthereumProvider = {
  on?: (_event: string, _listener: (..._args: unknown[]) => void) => void;
  removeListener?: (
    _event: string,
    _listener: (..._args: unknown[]) => void,
  ) => void;
};

type WindowWithEthereum = Window & {
  ethereum?: EthereumProvider;
};

function getWindowEthereum(): EthereumProvider | null {
  if (typeof window !== "object") return null;
  const win = window as WindowWithEthereum;
  return win.ethereum ?? null;
}

export default function ImportNftButton({
  contractAddress,
  tokenId,
  name,
  image,
  onImported,
  style,
  className,
  title = "Import",
}: ImportNftButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const [imported, setImported] = React.useState(false);

  // initialize + re-check
  React.useEffect(() => {
    if (tokenId == null) {
      setImported(false);
      return;
    }

    const addr = contractAddress || ADDR?.MAIN || null;
    setImported(isImported(addr, tokenId));

    const eth = getWindowEthereum();
    const recheck = () => setImported(isImported(addr, tokenId));

    // short delay - some wallets provide context after mount
    const t = setTimeout(recheck, 0);

    if (eth && eth.on) {
      eth.on("chainChanged", recheck);
      eth.on("accountsChanged", recheck);
    }
    return () => {
      clearTimeout(t);
      if (eth && eth.removeListener) {
        eth.removeListener("chainChanged", recheck);
        eth.removeListener("accountsChanged", recheck);
      }
    };
  }, [contractAddress, tokenId]);

  const addressToUse = contractAddress || ADDR?.MAIN || null;
  if (tokenId === undefined || tokenId === null) return null;

  const hasProvider = !!getWindowEthereum();

  const handleClick = async () => {
    if (busy) return;
    if (!hasProvider) {
      alert("Injected wallet not detected. Open MetaMask and try again.");
      return;
    }
    if (!addressToUse || typeof addressToUse !== "string") {
      alert("Missing contract address for the NFT. Please try again later.");
      return;
    }
    const normalizedAddress = addressToUse.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(normalizedAddress)) {
      alert("Invalid contract address. Please refresh the page and try again.");
      return;
    }

    setBusy(true);
    try {
      const added = await addNftToMetaMask({
        contractAddress: normalizedAddress,
        tokenId: String(tokenId),
        chainId: AMOY?.hex ?? "0x13882",
        trySwitchChain: true,
        assetOptions: {
          name: name && name.trim().length ? name : undefined,
          image,
        },
      });

      if (added) {
        markImported(normalizedAddress, tokenId);
        setImported(true);
        if (typeof onImported === "function") onImported(String(tokenId));
        return;
      }

      throw new Error("wallet_watchAsset rejected");
    } catch (err) {
      console.error("MetaMask import failed", err);
      alert(
        "Import failed. Make sure your wallet supports ERC-721 imports and that you confirmed the request.",
      );
    } finally {
      setBusy(false);
    }
  };

  const mergedClassName = [
    "import-button",
    imported ? "is-imported" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title={title}
      className={mergedClassName}
      style={style}
    >
      {busy ? "Importing..." : imported ? "Re-import" : "Import"}
    </button>
  );
}
