import * as React from "react";

const ZoomModal = React.lazy(() => import("../gallery/ZoomModal"));
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

      {/* Redeem overlay removed; status banner covers basic progress */}

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



