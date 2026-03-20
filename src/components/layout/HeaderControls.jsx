import * as React from "react";
import Address from "../common/Address";
import TopBar from "../../shared/components/header/TopBar";

export default function HeaderControls({
  walletAddress,
  connectMetaMask,
  connectWalletConnect,
  isRedeeming,
  VRFPending,
  mintTicket,
  redeemTicket,
  claimREWARDS,
  actionPerforming,
  actionStatusLabel,
  actionError,
  icons,
  setOpenNavIdx,
  isMobile,
  infoGateActive = false,
  onInfoGateComplete,
  onInfoButtonRect,
  forceInfoOpenTick = 0,
}) {
  const verifiedWalletAddress = String(walletAddress || "").trim();
  const hasVerifiedConnection = Boolean(verifiedWalletAddress);
  const showWalletRow = !(isMobile && hasVerifiedConnection);
  const isCompactWalletRow = isMobile;
  const isSingleWalletButton = hasVerifiedConnection;
  const disconnectedMetaMaskLabel = isMobile
    ? "MetaMask"
    : "Connect MetaMask";
  const disconnectedWalletConnectLabel = isMobile
    ? "WalletConnect"
    : "Connect Wallet (WC)";

  return (
    <header
      className="dashboard-header-shell"
      style={{ width: "100%", zIndex: 1000, position: "relative" }}
    >
      {showWalletRow && (
        <div
          className={`wallet-row${isCompactWalletRow ? " wallet-row--mobile" : ""}${isSingleWalletButton ? " wallet-row--single" : ""}`}
        >
          <button
            type="button"
            className="metamask-btn-top"
            onClick={connectMetaMask}
            aria-label={
              hasVerifiedConnection ? "Connected wallet" : "Connect MetaMask"
            }
          >
            <img
              src="/images/metamask-fox.svg"
              alt="MetaMask"
              className="fox-icon"
            />
            {hasVerifiedConnection ? (
              <span className="wallet-btn-label">
                Connected:{" "}
                <Address
                  address={verifiedWalletAddress}
                  start={4}
                  end={3}
                  copy={false}
                  monospace={false}
                />
              </span>
            ) : (
              <span className="wallet-btn-label">
                {disconnectedMetaMaskLabel}
              </span>
            )}
          </button>

          {!hasVerifiedConnection && (
            <button
              type="button"
              className="wc-btn-top"
              onClick={connectWalletConnect}
              aria-label="Connect WalletConnect"
            >
              <img
                src="/images/walletconnect.svg"
                alt="WalletConnect"
                className="fox-icon"
              />
              <span className="wallet-btn-label">
                {disconnectedWalletConnectLabel}
              </span>
            </button>
          )}
        </div>
      )}

      <div className="dashboard-shell__inner">
        <TopBar
          onMint={mintTicket}
          onRedeem={() => {
            if (!isRedeeming && !VRFPending) redeemTicket();
          }}
          onClaim={claimREWARDS}
          isRedeeming={isRedeeming}
          VRFPending={VRFPending}
          actionPerforming={actionPerforming}
          actionStatusLabel={actionStatusLabel}
          actionError={actionError}
          icons={icons}
          onIconClick={(idx) => setOpenNavIdx(idx)}
          isMobile={isMobile}
          infoGateActive={infoGateActive}
          onInfoGateComplete={onInfoGateComplete}
          onInfoButtonRect={onInfoButtonRect}
          forceInfoOpenTick={forceInfoOpenTick}
        />
      </div>
    </header>
  );
}
