import * as React from "react";
import NftREWARDSSection from "../NftREWARDSSection";

function NftREWARDSTab({
  data,
  range,
  formatInteger,
  formatAddress,
  formatUriDisplay,
  onOpenExplorer,
  emptyRanks,
}) {
  return (
    <section className="REWARDS-grid__section REWARDS-grid__section--nft">
      <NftREWARDSSection
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

export default NftREWARDSTab;


