import * as React from "react";
import HeaderControls from "./HeaderControls";
import StatusBanner from "@/shared/components/StatusBanner";
import useHashRouting from "@/shared/hooks/useHashRouting";
import { useWeb3 } from "@/providers/Web3Provider";
import { AMOY } from "@/shared/utils/contract";
import { chainNameFor } from "@/config/chains.js";
import Button from "@/components/ui/Button.jsx";

const GallerySection = React.lazy(() => import("./GallerySection"));
const LiveStatsPanel = React.lazy(() => import("./LiveStatsPanel"));
const SiteFooter = React.lazy(() => import("./SiteFooter"));

function MainLayout({
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
  hideExtras,
  topFirstId,
  setTopFirstId,
  fetchDynamicTraitsFor,
  dynamicTraitsById,
  setZoomImg,
  fetchWalletAssets,
  fetchStats,
  fetchREWARDS,
  redeemMsg,
  txStatus,
  txExplorerLink,
  onStatusRefresh,
  infoGateActive = false,
  onInfoGateComplete,
  onInfoButtonRect,
  forceInfoOpenTick = 0,
}) {
  const { anchor, scrollToAnchor } = useHashRouting("/");
  const { chainId, ensureChain, account } = useWeb3();
  const expectedChainId = AMOY.chainId;
  const expectedChainLabel =
    AMOY?.name || chainNameFor(expectedChainId) || "Polygon Amoy";
  const currentChainLabel =
    chainNameFor(chainId) || (chainId ? `chainId ${chainId}` : "unknown");
  const isWrongNetwork =
    Boolean(account || walletAddress) &&
    Number.isFinite(Number(chainId)) &&
    Number(chainId) !== expectedChainId;

  const handleNetworkRetry = React.useCallback(async () => {
    await fetchStats?.();
    await fetchREWARDS?.();
    await fetchWalletAssets?.(walletAddress);
  }, [fetchStats, fetchREWARDS, fetchWalletAssets, walletAddress]);

  React.useEffect(() => {
    if (anchor) scrollToAnchor(anchor);
  }, [anchor, scrollToAnchor]);

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
        actionStatusLabel={actionStatusLabel}
        actionError={actionError}
        icons={icons}
        setOpenNavIdx={setOpenNavIdx}
        isMobile={isMobile}
        infoGateActive={infoGateActive}
        onInfoGateComplete={onInfoGateComplete}
        onInfoButtonRect={onInfoButtonRect}
        forceInfoOpenTick={forceInfoOpenTick}
      />

      <main className="dashboard-shell" id="top">
        <div className="dashboard-shell__inner">
          {isWrongNetwork ? (
            <div
              className="network-warning"
              role="status"
              aria-live="polite"
            >
              <div className="network-warning__message">
                You are connected to <strong>{currentChainLabel}</strong>. Switch
                to <strong>{expectedChainLabel}</strong> for on-chain actions.
              </div>
              <div className="network-warning__actions">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => ensureChain(expectedChainId)}
                  aria-label={`Switch wallet to ${expectedChainLabel}`}
                >
                  Switch to {expectedChainLabel}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNetworkRetry}
                  aria-label="Retry loading on-chain data"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : null}

          <React.Suspense fallback={null}>
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
          </React.Suspense>

          <StatusBanner
            isRedeeming={isRedeeming}
            VRFPending={VRFPending}
            redeemMsg={redeemMsg}
            txStatus={txStatus}
            txLink={txExplorerLink}
            onRefresh={onStatusRefresh}
          />

          <React.Suspense fallback={null}>
            <GallerySection
              cardsHelpOpen={cardsHelpOpen}
              setCardsHelpOpen={setCardsHelpOpen}
              hideExtras={hideExtras}
              galleryLoading={galleryLoading}
              galleryNotice={galleryNotice}
              myNFTs={myNFTs}
              dynamicTraitsById={dynamicTraitsById}
              topFirstId={topFirstId}
              setTopFirstId={setTopFirstId}
              fetchDynamicTraitsFor={fetchDynamicTraitsFor}
              setZoomImg={setZoomImg}
              VRFPending={VRFPending}
              isRedeeming={isRedeeming}
              fetchWalletAssets={fetchWalletAssets}
              walletAddress={walletAddress}
              isMobile={isMobile}
            />
          </React.Suspense>

          <React.Suspense fallback={null}>
            <SiteFooter />
          </React.Suspense>
        </div>
      </main>
    </>
  );
}

export default React.memo(MainLayout);



