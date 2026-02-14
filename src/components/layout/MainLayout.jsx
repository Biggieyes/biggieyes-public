import * as React from "react";
import HeaderControls from "./HeaderControls";
import GallerySection from "./GallerySection";
import LiveStatsPanel from "./LiveStatsPanel";
import SiteFooter from "./SiteFooter";
import StatusBanner from "@/shared/components/StatusBanner";

export default function MainLayout({
  walletAddress,
  connectMetaMask,
  connectWalletConnect,
  isRedeeming,
  VRFPending,
  mintTicket,
  redeemTicket,
  claimREWARDS,
  actionPerforming,
  actionError,
  icons,
  setOpenNavIdx,
  isMobile,
  lastMinted,
  biggiMinted,
  maxSupply,
  ticketMinted,
  maxTickets,
  ticketPrice,
  blockMintCounts,
  BACKGROUND_NAMES,
  blockPrices,
  backgroundMintCounts,
  rewardPool,
  myClaimable,
  myNFTs,
  mintVolumeMatic,
  epochStartTs,
  userLastClaimTs,
  fetchChainNowTs,
  cardsHelpOpen,
  setCardsHelpOpen,
  galleryLoading,
  galleryNotice,
  onOpenAdmin,
  isAdmin = false,
  hideExtras,
  setTopFirstId,
  fetchDynamicTraitsFor,
  dynamicTraitsById,
  setZoomImg,
  fetchWalletAssets,
  fetchStats,
  fetchREWARDS,
  redeemMsg,
}) {
  return (
    <>
      <style>{`
        .rewards-table { min-height: 520px !important; }
        .rewards-info table { min-height: 420px; }
        .wallet-row { display:flex; gap:10px; align-items:center; }
        .metamask-btn-top, .wc-btn-top {
          display:inline-flex; align-items:center; border:2px solid #ffe800; background:#08ffe6;
          color:#111; font-weight:800; padding:6px 12px; border-radius:8px; cursor:pointer;
        }
        .wc-btn-top { background:#b0ffea; }
        .fox-icon { width:18px; height:18px; }
      `}</style>

      <HeaderControls
        walletAddress={walletAddress}
        connectMetaMask={connectMetaMask}
        connectWalletConnect={connectWalletConnect}
        isRedeeming={isRedeeming}
        VRFPending={VRFPending}
        mintTicket={mintTicket}
        redeemTicket={redeemTicket}
        claimREWARDS={claimREWARDS}
        actionPerforming={actionPerforming}
        actionError={actionError}
        icons={icons}
        setOpenNavIdx={setOpenNavIdx}
        isMobile={isMobile}
      />

      <main className="dashboard-shell" id="top">
        <div className="dashboard-shell__inner">
          <LiveStatsPanel
            walletAddress={walletAddress}
            lastMinted={lastMinted}
            biggiMinted={biggiMinted}
            maxSupply={maxSupply}
            ticketMinted={ticketMinted}
            maxTickets={maxTickets}
            ticketPrice={ticketPrice}
            blockMintCounts={blockMintCounts}
            BACKGROUND_NAMES={BACKGROUND_NAMES}
            blockPrices={blockPrices}
            backgroundMintCounts={backgroundMintCounts}
            rewardPool={rewardPool}
            myClaimable={myClaimable}
            myNFTs={myNFTs}
            mintVolumeMatic={mintVolumeMatic}
            epochStartTs={epochStartTs}
            userLastClaimTs={userLastClaimTs}
            fetchChainNowTs={fetchChainNowTs}
            isMobile={isMobile}
          />

          <StatusBanner
            isRedeeming={isRedeeming}
            VRFPending={VRFPending}
            redeemMsg={redeemMsg}
            onRefresh={async () => {
              await fetchStats?.();
              await fetchREWARDS?.();
              await fetchWalletAssets?.(walletAddress);
            }}
          />

          {isAdmin ? (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                margin: "6px 12px 0",
              }}
            >
              <button
                onClick={onOpenAdmin}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#cfd2db",
                  fontSize: 13,
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1,
                }}
                aria-label="Open admin menu"
              >
                Admin
              </button>
            </div>
          ) : null}

          <GallerySection
            cardsHelpOpen={cardsHelpOpen}
            setCardsHelpOpen={setCardsHelpOpen}
            hideExtras={hideExtras}
            galleryLoading={galleryLoading}
            galleryNotice={galleryNotice}
            myNFTs={myNFTs}
            dynamicTraitsById={dynamicTraitsById}
            setTopFirstId={setTopFirstId}
            fetchDynamicTraitsFor={fetchDynamicTraitsFor}
            setZoomImg={setZoomImg}
            VRFPending={VRFPending}
            isRedeeming={isRedeeming}
            fetchWalletAssets={fetchWalletAssets}
            walletAddress={walletAddress}
            isMobile={isMobile}
          />

          <SiteFooter />
        </div>
      </main>
    </>
  );
}



