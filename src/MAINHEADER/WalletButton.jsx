// src/components/header/WalletButton.jsx
import * as React from "react";

export default function WalletButton({
  walletAddress,
  onConnect,
  onConnectWC,
  wcLabel = "Connect Wallet (WC)",
  wcRight = 30, // vzdálenost od pravého okraje (jako MetaMask)
  wcTop = 72, // svislá pozice (pod MetaMask)
}) {
  const lockRef = React.useRef(false);

  const displayAddress = React.useMemo(() => {
    if (!walletAddress) return "";
    const s = String(walletAddress);
    return s.slice(0, 6) + "..." + s.slice(-4);
  }, [walletAddress]);

  const label = walletAddress
    ? `Connected: ${displayAddress}`
    : "Connect MetaMask";

  const clickGuard = (fn) => {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      fn?.();
    } finally {
      setTimeout(() => {
        lockRef.current = false;
      }, 800);
    }
  };

  const handleMetaMaskClick = () => clickGuard(onConnect);
  const handleWalletConnectClick = () => clickGuard(onConnectWC);

  const handleContextMenu = (e) => {
    if (!walletAddress) return;
    e.preventDefault();
    navigator.clipboard?.writeText(walletAddress).catch(() => {});
  };

  return (
    <>
      {/* MetaMask */}
      <button
        type="button"
        className="metamask-btn-top"
        onClick={handleMetaMaskClick}
        onContextMenu={handleContextMenu}
        aria-label={label}
        title={
          walletAddress ? "Right-click to copy address" : "Connect MetaMask"
        }
        aria-live="polite"
        aria-atomic="true"
      >
        <img
          src="/images/metamask-fox.svg"
          alt=""
          className="fox-icon"
          aria-hidden="true"
        />
        <span style={{ marginLeft: 8 }}>{label}</span>
      </button>

      {/* WalletConnect – STEJNÁ VELIKOST JAKO MetaMask */}
      {typeof onConnectWC === "function" && (
        <button
          type="button"
          className="wc-btn-top"
          onClick={handleWalletConnectClick}
          aria-label={wcLabel}
          title={wcLabel}
          style={{
            // stejná „krabice“ jako .metamask-btn-top
            position: "fixed",
            top: wcTop,
            right: wcRight,
            zIndex: 2000,
            background: "#ffe800",
            color: "#111",
            border: "2px solid #e2761b",
            borderRadius: 12,
            fontSize: "1.08rem",
            fontFamily: "'VT323', 'Press Start 2P', monospace",
            cursor: "pointer",
            padding: "9px 22px 9px 16px",
            fontWeight: "bold",
            letterSpacing: "0.6px",
            boxShadow: "0 2px 18px rgba(255, 232, 0, 0.133)",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            transition: "filter 0.14s, background 0.11s",
          }}
        >
          {/* stejná velikost ikony jako u MetaMask */}
          <img
            src="/images/walletconnect.svg"
            alt=""
            className="fox-icon"
            aria-hidden="true"
            style={{ width: 26, height: 26 }}
          />
          <span style={{ marginLeft: 8 }}>{wcLabel}</span>
        </button>
      )}
    </>
  );
}
