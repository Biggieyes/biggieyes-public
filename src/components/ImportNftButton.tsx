import * as React from "react";
import { Check, Copy, Download, LoaderCircle } from "lucide-react";
import { useOptionalWeb3 } from "../providers/Web3Context.js";
import { addNftToMetaMask } from "../lib/addNftToMetaMask";

interface ImportNftButtonProps {
  contractAddress?: string | null;
  tokenId?: string | number | bigint | null;
  ownerAddress?: string;
  chainId?: number;
  name?: string;
  image?: string;
  onImported?: (_tokenId: string) => void;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}

export default function ImportNftButton(props: ImportNftButtonProps) {
  const web3 = useOptionalWeb3();
  const ownerAddress = props.ownerAddress || web3?.account || "";
  // A late wallet response must not mark another account or NFT as imported.
  const identity = [
    props.chainId ?? 137,
    props.contractAddress,
    props.tokenId,
    ownerAddress,
  ].join(":");
  return <ImportAction key={identity} {...props} ownerAddress={ownerAddress} />;
}

function ImportAction({
  contractAddress,
  tokenId,
  ownerAddress,
  chainId = 137,
  name,
  image,
  onImported,
  style,
  className,
  title,
}: ImportNftButtonProps) {
  const [status, setStatus] = React.useState<"idle" | "busy" | "imported">(
    "idle",
  );
  const [message, setMessage] = React.useState("");
  const [manual, setManual] = React.useState(false);
  const [copied, setCopied] = React.useState("");
  const inFlight = React.useRef(false);
  const mounted = React.useRef(false);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const address = String(contractAddress || "").trim();
  const id = String(tokenId ?? "").trim();
  const valid =
    chainId === 137 &&
    /^0x[0-9a-fA-F]{40}$/.test(address) &&
    !/^0x0{40}$/i.test(address) &&
    /^\d+$/.test(id) &&
    id.length <= 78 &&
    BigInt(id) < 2n ** 256n &&
    (typeof tokenId !== "number" || Number.isSafeInteger(tokenId));

  const handleClick = async () => {
    if (inFlight.current || !valid) return;
    inFlight.current = true;
    setStatus("busy");
    setMessage("");
    setManual(false);
    setCopied("");
    try {
      const added = await addNftToMetaMask({
        contractAddress: address,
        tokenId: id,
        chainId: "0x89",
        expectedAccount: ownerAddress || undefined,
        trySwitchChain: true,
        assetOptions: { name, image },
      });
      if (!mounted.current) return;
      setStatus(added ? "imported" : "idle");
      setMessage(added ? "NFT added to MetaMask." : "Import cancelled.");
      if (added) onImported?.(id);
    } catch (error) {
      if (!mounted.current) return;
      setStatus("idle");
      const code = String((error as { code?: unknown })?.code ?? "");
      if (code === "-32002") {
        setMessage("An import is already pending. Check MetaMask.");
      } else if (code === "IMPORT_ACCOUNT_MISMATCH") {
        setMessage(
          "Select the account shown in this gallery in MetaMask, then retry.",
        );
      } else {
        setMessage(
          "Automatic NFT import is unavailable. Manual import details:",
        );
        setManual(true);
      }
    } finally {
      inFlight.current = false;
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      if (mounted.current) setCopied(label);
    } catch {
      if (mounted.current)
        setMessage("Copy unavailable. Select and copy the details below.");
    }
  };
  const busy = status === "busy";
  const imported = status === "imported";
  const Icon = busy ? LoaderCircle : imported ? Check : Download;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || !valid}
        aria-busy={busy}
        title={
          !valid
            ? "A Polygon NFT contract and token ID are required"
            : title || "Import NFT into MetaMask"
        }
        className={["import-button", imported && "is-imported", className]
          .filter(Boolean)
          .join(" ")}
        style={style}
      >
        <Icon size={16} aria-hidden="true" />
        {busy ? "Importing..." : imported ? "Re-import" : "Import"}
      </button>
      {message && (
        <div className="nft-import__status" role="status">
          {message}
        </div>
      )}
      {manual && (
        <div className="nft-import__manual">
          <strong>Polygon mainnet</strong>
          {[
            ["Contract", address],
            ["Token ID", id],
          ].map(([label, value]) => (
            <div className="nft-import__field" key={label}>
              <span>{label}</span>
              <code>{value}</code>
              <button
                type="button"
                onClick={() => copy(label, value)}
                aria-label={`Copy ${label}`}
                title={copied === label ? "Copied" : `Copy ${label}`}
              >
                {copied === label ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Copy size={16} aria-hidden="true" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
