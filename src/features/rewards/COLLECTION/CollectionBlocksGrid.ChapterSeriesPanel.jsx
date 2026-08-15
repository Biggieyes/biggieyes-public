import * as React from "react";
import { ADDR } from "@/shared/utils/addresses.js";
import { explorerBaseFor } from "@/config/chains.js";
import {
  formatNativeDisplay,
  isRealAddress,
} from "@/features/tokenomics/utils/amountFormatting.js";
import { FALLBACK_VALUE } from "./COLLECTIONBlocksGrid.constants";

const explorerBase = explorerBaseFor(ADDR.CHAIN_ID || 137) || "https://polygonscan.com";

const SectionHeader = ({ label, accent = "#ffe800" }) => (
  <div
    className="collection-grid__section-header"
    style={{ "--section-accent": accent }}
  >
    <span className="collection-grid__section-title">{label}</span>
    <span className="collection-grid__section-line" />
  </div>
);

const asNumber = (value) => {
  if (value == null || value === "") return null;
  if (typeof value === "bigint") return Number(value);
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const formatInteger = (value) => {
  const numeric = asNumber(value);
  return numeric == null ? FALLBACK_VALUE : Math.round(numeric).toLocaleString();
};

const formatBool = (value) => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return FALLBACK_VALUE;
};

const shortAddress = (value) => {
  if (!isRealAddress(value)) return FALLBACK_VALUE;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const explorerHref = (value) =>
  isRealAddress(value) ? `${explorerBase}/address/${value}` : null;

const StatusPill = ({ value, trueLabel = "Live", falseLabel = "No" }) => {
  const state =
    value === true ? "ok" : value === false ? "warn" : "dim";
  return (
    <span className={`collection-series__pill collection-series__pill--${state}`}>
      {value === true ? trueLabel : value === false ? falseLabel : FALLBACK_VALUE}
    </span>
  );
};

const AddressValue = ({ value }) => {
  const href = explorerHref(value);
  return (
    <span className="collection-series__address">
      <span title={isRealAddress(value) ? value : undefined}>
        {shortAddress(value)}
      </span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          Explorer
        </a>
      ) : null}
    </span>
  );
};

const DataRow = ({ label, value, tone }) => (
  <div className="collection-series__row">
    <span className="collection-series__label">{label}</span>
    <span className={`collection-series__value${tone ? ` is-${tone}` : ""}`}>
      {value ?? FALLBACK_VALUE}
    </span>
  </div>
);

