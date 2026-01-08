import * as React from "react";

const ZoomModal = React.lazy(() => import("../gallery/ZoomModal"));
const RedeemOverlay = React.lazy(() => import("../../ACTIONBUTTONS/REDEEMTICKET/RedeemOverlay.jsx"));
const ProjectInfoModal = React.lazy(() => import("../../ACTIONBUTTONS/INFO/ProjectInfoModal.jsx"));

export default function ModalsLayer({
  zoomImg,
  setZoomImg,
  isRedeeming,
  VRFPending,
  redeemMsg,
  pendingTicketId,
  fetchWalletAssets,
  fetchStats,
  fetchREWARDS,
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
          open={isRedeeming || VRFPending}
          isRedeeming={isRedeeming}
          VRFPending={VRFPending}
          redeemMsg={redeemMsg}
          pendingTicketId={pendingTicketId}
          onRefresh={() => {
            fetchWalletAssets(walletAddress);
            fetchStats();
            fetchREWARDS();
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



