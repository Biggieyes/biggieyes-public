import * as React from "react";
import NftREWARDSSection from "../NftREWARDSSection.jsx";

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
    <section className="rewards-grid__section rewards-grid__section--nft">
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
