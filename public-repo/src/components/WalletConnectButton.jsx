// src/components/WalletConnectButton.jsx
import * as React from "react";

const shortAddr = (addr) => {
  if (!addr) return "--";
  const s = String(addr);
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

export default function WalletConnectButton({
  walletAddress,
  onConnectMetaMask,
  onConnectWalletConnect,
}) {
  return (
    <div className="moderator-center__wallet">
      <div className="moderator-center__wallet-info">
        <span className="muted">Wallet</span>
        <strong>
          {walletAddress ? shortAddr(walletAddress) : "Not connected"}
        </strong>
      </div>
      <div className="moderator-center__wallet-actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          onClick={onConnectMetaMask}
        >
          Connect MetaMask
        </button>
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          onClick={onConnectWalletConnect}
        >
          WalletConnect
        </button>
      </div>
    </div>
  );
}

