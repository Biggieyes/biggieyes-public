// src/components/common/StatusBanner.jsx
import * as React from "react";
import RefreshButton from "./RefreshButton";

/**
 * @param {{
 *  isRedeeming?: boolean,
 *  vrfPending?: boolean,
 *  redeemMsg?: string,
 *  onRefresh?: () => void
 * }} props
 */
export default function StatusBanner({
  isRedeeming = false,
  vrfPending = false,
  redeemMsg = "",
  onRefresh = () => {},
}) {
  const show = isRedeeming || vrfPending || !!redeemMsg;

  const msg = React.useMemo(() => {
    if (redeemMsg) return redeemMsg;
    if (isRedeeming && !vrfPending) return "Sending and confirming the transaction...";
    if (vrfPending) return "Waiting for the VRF reveal...";
    return "";
  }, [redeemMsg, isRedeeming, vrfPending]);

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

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={0}
      style={{
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
      {(isRedeeming || vrfPending) && (
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

      {vrfPending && (
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <RefreshButton onClick={handleRefresh} disabled={locked} />
        </span>
      )}

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
