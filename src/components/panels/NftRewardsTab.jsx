import * as React from "react";
import NftRewardsSection from "./NftRewardsSection";

function NftRewardsTab({
  data,
  range,
  formatInteger,
  formatAddress,
  formatUriDisplay,
  onOpenExplorer,
  emptyRanks,
}) {
  return (
    <section className="rewards-grid__section rewards-grid__section--nft">
      <NftRewardsSection
        data={data}
        range={range}
        formatInteger={formatInteger}
        formatAddress={formatAddress}
        formatUriDisplay={formatUriDisplay}
        onOpenExplorer={onOpenExplorer}
        emptyRanks={emptyRanks}
      />
    </section>
  );
}

export default NftRewardsTab;
