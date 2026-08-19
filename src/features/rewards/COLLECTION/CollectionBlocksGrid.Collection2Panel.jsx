import * as React from "react";
import { FALLBACK_VALUE } from "./COLLECTIONBlocksGrid.constants";
import { formatPrice, formatCount } from "./COLLECTIONBlocksGrid.utils";

const PUBLIC_MAX_SUPPLY = 100;

const SectionHeader = ({ label, accent = "#ffe800" }) => (
  <div
    className="collection-grid__section-header"
    style={{ "--section-accent": accent }}
  >
    <span className="collection-grid__section-title">{label}</span>
    <span className="collection-grid__section-line" />
  </div>
);

const percent = (value, maximum) => {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, (value / maximum) * 100));
};

const resolveMintStatus = ({ totals, info, loading, error, hasSelection }) => {
  if (totals?.paused == null) return { label: "Checking", tone: "neutral" };
  if (totals.paused) return { label: "Paused", tone: "warn" };
  if (!totals.chapterActive) return { label: "Chapter inactive", tone: "warn" };
  if (!totals.metadataFullyConfigured) {
    return { label: "Metadata incomplete", tone: "warn" };
  }
  if (!totals.publicUnlocked)
    return { label: "Public mint locked", tone: "warn" };
  if (!hasSelection) return { label: "Select an NFT", tone: "neutral" };
  if (loading) return { label: "Loading NFT", tone: "neutral" };
  if (error || !info?.configured) {
    return { label: "NFT metadata unavailable", tone: "warn" };
  }
  if (info.minted) return { label: "Already minted", tone: "warn" };
  return { label: "Available", tone: "ok" };
};

const COLLECTION2Panel = React.memo(
  ({
    renderBlockCardsGrid,
    blockEntries,
    desiredTokenId,
    selectedEntry,
    selectedNftInfo,
    selectedNftLoading,
    selectedNftError,
    COLLECTIONTotals,
    onTokenIdChange,
  }) => {
    const hasSelection = /^\d+$/.test(String(desiredTokenId || ""));
    const selectedBlockName = selectedNftInfo?.configured
      ? blockEntries[selectedNftInfo.blockIdx - 1]?.name ||
        `Block ${selectedNftInfo.blockIdx}`
      : FALLBACK_VALUE;
    const selectedBlockPrice =
      selectedNftInfo?.configured &&
      Number.isFinite(selectedEntry?.currentPrice)
        ? selectedEntry.currentPrice
        : null;
    const mintedPct = percent(
      COLLECTIONTotals?.biggiMinted,
      COLLECTIONTotals?.maxSupply,
    );
    const metadataPct = percent(
      COLLECTIONTotals?.metadataConfiguredCount,
      COLLECTIONTotals?.maxSupply,
    );
    const mintStatus = resolveMintStatus({
      totals: COLLECTIONTotals,
      info: selectedNftInfo,
      loading: selectedNftLoading,
      error: selectedNftError,
      hasSelection,
    });

    if (!blockEntries || blockEntries.length === 0) {
      return (
        <div className="collection-grid__panel-empty">Loading blocks...</div>
      );
    }

    return (
      <section className="collection-grid__panel collection-grid__panel--glass">
        <SectionHeader label="Public collection" accent="#5ddcff" />

        <div className="collection-grid__two-column collection-grid__two-column--balanced">
          <article className="collection-grid__cardbox collection-grid__cardbox--frosted">
            <div className="collection-grid__cardbox-head">
              <h3>NFT lookup</h3>
              <span className="collection-grid__pill collection-grid__pill--outline">
                1-{COLLECTIONTotals?.maxSupply || PUBLIC_MAX_SUPPLY}
              </span>
            </div>
            <label className="collection-grid__form-field">
              <span>NFT number</span>
              <input
                type="number"
                min="1"
                max={COLLECTIONTotals?.maxSupply || PUBLIC_MAX_SUPPLY}
                step="1"
                value={desiredTokenId}
                onChange={(event) => onTokenIdChange(event.target.value)}
                placeholder="Enter NFT number"
              />
            </label>
            <p className="collection-grid__helper">
              Each NFT has one fixed block. Public NFTs do not use background
              variants.
            </p>
          </article>

          <article className="collection-grid__cardbox collection-grid__cardbox--frosted">
            <div className="collection-grid__cardbox-head">
              <h3>Mint details</h3>
              <span
                className={`collection-grid__pill collection-grid__pill--${mintStatus.tone}`}
              >
                {mintStatus.label}
              </span>
            </div>
            <dl className="collection-grid__key-values">
              <div>
                <dt>Block</dt>
                <dd>{selectedNftLoading ? "Loading..." : selectedBlockName}</dd>
              </div>
              <div>
                <dt>Exact mint price</dt>
                <dd className="collection-grid__price-live">
                  {formatPrice(selectedBlockPrice)}
                </dd>
              </div>
              <div>
                <dt>NFT state</dt>
                <dd>
                  {selectedNftInfo?.configured
                    ? selectedNftInfo.minted
                      ? "Minted"
                      : "Available"
                    : FALLBACK_VALUE}
                </dd>
              </div>
            </dl>
            {selectedNftError ? (
              <p className="collection-grid__helper">{selectedNftError}</p>
            ) : null}
          </article>
        </div>

        <div className="collection-grid__stat-cards collection-grid__stat-cards--wide">
          <article className="collection-grid__stat-card collection-grid__stat-card--glass">
            <span className="muted">Public NFTs minted</span>
            <strong className="collection-grid__stat-value-large">
              {formatCount(COLLECTIONTotals?.biggiMinted)} /{" "}
              {formatCount(COLLECTIONTotals?.maxSupply)}
            </strong>
            <div className="collection-grid__progress">
              <span
                className="collection-grid__progress-bar"
                style={{ width: `${mintedPct ?? 0}%` }}
              />
            </div>
          </article>
          <article className="collection-grid__stat-card collection-grid__stat-card--glass">
            <span className="muted">Metadata configured</span>
            <strong className="collection-grid__stat-value-large">
              {formatCount(COLLECTIONTotals?.metadataConfiguredCount)} /{" "}
              {formatCount(COLLECTIONTotals?.maxSupply)}
            </strong>
            <div className="collection-grid__progress">
              <span
                className="collection-grid__progress-bar"
                style={{ width: `${metadataPct ?? 0}%` }}
              />
            </div>
          </article>
          <article className="collection-grid__stat-card collection-grid__stat-card--glass">
            <span className="muted">Public gate</span>
            <strong className="collection-grid__stat-value-large">
              {COLLECTIONTotals?.publicUnlocked ? "Unlocked" : "Locked"}
            </strong>
            <span className="collection-grid__stat-foot">Polygon mainnet</span>
          </article>
        </div>

        <SectionHeader label="Block prices" accent="#5ddcff" />
        <div className="collection-grid__cards">{renderBlockCardsGrid()}</div>
      </section>
    );
  },
);

COLLECTION2Panel.displayName = "COLLECTION2Panel";

export default COLLECTION2Panel;
