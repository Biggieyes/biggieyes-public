import * as React from "react";

const ZoomModal = React.lazy(() => import("../gallery/ZoomModal"));
const RedeemOverlay = React.lazy(() => import("../redeem/RedeemOverlay"));
const ProjectInfoModal = React.lazy(() => import("../INFO/ProjectInfoModal"));

export default function ModalsLayer({
  zoomImg,
  setZoomImg,
  isRedeeming,
  vrfPending,
  redeemMsg,
  pendingTicketId,
  fetchWalletAssets,
  fetchStats,
  fetchRewards,
  walletAddress,
  isInfoOpen,
  setOpenNavIdx,
  goPrevPanel,
  goNextPanel,
  isMobile,
}) {
  return (
    <>
      <React.Suspense fallback={null}>
        <ZoomModal open={!!zoomImg} onClose={() => setZoomImg(null)} />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <RedeemOverlay
          open={isRedeeming || vrfPending}
          isRedeeming={isRedeeming}
          vrfPending={vrfPending}
          redeemMsg={redeemMsg}
          pendingTicketId={pendingTicketId}
          onRefresh={() => {
            fetchWalletAssets(walletAddress);
            fetchStats();
            fetchRewards();
          }}
          compact={isMobile}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <ProjectInfoModal
          open={isInfoOpen}
          onClose={() => setOpenNavIdx(null)}
          onPrev={goPrevPanel}
          onNext={goNextPanel}
          initialSection="overview"
          compact={isMobile}
        />
      </React.Suspense>
    </>
  );
}
