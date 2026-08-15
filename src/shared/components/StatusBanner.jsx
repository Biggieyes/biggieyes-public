// src/components/common/StatusBanner.jsx
import * as React from "react";
import RefreshButton from "./RefreshButton";

/**
 * @param {{
 *  isRedeeming?: boolean,
 *  VRFPending?: boolean,
 *  redeemMsg?: string,
 *  txStatus?: { type?: string, stage?: string, hash?: string, chainId?: number },
 *  txLink?: string,
 *  onRefresh?: () => void
 * }} props
 */
export default function StatusBanner({
  isRedeeming = false,
  VRFPending = false,
  redeemMsg = "",
  txStatus = null,
  txLink = "",
  onRefresh = () => {},
}) {
  const show = isRedeeming || VRFPending || !!redeemMsg || !!txStatus;
  const AUTO_HIDE_MS = 40000;
  const [dismissed, setDismissed] = React.useState(false);
  const lastKeyRef = React.useRef("");

  const txMessage = React.useMemo(() => {
    if (!txStatus) return "";
    const type = String(txStatus?.type || "").toLowerCase();
    const stage = String(txStatus?.stage || "").toLowerCase();
    const labelMap = {
      mint: "Mint ticket",
      redeem: "Redeem ticket",
      claim: "Claim REWARDS",
    };
    const label = labelMap[type] || "Transaction";
    if (stage === "wallet") return `${label}: confirm in your wallet...`;
    if (stage === "pending") return `${label}: pending on-chain confirmation...`;
    if (stage === "confirmed") return `${label}: confirmed.`;
    if (stage === "failed") return `${label}: failed.`;
    return `${label}: processing...`;
  }, [txStatus]);

  const msg = React.useMemo(() => {
    if (redeemMsg) return redeemMsg;
    if (txMessage) return txMessage;
    if (isRedeeming && !VRFPending)
      return "Sending and confirming the transaction...";
    if (VRFPending) return "Waiting for the VRF reveal...";
    return "";
  }, [redeemMsg, txMessage, isRedeeming, VRFPending]);

  const bannerKey = `${isRedeeming}-${VRFPending}-${redeemMsg || ""}-${txStatus?.stage || ""}-${txStatus?.hash || ""}`;

  React.useEffect(() => {
    if (!show) {
      setDismissed(false);
      lastKeyRef.current = "";
      return;
    }
    if (bannerKey !== lastKeyRef.current) {
      lastKeyRef.current = bannerKey;
      setDismissed(false);
    }
  }, [show, bannerKey]);

  React.useEffect(() => {
    if (!show || dismissed) return;
    const timer = setTimeout(() => {
      setDismissed(true);
    }, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [show, dismissed, bannerKey]);

  const [locked, setLocked] = React.useState(false);
  const lockRef = React.useRef(false);

  const handleRefresh = React.useCallback(() => {
    if (lockRef.current) return;
    lockRef.current = true;
    setLocked(true);
    try {
      onRefresh?.();
    } finally {
      setTimeout(() => {
        lockRef.current = false;
        setLocked(false);
      }, 800);
    }
  }, [onRefresh]);

  // ESC => refresh (browser only)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleEsc = (e) => {
      if (!show) return;
      if (e.key === "Escape") handleRefresh();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [show, handleRefresh]);

  if (!show || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={0}
      style={{
        position: "relative",
        zIndex: 60,
        marginTop: 6,
        color: "#5ddcff",
        textAlign: "center",
        fontWeight: 700,
        padding: "clamp(6px, 1.8vw, 10px) clamp(8px, 2.2vw, 12px)",
        border: "1px solid rgba(93,220,255,0.25)",
        borderRadius: 8,
        background: "rgba(0, 20, 35, 0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 8,
        lineHeight: 1.4,
        fontSize: "clamp(12px, 3.2vw, 14px)",
        wordBreak: "break-word",
        transition: "opacity 0.3s ease, transform 0.2s ease",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(-10px)",
      }}
    >
      {(isRedeeming ||
        VRFPending ||
        txStatus?.stage === "pending" ||
        txStatus?.stage === "wallet") && (
        <span
          aria-hidden="true"
          className="spinner"
          style={{
            display: "inline-block",
            width: 16,
            height: 16,
            border: "2px solid #5ddcff",
            borderTop: "2px solid transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            marginRight: 6,
          }}
        />
      )}

      <span>{msg}</span>

      {txLink ? (
        <a
          href={txLink}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#ffe800",
            textDecoration: "none",
            fontWeight: 700,
            borderBottom: "1px solid rgba(255,232,0,0.6)",
          }}
        >
          View on explorer
        </a>
      ) : null}

      {VRFPending && (
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <RefreshButton onClick={handleRefresh} disabled={locked} />
        </span>
      )}

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          marginLeft: 6,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "transparent",
          color: "#fff",
          borderRadius: 8,
          padding: "2px 8px",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        ✕
      </button>

      {/* Spinner keyframes */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}


