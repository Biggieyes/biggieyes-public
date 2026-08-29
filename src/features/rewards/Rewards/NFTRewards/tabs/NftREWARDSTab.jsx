import * as React from "react";
import NftREWARDSSection from "../NftREWARDSSection.jsx";

function NftREWARDSTab({
  data,
  loading,
  error,
  walletAddress,
  formatInteger,
  formatAddress,
  formatUriDisplay,
  onOpenExplorer,
  canClaim,
  claimState,
  onClaimReward,
  feedback,
}) {
  return (
    <section className="rewards-grid__section rewards-grid__section--nft">
      <NftREWARDSSection
        data={data}
        loading={loading}
        error={error}
        walletAddress={walletAddress}
        formatInteger={formatInteger}
        formatAddress={formatAddress}
        formatUriDisplay={formatUriDisplay}
        onOpenExplorer={onOpenExplorer}
        canClaim={canClaim}
        claimState={claimState}
        onClaimReward={onClaimReward}
        feedback={feedback}
      />
    </section>
  );
}

export default NftREWARDSTab;
