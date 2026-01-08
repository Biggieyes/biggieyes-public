import * as React from "react";
import Address from "../common/Address";
import TopBar from "../../MAINHEADER/TopBar.jsx";

export default function HeaderControls({
  walletAddress,
  connectMetaMask,
  connectWalletConnect,
  isRedeeming,
  vrfPending,
  mintTicket,
  redeemTicket,
  claimRewards,
  actionPerforming,
  actionError,
  icons,
  setOpenNavIdx,
  isMobile,
}) {
  const showWalletRow = !(isMobile && walletAddress);

  return (
    <header style={{ width: "100%", zIndex: 1000, position: "relative" }}>
      {showWalletRow && (
        <div className="wallet-row" style={{ padding: 8 }}>
          <button className="metamask-btn-top" onClick={connectMetaMask}>
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
            <button className="wc-btn-top" onClick={connectWalletConnect}>
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

      <TopBar
        onMint={mintTicket}
        onRedeem={() => {
          if (!isRedeeming && !vrfPending) redeemTicket();
        }}
        onClaim={claimRewards}
        isRedeeming={isRedeeming}
        vrfPending={vrfPending}
        actionPerforming={actionPerforming}
        actionError={actionError}
        icons={icons}
        onIconClick={(idx) => setOpenNavIdx(idx)}
        isMobile={isMobile}
      />
    </header>
  );
}

