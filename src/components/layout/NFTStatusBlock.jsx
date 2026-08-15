import * as React from "react";

import StatusBanner from "@/shared/components/StatusBanner";
import Loader from "@/shared/components/Loader";

export default function NFTStatusBlock({
  isRedeeming,
  VRFPending,
  redeemMsg,
  isMobile,
  fetchStats,
  fetchREWARDS,
  fetchWalletAssets,
  walletAddress,
  galleryLoading,
  myNFTs,
}) {
  return (
    <>
      <StatusBanner
        isRedeeming={isRedeeming}
        VRFPending={VRFPending}
        redeemMsg={redeemMsg}
        onRefresh={async () => {
          await Promise.allSettled([
            fetchStats?.(),
            fetchREWARDS?.(),
            fetchWalletAssets?.(walletAddress),
          ]);
        }}
        compact={isMobile}
      />

      {galleryLoading && <Loader text="Loading..." />}
      {!galleryLoading && myNFTs.length === 0 && (
        <div style={{ color: "#aaa" }}>You don't own any NFTs or tickets.</div>
      )}
    </>
  );
}
