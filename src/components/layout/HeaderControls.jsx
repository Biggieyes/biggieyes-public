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
  const showWalletRow = !(isMobile && walletAddress);

  return (
    <header
      className="dashboard-shell"
      style={{ width: "100%", zIndex: 1000, position: "relative" }}
    >
      {showWalletRow && (
        <div className="wallet-row" style={{ padding: 8 }}>
          <button
            type="button"
            className="metamask-btn-top"
            onClick={connectMetaMask}
          >
            <img
              src="/images/metamask-fox.svg"
              alt="MetaMask"
              className="fox-icon"
            />
            {walletAddress ? (
              <span style={{ marginLeft: 8 }}>
                Connected: <Address address={walletAddress} />
              </span>
            ) : (
              <span style={{ marginLeft: 8 }}>Connect MetaMask</span>
            )}
          </button>

          {!walletAddress && (
            <button
              type="button"
              className="wc-btn-top"
              onClick={connectWalletConnect}
            >
              <img
                src="/images/walletconnect.svg"
                alt="WalletConnect"
                className="fox-icon"
              />
              <span style={{ marginLeft: 8 }}>Connect Wallet (WC)</span>
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
