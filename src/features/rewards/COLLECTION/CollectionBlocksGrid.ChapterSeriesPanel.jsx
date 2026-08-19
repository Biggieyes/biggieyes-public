import * as React from "react";
import { ADDR, CORE_CHAPTERS } from "@/shared/utils/addresses.js";
import { explorerBaseFor } from "@/config/chains.js";
import { isRealAddress } from "@/features/tokenomics/utils/amountFormatting.js";
import { FALLBACK_VALUE } from "./COLLECTIONBlocksGrid.constants";

const explorerBase =
  explorerBaseFor(ADDR.CHAIN_ID || 137) || "https://polygonscan.com";

const asNumber = (value) => {
  if (value == null || value === "") return null;
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const formatInteger = (value) => {
  const numeric = asNumber(value);
  return numeric == null
    ? FALLBACK_VALUE
    : Math.round(numeric).toLocaleString();
};

const sameAddress = (left, right) =>
  isRealAddress(left) &&
  isRealAddress(right) &&
  left.toLowerCase() === right.toLowerCase();

const AddressValue = ({ value }) => {
  if (!isRealAddress(value)) return FALLBACK_VALUE;
  return (
    <a
      className="collection-series__address"
      href={`${explorerBase}/address/${value}`}
      target="_blank"
      rel="noreferrer"
      title={value}
    >
      {value.slice(0, 6)}...{value.slice(-4)}
    </a>
  );
};

const StatusPill = ({ value, trueLabel = "Ready", falseLabel = "Pending" }) => {
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

const DataRow = ({ label, value }) => (
  <div className="collection-series__row">
    <span className="collection-series__label">{label}</span>
    <span className="collection-series__value">{value ?? FALLBACK_VALUE}</span>
  </div>
);

const chapterStatus = (snapshot) => {
  if (snapshot.active === true) return { label: "Available now", tone: "ok" };
  if (snapshot.configured === false || snapshot.chapterExists === false) {
    return { label: "Configuration pending", tone: "warn" };
  }
  return { label: "Not active", tone: "dim" };
};

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
        const mintedPct =
          minted == null || !cap
            ? 0
            : Math.min(100, Math.max(0, (minted / cap) * 100));
        return {
          config,
          snapshot,
          vrfSnapshot,
          publicSnapshot,
          minted,
          cap,
          mintedPct,
          status: chapterStatus(snapshot),
        };
      }),
    [chapters, collections],
  );

  const totals = chapterViews.reduce(
    (result, chapter) => ({
      minted: result.minted + (chapter.minted || 0),
      cap: result.cap + (chapter.cap || 0),
      active: result.active + (chapter.snapshot.active === true ? 1 : 0),
      publicUnlocked:
        result.publicUnlocked +
        (chapter.snapshot.publicUnlocked === true ? 1 : 0),
    }),
    { minted: 0, cap: 0, active: 0, publicUnlocked: 0 },
  );

  return (
    <section className="collection-grid__panel collection-series">
      <header className="collection-grid__panel-header">
        <div>
          <h3>Chapters</h3>
          <p className="collection-grid__panel-subtitle">
            Collections open sequentially. Only one chapter can be available at
            a time.
          </p>
        </div>
        <button
          type="button"
          className="collection-grid__btn"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error ? (
        <div className="collection-grid__onchain-warning" role="status">
          Live chapter data is temporarily unavailable.
        </div>
      ) : null}

      <div className="collection-series__hero">
        <article className="collection-series__hero-card">
          <span className="collection-series__label">Available chapters</span>
          <strong className="collection-series__hero-value">
            {totals.active} / {CORE_CHAPTERS.length}
          </strong>
          <span className="collection-series__hint">TicketHub gate</span>
        </article>
        <article className="collection-series__hero-card">
          <span className="collection-series__label">Tickets minted</span>
          <strong className="collection-series__hero-value">
            {formatInteger(totals.minted)} / {formatInteger(totals.cap)}
          </strong>
          <span className="collection-series__hint">All chapters</span>
        </article>
        <article className="collection-series__hero-card">
          <span className="collection-series__label">Public mint unlocked</span>
          <strong className="collection-series__hero-value">
            {totals.publicUnlocked} / {CORE_CHAPTERS.length}
          </strong>
          <span className="collection-series__hint">Chapter controller</span>
        </article>
      </div>

      <div className="collection-series__grid">
        {chapterViews.map(
          ({
            config,
            snapshot,
            vrfSnapshot,
            publicSnapshot,
            minted,
            cap,
            mintedPct,
            status,
          }) => (
            <article className="collection-series__card" key={config.chapterId}>
              <div className="collection-series__card-head">
                <div>
                  <span className="collection-series__eyebrow">
                    Chapter {config.chapterId}
                  </span>
                  <h4>{config.displayName}</h4>
                </div>
                <span
                  className={`collection-series__pill collection-series__pill--${status.tone}`}
                >
                  {status.label}
                </span>
              </div>

              <div className="collection-series__table">
                <DataRow
                  label="Tickets"
                  value={`${formatInteger(minted)} / ${formatInteger(cap)}`}
                />
                <DataRow
                  label="Public collection"
                  value={
                    <StatusPill
                      value={snapshot.publicUnlocked}
                      trueLabel="Unlocked"
                      falseLabel="Locked"
                    />
                  }
                />
              </div>

              <div className="collection-series__progress">
                <div className="collection-series__progress-head">
                  <span>Ticket progress</span>
                  <span>{mintedPct.toFixed(1)}%</span>
                </div>
                <div className="collection-series__progress-track">
                  <span style={{ width: `${mintedPct}%` }} />
                </div>
              </div>

              <details className="collection-series__details">
                <summary>Technical details</summary>
                <div className="collection-series__table">
                  <DataRow
                    label="Configured"
                    value={
                      <StatusPill
                        value={snapshot.configured && snapshot.chapterExists}
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
                    label="Public collection"
                    value={
                      <AddressValue
                        value={snapshot.publicCollection || config.main2}
                      />
                    }
                  />
                  <DataRow
                    label="Pair addresses"
                    value={
                      <StatusPill
                        value={
                          sameAddress(snapshot.vrfCollection, config.main) &&
                          sameAddress(snapshot.publicCollection, config.main2)
                        }
                        trueLabel="Matched"
                        falseLabel="Mismatch"
                      />
                    }
                  />
                  <DataRow
                    label="VRF rewards"
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
                  <DataRow
                    label="Token rewards"
                    value={
                      <StatusPill
                        value={
                          (vrfSnapshot.tokenRewardsEligible ??
                            snapshot.tokenRewardsEligibleVRF) &&
                          (publicSnapshot.tokenRewardsEligible ??
                            snapshot.tokenRewardsEligiblePublic)
                        }
                        trueLabel="Eligible"
                        falseLabel="Off"
                      />
                    }
                  />
                </div>
              </details>
            </article>
          ),
        )}
      </div>

      <details className="collection-series__details collection-series__details--system">
        <summary>System contracts</summary>
        <div className="collection-series__table">
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
              <AddressValue value={global.registry || ADDR.SERIES_REGISTRY} />
            }
          />
          <DataRow
            label="Controller / registry"
            value={
              <StatusPill
                value={global.controllerMatchesRegistry}
                trueLabel="Matched"
                falseLabel="Mismatch"
              />
            }
          />
        </div>
      </details>
    </section>
  );
}

export default React.memo(ChapterSeriesPanel);
