import * as React from "react";
import { ADDR, CORE_CHAPTERS } from "@/shared/utils/addresses.js";
import { explorerBaseFor } from "@/config/chains.js";
import {
  formatNativeDisplay,
  isRealAddress,
} from "@/features/tokenomics/utils/amountFormatting.js";
import { FALLBACK_VALUE } from "./COLLECTIONBlocksGrid.constants";

const explorerBase =
  explorerBaseFor(ADDR.CHAIN_ID || 137) || "https://polygonscan.com";

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
  return numeric == null
    ? FALLBACK_VALUE
    : Math.round(numeric).toLocaleString();
};

const shortAddress = (value) => {
  if (!isRealAddress(value)) return FALLBACK_VALUE;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const explorerHref = (value) =>
  isRealAddress(value) ? `${explorerBase}/address/${value}` : null;

const sameAddress = (left, right) => {
  if (!isRealAddress(left) || !isRealAddress(right)) return null;
  return left.toLowerCase() === right.toLowerCase();
};

const StatusPill = ({ value, trueLabel = "Live", falseLabel = "No" }) => {
  const state = value === true ? "ok" : value === false ? "warn" : "dim";
  return (
    <span
      className={`collection-series__pill collection-series__pill--${state}`}
    >
      {value === true
        ? trueLabel
        : value === false
          ? falseLabel
          : FALLBACK_VALUE}
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
  const chapterViews = React.useMemo(
    () =>
      CORE_CHAPTERS.map((config) => {
        const snapshot =
          chapters.find(
            (item) => asNumber(item.chapterId) === config.chapterId,
          ) || {};
        const vrfSnapshot =
          collections.find((item) =>
            sameAddress(item.collection, config.main),
          ) || {};
        const publicSnapshot =
          collections.find((item) =>
            sameAddress(item.collection, config.main2),
          ) || {};
        const minted = asNumber(snapshot.totalMinted);
        const cap = asNumber(snapshot.totalCap);

        return {
          config,
          snapshot,
          vrfSnapshot,
          publicSnapshot,
          minted,
          cap,
          mintedPct:
            minted == null || !cap
              ? null
              : Math.min(100, Math.max(0, (minted / cap) * 100)),
        };
      }),
    [chapters, collections],
  );

  const totals = chapterViews.reduce(
    (result, chapter) => {
      if (chapter.minted != null) {
        result.minted += chapter.minted;
        result.knownMinted += 1;
      }
      if (chapter.cap != null) {
        result.cap += chapter.cap;
        result.knownCap += 1;
      }
      if (chapter.snapshot.publicUnlocked != null) {
        result.knownUnlocks += 1;
        if (chapter.snapshot.publicUnlocked) result.unlocked += 1;
      }
      if (chapter.snapshot.active != null) {
        result.knownActive += 1;
        if (chapter.snapshot.active) result.active += 1;
      }
      return result;
    },
    {
      minted: 0,
      cap: 0,
      knownMinted: 0,
      knownCap: 0,
      unlocked: 0,
      knownUnlocks: 0,
      active: 0,
      knownActive: 0,
    },
  );

  const heroCards = [
    {
      label: "Reader",
      value: shortAddress(data.reader),
      hint: "ChapterSeriesReader",
      tone: isRealAddress(data.reader) ? "ok" : "warn",
    },
    {
      label: "Series",
      value: formatInteger(global.seriesCount ?? series.length),
      hint: "registered series",
      tone: series.length === CORE_CHAPTERS.length ? "ok" : "warn",
    },
    {
      label: "Chapters",
      value: formatInteger(global.chapterCount ?? chapters.length),
      hint:
        totals.knownMinted && totals.knownCap
          ? `${formatInteger(totals.minted)} / ${formatInteger(totals.cap)} tickets minted`
          : "live mint totals unavailable",
      tone: chapters.length === CORE_CHAPTERS.length ? "ok" : "warn",
    },
    {
      label: "Available chapters",
      value: totals.knownActive
        ? `${totals.active} / ${totals.knownActive}`
        : FALLBACK_VALUE,
      hint: "TicketHub chapterActive gates",
      tone: totals.knownActive > 0 && totals.active === 1 ? "ok" : "dim",
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
          Live ChapterSeriesReader snapshot for all Polygon mainnet collection
          pairs, including reward eligibility and registry wiring.
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
            <DataRow
              label="Network"
              value={`Polygon mainnet / chainId ${ADDR.CHAIN_ID || 137}`}
              tone="ok"
            />
            <DataRow
              label="Reader"
              value={<AddressValue value={data.reader} />}
            />
            <DataRow
              label="Controller"
              value={
                <AddressValue
                  value={global.controller || ADDR.CHAPTER_CONTROLLER}
                />
              }
            />
            <DataRow
              label="Registry"
              value={
                <AddressValue
                  value={
                    global.registry || ADDR.SERIES_REGISTRY || ADDR.REGISTRY
                  }
                />
              }
            />
            <DataRow
              label="Controller registry match"
              value={
                <StatusPill
                  value={global.controllerMatchesRegistry}
                  trueLabel="Matched"
                  falseLabel="Mismatch"
                />
              }
            />
            <DataRow
              label="Series count"
              value={formatInteger(global.seriesCount)}
            />
            <DataRow
              label="Chapter count"
              value={formatInteger(global.chapterCount)}
            />
          </div>
        </article>

        <article className="collection-series__card">
          <h4>Central CORE contracts</h4>
          <div className="collection-series__table">
            <DataRow
              label="Ticket hub"
              value={<AddressValue value={ADDR.TICKET_HUB} />}
            />
            <DataRow
              label="Series registry"
              value={
                <AddressValue value={ADDR.SERIES_REGISTRY || ADDR.REGISTRY} />
              }
            />
            <DataRow
              label="Chapter controller"
              value={<AddressValue value={ADDR.CHAPTER_CONTROLLER} />}
            />
            <DataRow
              label="Main reader"
              value={<AddressValue value={ADDR.MAIN_READER || ADDR.READER} />}
            />
            <DataRow
              label="Chapter reader"
              value={<AddressValue value={ADDR.CHAPTER_SERIES_READER} />}
            />
          </div>
        </article>
      </div>

      <SectionHeader label="Chapter snapshots" accent="#ffe800" />
      <div className="collection-series__grid">
        {chapterViews.map(
          ({ config, snapshot, vrfSnapshot, publicSnapshot, mintedPct }) => (
            <article className="collection-series__card" key={config.chapterId}>
              <h4>{`Chapter ${config.chapterId}: ${config.displayName}`}</h4>
              <div className="collection-series__table">
                <DataRow
                  label="Series"
                  value={`${config.seriesId} / ${config.seriesName}`}
                />
                <DataRow
                  label="Configured"
                  value={
                    <StatusPill
                      value={snapshot.configured}
                      trueLabel="Configured"
                      falseLabel="Missing"
                    />
                  }
                />
                <DataRow
                  label="Exists"
                  value={
                    <StatusPill
                      value={snapshot.chapterExists}
                      trueLabel="Exists"
                      falseLabel="Missing"
                    />
                  }
                />
                <DataRow
                  label="Sale availability"
                  value={
                    <StatusPill
                      value={snapshot.active}
                      trueLabel="Available"
                      falseLabel="Not active"
                    />
                  }
                />
                <DataRow
                  label="VRF collection"
                  value={
                    <AddressValue
                      value={snapshot.vrfCollection || config.main}
                    />
                  }
                />
                <DataRow
                  label="VRF address match"
                  value={
                    <StatusPill
                      value={sameAddress(snapshot.vrfCollection, config.main)}
                      trueLabel="Matched"
                      falseLabel="Mismatch"
                    />
                  }
                />
                <DataRow
                  label="Public collection"
                  value={
                    <AddressValue
                      value={snapshot.publicCollection || config.main2}
                    />
                  }
                />
                <DataRow
                  label="Public address match"
                  value={
                    <StatusPill
                      value={sameAddress(
                        snapshot.publicCollection,
                        config.main2,
                      )}
                      trueLabel="Matched"
                      falseLabel="Mismatch"
                    />
                  }
                />
                <DataRow
                  label="Ticket hub"
                  value={
                    <AddressValue
                      value={snapshot.ticketHub || ADDR.TICKET_HUB}
                    />
                  }
                />
                <DataRow
                  label="Price provider"
                  value={<AddressValue value={snapshot.priceProvider} />}
                />
                <DataRow
                  label="Sale minted / cap"
                  value={`${formatInteger(snapshot.saleMinted)} / ${formatInteger(snapshot.saleCap)}`}
                />
                <DataRow
                  label="Marketing minted / cap"
                  value={`${formatInteger(snapshot.marketingMinted)} / ${formatInteger(snapshot.marketingCap)}`}
                />
                <DataRow
                  label="Total minted / cap"
                  value={`${formatInteger(snapshot.totalMinted)} / ${formatInteger(snapshot.totalCap)}`}
                />
                <DataRow
                  label="Public gate"
                  value={
                    <StatusPill
                      value={snapshot.publicUnlocked}
                      trueLabel="Unlocked"
                      falseLabel="Locked"
                    />
                  }
                />
                <DataRow
                  label="VRF token rewards"
                  value={
                    <StatusPill
                      value={
                        vrfSnapshot.tokenRewardsEligible ??
                        snapshot.tokenRewardsEligibleVRF
                      }
                      trueLabel="Eligible"
                      falseLabel="Off"
                    />
                  }
                />
                <DataRow
                  label="Public token rewards"
                  value={
                    <StatusPill
                      value={
                        publicSnapshot.tokenRewardsEligible ??
                        snapshot.tokenRewardsEligiblePublic
                      }
                      trueLabel="Eligible"
                      falseLabel="Off"
                    />
                  }
                />
                <DataRow
                  label="VRF collection rewards"
                  value={
                    <StatusPill
                      value={
                        vrfSnapshot.collectionRewardsEligible ??
                        snapshot.collectionRewardsEligibleVRF
                      }
                      trueLabel="Eligible"
                      falseLabel="Off"
                    />
                  }
                />
              </div>
              <div className="collection-series__progress">
                <div className="collection-series__progress-head">
                  <span>Ticket mint progress</span>
                  <span>
                    {mintedPct == null
                      ? FALLBACK_VALUE
                      : `${mintedPct.toFixed(1)}%`}
                  </span>
                </div>
                <div className="collection-series__progress-track">
                  <span style={{ width: `${mintedPct ?? 0}%` }} />
                </div>
              </div>
            </article>
          ),
        )}
      </div>

      <SectionHeader label="Series snapshot" accent="#b584ff" />
      <div className="collection-series__grid">
        {series.length ? (
          series.map((item) => (
            <article
              className="collection-series__card"
              key={item.seriesId || item.name}
            >
              <h4>
                {item.name || `Series ${item.seriesId || FALLBACK_VALUE}`}
              </h4>
              <div className="collection-series__table">
                <DataRow
                  label="Series ID"
                  value={formatInteger(item.seriesId)}
                />
                <DataRow
                  label="Exists"
                  value={
                    <StatusPill
                      value={item.exists}
                      trueLabel="Exists"
                      falseLabel="Missing"
                    />
                  }
                />
                <DataRow
                  label="Chapter count"
                  value={formatInteger(item.chapterCount)}
                />
              </div>
            </article>
          ))
        ) : (
          <article className="collection-series__card">
            <h4>Series</h4>
            <div className="collection-series__table">
              <DataRow
                label="Status"
                value={loading ? "Loading..." : FALLBACK_VALUE}
              />
            </div>
          </article>
        )}
      </div>

      <SectionHeader label="Collection economics" accent="#27d9d2" />
      <article className="collection-series__card collection-series__card--wide">
        <div className="collection-series__table">
          <DataRow
            label="Ticket price"
            value={formatNativeDisplay(
              ADDR.TICKET_PRICE_WEI || "1000000000000000000",
              2,
            )}
          />
          <DataRow
            label="Marketing tickets / chapter"
            value={formatInteger(ADDR.MARKETING_CAP)}
          />
          <DataRow
            label="Sale tickets / chapter"
            value={formatInteger(ADDR.SALE_CAP)}
          />
          <DataRow
            label="Configured series"
            value={formatInteger(CORE_CHAPTERS.length)}
          />
          <DataRow
            label="Configured chapters"
            value={formatInteger(CORE_CHAPTERS.length)}
          />
        </div>
      </article>
    </section>
  );
}

export default React.memo(ChapterSeriesPanel);