function ChapterSeriesPanel({
  chapterSeries,
  loading = false,
  error = null,
  onRefresh,
}) {
  const data = chapterSeries || {};
  const global = data.global || {};
  const collections = Array.isArray(data.collections) ? data.collections : [];
  const chapters = Array.isArray(data.chapters) ? data.chapters : [];
  const series = Array.isArray(data.series) ? data.series : [];
  const primaryChapter = chapters[0] || {};
  const primarySeries = series[0] || {};
  const vrfSnapshot =
    collections.find((item) => item.isVrfCollection) || collections[0] || {};
  const publicSnapshot =
    collections.find((item) => item.isPublicCollection) || collections[1] || {};

  const mintedPct = React.useMemo(() => {
    const minted = asNumber(primaryChapter.totalMinted);
    const cap = asNumber(primaryChapter.totalCap);
    if (minted == null || !cap) return null;
    return Math.min(100, Math.max(0, (minted / cap) * 100));
  }, [primaryChapter.totalCap, primaryChapter.totalMinted]);

  const heroCards = [
    {
      label: "Reader",
      value: shortAddress(data.reader),
      hint: "ChapterSeriesReader",
      tone: isRealAddress(data.reader) ? "ok" : "warn",
    },
    {
      label: "Series",
      value: primarySeries.name || `Series ${primarySeries.seriesId || ADDR.SERIES_ID || 1}`,
      hint: `${formatInteger(primarySeries.chapterCount)} chapters`,
      tone: primarySeries.exists ? "ok" : "warn",
    },
    {
      label: "Chapter",
      value: `#${primaryChapter.chapterNumber || ADDR.CHAPTER_ID || 1}`,
      hint: `${formatInteger(primaryChapter.totalMinted)} / ${formatInteger(primaryChapter.totalCap)} minted`,
      tone: primaryChapter.chapterExists ? "ok" : "warn",
    },
    {
      label: "Public unlock",
      value: formatBool(primaryChapter.publicUnlocked),
      hint: "VRF completion gate",
      tone: primaryChapter.publicUnlocked ? "ok" : "dim",
    },
  ];

  const collectionRows = [
    { label: "VRF collection", data: vrfSnapshot, expected: ADDR.COLLECTION_VRF || ADDR.MAIN },
    {
      label: "Public collection",
      data: publicSnapshot,
      expected: ADDR.COLLECTION_PUBLIC || ADDR.MAIN2,
    },
  ];

  return (
    <section className="collection-grid__panel collection-series">
      <header className="collection-grid__panel-header collection-grid__panel-header--stacked">
        <div className="collection-grid__panel-title">
          <div className="collection-grid__pill collection-grid__pill--gradient">
            Mainnet reader
          </div>
          <h3>Chapter / Series wiring</h3>
        </div>
        <p className="collection-grid__panel-subtitle">
          Live ChapterSeriesReader snapshot for the current Polygon mainnet
          collection pair, including reward eligibility and registry wiring.
        </p>
        <div className="collection-series__actions">
          <button
            type="button"
            className="collection-grid__btn"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh reader"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="collection-grid__onchain-warning" role="status">
          ChapterSeriesReader fallback is active. Check RPC or reader address.
        </div>
      ) : null}

      <div className="collection-series__hero">
        {heroCards.map((card) => (
          <article
            key={card.label}
            className={`collection-series__hero-card is-${card.tone}`}
          >
            <span className="collection-series__label">{card.label}</span>
            <span className="collection-series__hero-value">{card.value}</span>
            <span className="collection-series__hint">{card.hint}</span>
          </article>
        ))}
      </div>

      <SectionHeader label="Mainnet wiring" accent="#5ddcff" />
      <div className="collection-series__grid">
        <article className="collection-series__card">
          <h4>Reader contracts</h4>
          <div className="collection-series__table">
            <DataRow label="Network" value={`Polygon mainnet / chainId ${ADDR.CHAIN_ID || 137}`} tone="ok" />
            <DataRow label="Reader" value={<AddressValue value={data.reader} />} />
            <DataRow label="Controller" value={<AddressValue value={global.controller || ADDR.CHAPTER_CONTROLLER} />} />
            <DataRow label="Registry" value={<AddressValue value={global.registry || ADDR.SERIES_REGISTRY || ADDR.REGISTRY} />} />
            <DataRow
              label="Controller registry match"
              value={<StatusPill value={global.controllerMatchesRegistry} trueLabel="Matched" falseLabel="Mismatch" />}
            />
            <DataRow label="Series count" value={formatInteger(global.seriesCount)} />
            <DataRow label="Chapter count" value={formatInteger(global.chapterCount)} />
          </div>
        </article>

        <article className="collection-series__card">
          <h4>Active pair</h4>
          <div className="collection-series__table">
            {collectionRows.map((row) => {
              const snap = row.data || {};
              const addressMatches =
                isRealAddress(snap.collection) && isRealAddress(row.expected)
                  ? snap.collection.toLowerCase() === row.expected.toLowerCase()
                  : null;
              return (
                <React.Fragment key={row.label}>
                  <DataRow label={row.label} value={<AddressValue value={snap.collection || row.expected} />} />
                  <DataRow label={`${row.label} chapter`} value={formatInteger(snap.chapterNumber)} />
                  <DataRow label={`${row.label} series`} value={formatInteger(snap.seriesId)} />
                  <DataRow
                    label={`${row.label} address match`}
                    value={<StatusPill value={addressMatches} trueLabel="Matched" falseLabel="Mismatch" />}
                  />
                  <DataRow
                    label={`${row.label} token rewards`}
                    value={<StatusPill value={snap.tokenRewardsEligible} trueLabel="Eligible" falseLabel="Off" />}
                  />
                  <DataRow
                    label={`${row.label} collection rewards`}
                    value={<StatusPill value={snap.collectionRewardsEligible} trueLabel="Eligible" falseLabel="Off" />}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </article>
      </div>

      <SectionHeader label="Chapter snapshot" accent="#ffe800" />
      <article className="collection-series__card collection-series__card--wide">
        <div className="collection-series__chapter-layout">
          <div className="collection-series__table">
            <DataRow label="Chapter ID" value={formatInteger(primaryChapter.chapterId)} />
            <DataRow label="Series ID" value={formatInteger(primaryChapter.seriesId)} />
            <DataRow label="Chapter number" value={formatInteger(primaryChapter.chapterNumber)} />
            <DataRow
              label="Configured"
              value={<StatusPill value={primaryChapter.configured} trueLabel="Configured" falseLabel="Missing" />}
            />
            <DataRow
              label="Exists"
              value={<StatusPill value={primaryChapter.chapterExists} trueLabel="Exists" falseLabel="Missing" />}
            />
            <DataRow label="VRF collection" value={<AddressValue value={primaryChapter.vrfCollection} />} />
            <DataRow label="Public collection" value={<AddressValue value={primaryChapter.publicCollection} />} />
            <DataRow label="Ticket hub" value={<AddressValue value={primaryChapter.ticketHub} />} />
            <DataRow label="Price provider" value={<AddressValue value={primaryChapter.priceProvider} />} />
          </div>

          <div className="collection-series__table">
            <DataRow label="Sale cap" value={formatInteger(primaryChapter.saleCap)} />
            <DataRow label="Marketing cap" value={formatInteger(primaryChapter.marketingCap)} />
            <DataRow label="Total cap" value={formatInteger(primaryChapter.totalCap)} />
            <DataRow label="Sale minted" value={formatInteger(primaryChapter.saleMinted)} />
            <DataRow label="Marketing minted" value={formatInteger(primaryChapter.marketingMinted)} />
            <DataRow label="Total minted" value={formatInteger(primaryChapter.totalMinted)} />
            <DataRow
              label="Public unlocked"
              value={<StatusPill value={primaryChapter.publicUnlocked} trueLabel="Unlocked" falseLabel="Locked" />}
            />
            <DataRow
              label="VRF token rewards"
              value={<StatusPill value={primaryChapter.tokenRewardsEligibleVRF} trueLabel="Eligible" falseLabel="Off" />}
            />
            <DataRow
              label="Public token rewards"
              value={<StatusPill value={primaryChapter.tokenRewardsEligiblePublic} trueLabel="Eligible" falseLabel="Off" />}
            />
            <DataRow
              label="VRF collection rewards"
              value={<StatusPill value={primaryChapter.collectionRewardsEligibleVRF} trueLabel="Eligible" falseLabel="Off" />}
            />
          </div>
        </div>

        <div className="collection-series__progress">
          <div className="collection-series__progress-head">
            <span>Chapter mint progress</span>
            <span>
              {mintedPct == null ? FALLBACK_VALUE : `${mintedPct.toFixed(1)}%`}
            </span>
          </div>
          <div className="collection-series__progress-track">
            <span style={{ width: `${mintedPct ?? 0}%` }} />
          </div>
        </div>
      </article>

      <SectionHeader label="Series snapshot" accent="#b584ff" />
      <div className="collection-series__grid">
        {series.length ? (
          series.map((item) => (
            <article className="collection-series__card" key={item.seriesId || item.name}>
              <h4>{item.name || `Series ${item.seriesId || FALLBACK_VALUE}`}</h4>
              <div className="collection-series__table">
                <DataRow label="Series ID" value={formatInteger(item.seriesId)} />
                <DataRow
                  label="Exists"
                  value={<StatusPill value={item.exists} trueLabel="Exists" falseLabel="Missing" />}
                />
                <DataRow label="Chapter count" value={formatInteger(item.chapterCount)} />
              </div>
            </article>
          ))
        ) : (
          <article className="collection-series__card">
            <h4>Series</h4>
            <div className="collection-series__table">
              <DataRow label="Status" value={loading ? "Loading..." : FALLBACK_VALUE} />
            </div>
          </article>
        )}
      </div>

      <SectionHeader label="Collection economics" accent="#27d9d2" />
      <article className="collection-series__card collection-series__card--wide">
        <div className="collection-series__table">
          <DataRow
            label="Ticket price"
            value={formatNativeDisplay(ADDR.TICKET_PRICE_WEI || "1000000000000000000", 2)}
          />
          <DataRow label="Marketing tickets" value={formatInteger(ADDR.MARKETING_CAP)} />
          <DataRow label="Sale tickets" value={formatInteger(ADDR.SALE_CAP)} />
          <DataRow label="Configured series id" value={formatInteger(ADDR.SERIES_ID)} />
          <DataRow label="Configured chapter id" value={formatInteger(ADDR.CHAPTER_ID)} />
        </div>
      </article>
    </section>
  );
}

export default React.memo(ChapterSeriesPanel);
