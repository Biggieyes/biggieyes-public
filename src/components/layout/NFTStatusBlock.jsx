import * as React from "react";
import StatusBanner from "../common/StatusBanner";
import Loader from "../common/Loader";

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
          await fetchStats();
          await fetchREWARDS();
          await fetchWalletAssets(walletAddress);
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



