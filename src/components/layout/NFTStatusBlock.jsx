import * as React from "react";
import StatusBanner from "../common/StatusBanner";
import Loader from "../common/Loader";

export default function NFTStatusBlock({
  isRedeeming,
  vrfPending,
  redeemMsg,
  isMobile,
  fetchStats,
  fetchRewards,
  fetchWalletAssets,
  walletAddress,
  galleryLoading,
  myNFTs,
}) {
  return (
    <>
      <StatusBanner
        isRedeeming={isRedeeming}
        vrfPending={vrfPending}
        redeemMsg={redeemMsg}
        onRefresh={async () => {
          await fetchStats();
          await fetchRewards();
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

