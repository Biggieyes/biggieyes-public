import * as React from "react";
import { FALLBACK_VALUE } from "./COLLECTIONBlocksGrid.constants";
import { formatPrice, formatCount } from "./COLLECTIONBlocksGrid.utils";
import { BACKGROUND_BONUSES, BACKGROUND_NAMES } from "@/shared/utils/shared";

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
 * COLLECTION2Panel - Renders the second COLLECTION (Public COLLECTION)
 * Displays blocks grid with mint interface and COLLECTION status
 * @component
 */
const COLLECTION2Panel = React.memo(
  ({
    renderBlockCardsGrid,
    blockEntries,
    selectedBlock,
    selectedBackground,
    desiredTokenId,
    selectedEntry,
    COLLECTIONTotals,
    onBlockChange,
    onBackgroundChange,
    onTokenIdChange,
  }) => {
    const bgIndex = React.useMemo(() => {
      const idx = Number(selectedBackground);
      if (!Number.isFinite(idx)) return null;
      const zero = idx - 1;
      if (zero < 0 || zero >= BACKGROUND_BONUSES.length) return null;
      return zero;
    }, [selectedBackground]);

    const bgBonusPct = React.useMemo(() => {
      if (bgIndex == null) return null;
      return BACKGROUND_BONUSES[bgIndex] ?? null;
    }, [bgIndex]);

    const bgName = React.useMemo(() => {
      if (bgIndex == null) return null;
      return BACKGROUND_NAMES[bgIndex] ?? null;
    }, [bgIndex]);

    const selectedBlockPrice = React.useMemo(() => {
      const price = selectedEntry?.currentPrice;
      return Number.isFinite(price) ? price : null;
    }, [selectedEntry?.currentPrice]);

    const backgroundBonusAmount = React.useMemo(() => {
      if (selectedBlockPrice == null || bgBonusPct == null) return null;
      return (selectedBlockPrice * bgBonusPct) / 100;
    }, [selectedBlockPrice, bgBonusPct]);

    const finalPrice = React.useMemo(() => {
      if (selectedBlockPrice == null) return null;
      if (backgroundBonusAmount == null) return selectedBlockPrice;
      return selectedBlockPrice + backgroundBonusAmount;
    }, [selectedBlockPrice, backgroundBonusAmount]);

    const mintedPct = React.useMemo(() => {
      if (!COLLECTIONTotals?.maxSupply) return null;
      return (COLLECTIONTotals.biggiMinted / COLLECTIONTotals.maxSupply) * 100;
    }, [COLLECTIONTotals?.biggiMinted, COLLECTIONTotals?.maxSupply]);

    const ticketsPct = React.useMemo(() => {
      if (!COLLECTIONTotals?.maxTickets) return null;
      return (
        (COLLECTIONTotals.ticketMinted / COLLECTIONTotals.maxTickets) * 100
      );
    }, [COLLECTIONTotals?.ticketMinted, COLLECTIONTotals?.maxTickets]);

    const nativeRevenue =
      COLLECTIONTotals?.totalRaisedNative ??
      COLLECTIONTotals?.nativeRevenue ??
      null;
    const nativeRevenueLabel = formatPrice(nativeRevenue);

    const formatPct = (val) =>
      Number.isFinite(val) ? `${val.toFixed(1)}%` : FALLBACK_VALUE;
    const mintedBarWidth = mintedPct
      ? Math.min(mintedPct, 100).toFixed(1)
      : "12";
    const revenueSpark = React.useMemo(() => {
      const points = COLLECTIONTotals?.revenueTrend || [];
      if (!Array.isArray(points) || points.length === 0) return null;
      const normalized = points.map((v) => (Number.isFinite(v) ? v : 0));
      const max = Math.max(...normalized, 1);
      const coords = normalized.map(
        (v, i) =>
          `${i * (100 / (normalized.length - 1))},${100 - (v / max) * 100}`,
      );
      return coords.join(" ");
    }, [COLLECTIONTotals?.revenueTrend]);

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
      <section className="collection-grid__panel collection-grid__panel--glass">
        <SectionHeader label="Public mint" accent="#ffe800" />
        <header className="collection-grid__panel-header collection-grid__panel-header--stacked">
          <div className="collection-grid__panel-title">
            <div className="collection-grid__pill collection-grid__pill--gradient">
              Public mint
            </div>
            <h3>COLLECTION 2</h3>
          </div>
          <p className="collection-grid__panel-subtitle">
            Live pricing, availability, and a streamlined mint helper for every
            block.
          </p>
        </header>

        <div className="collection-grid__panel collection-grid__panel--glass-inner">
          <div className="collection-grid__two-column collection-grid__two-column--balanced">
            <div className="collection-grid__cardbox collection-grid__cardbox--frosted">
              <div className="collection-grid__cardbox-head">
                <h4>Mint setup</h4>
                <span className="collection-grid__pill collection-grid__pill--outline">
                  COLLECTIONPublic
                </span>
              </div>

              <form
                className="collection-grid__form"
                onSubmit={(e) => e.preventDefault()}
              >
                <label className="collection-grid__form-field">
                  <span>Block</span>
                  <select
                    name="block"
                    value={selectedBlock}
                    onChange={(event) =>
                      onBlockChange(Number(event.target.value) || 1)
                    }
                  >
                    {blockEntries
                      .filter((e) => e.hasData)
                      .map((e, i) => (
                        <option key={e.id} value={i + 1}>
                          {e.name || `Block ${i + 1}`}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="collection-grid__form-field">
                  <span>Background</span>
                  <select
                    name="background"
                    value={selectedBackground}
                    onChange={(event) =>
                      onBackgroundChange(Number(event.target.value) || 1)
                    }
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((bg) => (
                      <option key={bg} value={bg}>
                        Background {bg}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="collection-grid__form-field">
                  <span>NFT ID</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={desiredTokenId}
                    onChange={(event) => onTokenIdChange(event.target.value)}
                    placeholder="Optional token id"
                  />
                </label>
              </form>
            </div>

            <div className="collection-grid__cardbox collection-grid__cardbox--frosted">
              <div className="collection-grid__cardbox-head">
                <h4>Mint details</h4>
                <span className="collection-grid__pill collection-grid__pill--soft">
                  On-chain
                </span>
              </div>
              <dl className="collection-grid__key-values">
                <div>
                  <dt>Block price</dt>
                  <dd className="collection-grid__price-live">
                    {formatPrice(selectedBlockPrice)}
                  </dd>
                </div>
                <div>
                  <dt>Background bonus</dt>
                  <dd>
                    {bgBonusPct != null
                      ? `${bgName ? `${bgName} ` : ""}+${bgBonusPct}%`
                      : FALLBACK_VALUE}
                  </dd>
                </div>
                <div>
                  <dt>Final price</dt>
                  <dd>{formatPrice(finalPrice)}</dd>
                </div>
                <div>
                  <dt>Minted in block</dt>
                  <dd>{formatCount(selectedEntry?.minted)}</dd>
                </div>
                <div>
                  <dt>Selected NFT</dt>
                  <dd>{desiredTokenId ? `#${desiredTokenId}` : "Not set"}</dd>
                </div>
              </dl>
              <div className="collection-grid__micro-chart">
                <div className="collection-grid__micro-chart-head">
                  <span>Mint progress</span>
                  <span>{formatPct(mintedPct)}</span>
                </div>
                <div className="collection-grid__micro-chart-track">
                  <div
                    className="collection-grid__micro-chart-fill"
                    style={{ width: `${mintedBarWidth}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                className="collection-grid__action-btn collection-grid__action-btn--primary"
                disabled
              >
                Mint NFT (publicMintNFTById)
              </button>
              <p className="collection-grid__helper">
                Live data, action disabled in preview.
              </p>
            </div>
          </div>

          <div className="collection-grid__stat-cards collection-grid__stat-cards--wide">
            <div className="collection-grid__stat-card collection-grid__stat-card--glass">
              <span className="muted">Minted</span>
              <span className="collection-grid__stat-value-large">
                {formatCount(COLLECTIONTotals.biggiMinted)}
              </span>
              <span className="collection-grid__stat-sub">
                {COLLECTIONTotals.maxSupply
                  ? `z ${COLLECTIONTotals.maxSupply}`
                  : FALLBACK_VALUE}
              </span>
              <div className="collection-grid__progress">
                <div
                  className="collection-grid__progress-bar"
                  style={{
                    width: mintedPct
                      ? `${Math.min(mintedPct, 100).toFixed(1)}%`
                      : "0%",
                  }}
                />
              </div>
              <span className="collection-grid__stat-foot">
                {formatPct(mintedPct)}
              </span>
            </div>
            <div className="collection-grid__stat-card collection-grid__stat-card--glass">
              <span className="muted">Revenue (native)</span>
              <span className="collection-grid__stat-value-large">
                {nativeRevenueLabel || FALLBACK_VALUE}
              </span>
              <span className="collection-grid__stat-sub">
                Total earned on-chain
              </span>
              {revenueSpark ? (
                <div
                  className="collection-grid__sparkline"
                  aria-label="Revenue trend"
                >
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline points={revenueSpark} />
                  </svg>
                </div>
              ) : (
                <div className="collection-grid__sparkline collection-grid__sparkline--empty">
                  Waiting for trend
                </div>
              )}
              <span className="collection-grid__stat-foot">Live snapshot</span>
            </div>
            <div className="collection-grid__stat-card collection-grid__stat-card--glass">
              <span className="muted">Status</span>
              <span className="collection-grid__stat-value-large">
                {COLLECTIONTotals.paused ? "Paused" : "Live"}
              </span>
              <span className="collection-grid__stat-sub">Network</span>
              <span className="collection-grid__stat-foot">Polygon Amoy</span>
            </div>
          </div>
        </div>

        <SectionHeader label="Mintable blocks" accent="#5ddcff" />
        <section className="collection-grid__cards-panel">
          <div className="collection-grid__cards-heading">
            <div>
              <p className="collection-grid__chip collection-grid__chip--ghost">
                Mintable blocks
              </p>
              <h4 className="collection-grid__cards-title">
                Pick a block and background, then mint.
              </h4>
            </div>
            <p className="collection-grid__cards-sub">
              Five tiles per row on desktop; smaller screens auto-collapse.
            </p>
          </div>

          <div className="collection-grid__cards">{renderBlockCardsGrid()}</div>
        </section>
      </section>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if these specific props change
    return (
      prevProps.blockEntries === nextProps.blockEntries &&
      prevProps.selectedBlock === nextProps.selectedBlock &&
      prevProps.selectedBackground === nextProps.selectedBackground &&
      prevProps.desiredTokenId === nextProps.desiredTokenId &&
      prevProps.selectedEntry === nextProps.selectedEntry &&
      prevProps.COLLECTIONTotals === nextProps.COLLECTIONTotals
    );
  },
);

COLLECTION2Panel.displayName = "COLLECTION2Panel";

export default COLLECTION2Panel;


