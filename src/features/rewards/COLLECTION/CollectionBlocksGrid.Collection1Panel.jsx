import * as React from "react";
import { FALLBACK_VALUE } from "./COLLECTIONBlocksGrid.constants";
import CollectionStructure from "./CollectionStructure";

const SectionHeader = ({ label, accent = "#ffe800" }) => (
  <div
    className="collection-grid__section-header"
    style={{ "--section-accent": accent }}
  >
    <span className="collection-grid__section-title">{label}</span>
    <span className="collection-grid__section-line" />
  </div>
);

/**
 * COLLECTION1Panel - Renders the first COLLECTION (Main COLLECTION)
 * Displays blocks grid with COLLECTION stats
 * @component
 */
const COLLECTION1Panel = React.memo(
  ({
    renderBlockCardsGrid,
    blockEntries,
    stats,
    mintedSupply,
    maxSupply,
    paused,
    additionalText,
    renderChapterSwitcher,
    chapterId,
    chapterName,
    comingSoon = false,
  }) => {
    const nf0 = React.useMemo(
      () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
      [],
    );
    const heroStats = React.useMemo(() => {
      const minted =
        mintedSupply != null && Number.isFinite(Number(mintedSupply))
          ? Number(mintedSupply)
          : Number.isFinite(stats?.totalMinted)
            ? stats.totalMinted
            : null;
      const supply =
        maxSupply != null && Number.isFinite(Number(maxSupply))
          ? Number(maxSupply)
          : null;
      const remaining =
        minted != null && supply != null ? Math.max(0, supply - minted) : null;
      const mintedByBlock = (Array.isArray(blockEntries) ? blockEntries : [])
        .filter((entry) => entry?.hasData && Number.isFinite(entry?.minted))
        .map((entry) => ({ name: entry.name, minted: entry.minted }));
      const mostDrawnCount = mintedByBlock.length
        ? Math.max(...mintedByBlock.map((entry) => entry.minted))
        : null;
      const mostDrawnBlocks =
        mostDrawnCount != null && mostDrawnCount > 0
          ? mintedByBlock.filter((entry) => entry.minted === mostDrawnCount)
          : [];
      const mostDrawnValue =
        mostDrawnCount == null
          ? FALLBACK_VALUE
          : mostDrawnCount === 0
            ? "None yet"
            : mostDrawnBlocks.length === 1
              ? mostDrawnBlocks[0].name
              : "Tie";
      const mostDrawnHint =
        mostDrawnCount == null
          ? "Waiting for Polygon data"
          : mostDrawnCount === 0
            ? "The first draw will set the leader"
            : mostDrawnBlocks.length === 1
              ? `${nf0.format(mostDrawnCount)} ${mostDrawnCount === 1 ? "NFT" : "NFTs"} drawn`
              : `${mostDrawnBlocks.length} eye colors with ${nf0.format(mostDrawnCount)} each`;
      const statusValue =
        paused == null ? "Checking" : paused ? "Paused" : "Active";
      const statusHint =
        paused == null
          ? "Reading the Polygon contract"
          : paused
            ? "On-chain VRF minting is paused"
            : "VRF collection contract is active";

      return [
        {
          label: "NFTs minted",
          value:
            minted != null && supply != null
              ? `${nf0.format(minted)} / ${nf0.format(supply)}`
              : minted != null
                ? nf0.format(minted)
                : FALLBACK_VALUE,
          hint: "Confirmed VRF draws on Polygon",
        },
        {
          label: "NFTs remaining",
          value: remaining != null ? nf0.format(remaining) : FALLBACK_VALUE,
          hint: "Still available in this collection",
        },
        {
          label: "Most drawn eye color",
          value: mostDrawnValue,
          hint: mostDrawnHint,
        },
        {
          label: "VRF collection",
          value: statusValue,
          hint: statusHint,
        },
      ];
    }, [
      blockEntries,
      maxSupply,
      mintedSupply,
      nf0,
      paused,
      stats?.totalMinted,
    ]);

    if (!blockEntries || blockEntries.length === 0) {
      return (
        <div className="collection-grid__panel">
          <div className="collection-grid__panel-empty">
            <p>Loading blocks...</p>
          </div>
        </div>
      );
    }

    return (
      <>
        <section className="collection-top-panel">
          <div className="collection-hero">
            {heroStats.map((stat) => (
              <article key={stat.label} className="collection-hero__card">
                <span className="collection-hero__label">{stat.label}</span>
                <span className="collection-hero__value">{comingSoon ? "SOON" : stat.value}</span>
                <span className="collection-hero__hint">{comingSoon ? "Future chapter" : stat.hint}</span>
              </article>
            ))}
          </div>
        </section>

        {additionalText && (
          <p className="collection-grid__note">{additionalText}</p>
        )}

        <SectionHeader label="Blocks" accent="#5ddcff" />
        <section className="collection-grid__cards-panel">
          {renderChapterSwitcher?.()}
          <div className="collection-grid__cards">{renderBlockCardsGrid()}</div>
        </section>

        <SectionHeader label="Structure" accent="#ff8a00" />
        <CollectionStructure
          blockEntries={blockEntries}
          chapterId={chapterId}
          chapterName={chapterName}
          comingSoon={comingSoon}
        />
      </>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if these specific props change
    return (
      prevProps.blockEntries === nextProps.blockEntries &&
      prevProps.blockPrices === nextProps.blockPrices &&
      prevProps.blockMints === nextProps.blockMints &&
      prevProps.stats === nextProps.stats &&
      prevProps.chapterId === nextProps.chapterId &&
      prevProps.chapterName === nextProps.chapterName &&
      prevProps.comingSoon === nextProps.comingSoon &&
      prevProps.renderBlockCardsGrid === nextProps.renderBlockCardsGrid &&
      prevProps.mintedSupply === nextProps.mintedSupply &&
      prevProps.maxSupply === nextProps.maxSupply &&
      prevProps.paused === nextProps.paused &&
      prevProps.additionalText === nextProps.additionalText &&
      prevProps.renderChapterSwitcher === nextProps.renderChapterSwitcher
    );
  },
);

COLLECTION1Panel.displayName = "COLLECTION1Panel";

export default COLLECTION1Panel;
