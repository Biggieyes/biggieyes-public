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
    blockPrices,
    blockMints,
    stats,
    highestPriceName,
    lowestPriceName,
    topMintedName,
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
    const nf2 = React.useMemo(
      () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }),
      [],
    );

    const fmt = (v, digits = 0) =>
      Number.isFinite(v) ? (digits ? nf2.format(v) : nf0.format(v)) : null;

    const heroStats = React.useMemo(() => {
      const high = Number.isFinite(stats?.highestPrice?.value)
        ? stats.highestPrice.value
        : null;
      const low = Number.isFinite(stats?.lowestPrice?.value)
        ? stats.lowestPrice.value
        : null;
      const spread = high != null && low != null ? high - low : null;

      return [
        {
          label: "Blocks configured",
          value: fmt(stats.blocksWithData) ?? FALLBACK_VALUE,
          hint: "Renderable cards",
        },
        {
          label: "Total minted",
          value: fmt(stats.totalMinted) ?? FALLBACK_VALUE,
          hint: topMintedName || "Live supply depth",
        },
        {
          label: "Average price",
          value:
            stats.averagePrice != null
              ? `${fmt(stats.averagePrice, 2)} POL`
              : FALLBACK_VALUE,
          hint: highestPriceName || "Pricing snapshot",
        },
        {
          label: "Price spread",
          value: spread != null ? `${fmt(spread, 2)} POL` : FALLBACK_VALUE,
          hint:
            low != null && high != null
              ? `${fmt(low, 2)}–${fmt(high, 2)} POL`
              : lowestPriceName || "Range pending",
        },
      ];
    }, [
      fmt,
      stats.blocksWithData,
      stats.totalMinted,
      stats.averagePrice,
      stats.highestPrice?.value,
      stats.lowestPrice?.value,
      topMintedName,
      highestPriceName,
      lowestPriceName,
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
      prevProps.highestPriceName === nextProps.highestPriceName &&
      prevProps.lowestPriceName === nextProps.lowestPriceName &&
      prevProps.topMintedName === nextProps.topMintedName &&
      prevProps.additionalText === nextProps.additionalText &&
      prevProps.renderChapterSwitcher === nextProps.renderChapterSwitcher
    );
  },
);

COLLECTION1Panel.displayName = "COLLECTION1Panel";

export default COLLECTION1Panel;
