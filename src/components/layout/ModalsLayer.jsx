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
  const zoomSrc =
    typeof zoomImg === "string"
      ? zoomImg
      : zoomImg?.src || zoomImg?.image || "/images/Biggi.png";
  const zoomAlt =
    typeof zoomImg === "object"
      ? zoomImg?.alt || zoomImg?.name || "NFT zoom"
      : "NFT zoom";
  const zoomAnchorRect =
    typeof zoomImg === "object" ? zoomImg?.anchorRect || null : null;

  return (
    <>
      <React.Suspense fallback={null}>
        <ZoomModal
          open={Boolean(zoomImg)}
          src={zoomSrc}
          alt={zoomAlt}
          anchorRect={zoomAnchorRect}
          onClose={() => setZoomImg(null)}
        />
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



