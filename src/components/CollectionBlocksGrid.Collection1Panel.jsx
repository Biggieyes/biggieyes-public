import * as React from "react";
import { FALLBACK_VALUE } from "./CollectionBlocksGrid.constants";

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
 * Collection1Panel - Renders the first collection (Main collection)
 * Displays blocks grid with collection stats
 * @component
 */
const Collection1Panel = React.memo(
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

    const rows = React.useMemo(
      () => [
        {
          label: "Blocks configured",
          valueNum: stats.blocksWithData,
          value: fmt(stats.blocksWithData),
          detail: "Cards rendered below",
        },
        {
          label: "Total minted",
          valueNum: stats.totalMinted,
          value: fmt(stats.totalMinted),
          detail: "Sum across all blocks",
        },
        {
          label: "Average price",
          valueNum: stats.averagePrice,
          value: fmt(stats.averagePrice, 2),
          suffix: "POL",
          detail: "Based on live prices",
        },
        {
          label: "Highest price",
          valueNum: stats.highestPrice?.value,
          value: fmt(stats.highestPrice?.value),
          suffix: "POL",
          detail: highestPriceName,
        },
        {
          label: "Lowest price",
          valueNum: stats.lowestPrice?.value,
          value: fmt(stats.lowestPrice?.value),
          suffix: "POL",
          detail: lowestPriceName,
        },
        {
          label: "Top minted block",
          valueNum: stats.topMinted?.value,
          value: fmt(stats.topMinted?.value),
          detail: topMintedName,
        },
      ],
      [
        fmt,
        highestPriceName,
        lowestPriceName,
        stats?.averagePrice,
        stats?.blocksWithData,
        stats?.highestPrice?.value,
        stats?.lowestPrice?.value,
        stats?.topMinted?.value,
        stats?.totalMinted,
        topMintedName,
      ],
    );

    const maxValueForChart = React.useMemo(() => {
      const nums = rows.map((r) =>
        Number.isFinite(r.valueNum) ? r.valueNum : 0,
      );
      return Math.max(...nums, 0);
    }, [rows]);

    const chartBars = React.useMemo(() => {
      const safeMax = maxValueForChart || 1;
      return rows.map((r, idx) => ({
        label: r.label,
        value: Number.isFinite(r.valueNum) ? r.valueNum : 0,
        pct: Math.min(
          100,
          Math.max(
            0,
            ((Number.isFinite(r.valueNum) ? r.valueNum : 0) / safeMax) * 100,
          ),
        ),
        index: idx,
      }));
    }, [maxValueForChart, rows]);

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
                <span className="collection-hero__value">{stat.value}</span>
                <span className="collection-hero__hint">{stat.hint}</span>
              </article>
            ))}
          </div>
        </section>

        {additionalText && (
          <p className="collection-grid__note">{additionalText}</p>
        )}

        <SectionHeader label="Blocks" accent="#5ddcff" />
        <section className="collection-grid__cards-panel">
          <div className="collection-grid__cards">{renderBlockCardsGrid()}</div>
        </section>

        <SectionHeader label="Analytics" accent="#9b7bff" />
        <section className="collection-grid__panel collection-grid__panel--inferno">
          <header className="collection-grid__panel-header">
            <div>
              <h3>Collection stats (live)</h3>
              <p className="collection-grid__panel-subtitle">
                Fresh on-chain snapshots for pricing, minting depth, and
                headline blocks.
              </p>
            </div>
          </header>

          <div className="collection-grid__table-wrapper">
            <table className="collection-grid__table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Scale</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4}>
                    <div
                      className="collection-grid__chart-list"
                      aria-hidden="true"
                    >
                      {chartBars.map((bar) => (
                        <div
                          key={bar.label}
                          className="collection-grid__chart-row"
                        >
                          <div className="collection-grid__chart-row-head">
                            <span className="collection-grid__chart-row-label">
                              {bar.label}
                            </span>
                            <span className="collection-grid__chart-row-value">
                              {Number.isFinite(bar.value)
                                ? Math.round(bar.value)
                                : 0}
                            </span>
                          </div>
                          <div className="collection-grid__chart-row-track">
                            <div
                              className="collection-grid__chart-row-fill"
                              style={{ width: `${bar.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
                {rows.map((row) => {
                  const value =
                    row.value != null
                      ? `${row.value}${row.suffix ? ` ${row.suffix}` : ""}`
                      : FALLBACK_VALUE;
                  const pct =
                    maxValueForChart > 0 && Number.isFinite(row.valueNum)
                      ? Math.min(
                          100,
                          Math.max(0, (row.valueNum / maxValueForChart) * 100),
                        )
                      : 0;
                  return (
                    <tr key={row.label}>
                      <td>
                        <span className="collection-grid__metric-label">
                          <span
                            className="collection-grid__metric-dot"
                            aria-hidden="true"
                          />
                          {row.label}
                        </span>
                      </td>
                      <td>
                        <span className="collection-grid__value-chip">
                          <span className="collection-grid__value-number">
                            {value}
                          </span>
                          {row.suffix && (
                            <span className="collection-grid__value-unit">
                              {row.suffix}
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <div
                          className="collection-grid__micro-chart"
                          aria-hidden="true"
                        >
                          <div className="collection-grid__micro-chart-head">
                            <span>0</span>
                            <span>
                              {maxValueForChart > 0
                                ? `${Math.round(maxValueForChart)}`
                                : "-"}
                            </span>
                          </div>
                          <div className="collection-grid__micro-chart-track">
                            <div
                              className="collection-grid__micro-chart-fill"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`collection-grid__detail-pill${row.detail ? "" : " is-muted"}`}
                        >
                          {row.detail || FALLBACK_VALUE}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
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
      prevProps.additionalText === nextProps.additionalText
    );
  },
);

Collection1Panel.displayName = "Collection1Panel";

export default Collection1Panel;

