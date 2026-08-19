import * as React from "react";
import Card from "../components/Card.jsx";
import styles from "../styles/BiggiToken.module.css";
import { fmtVal } from "../utils/format.js";
import { toDisplayNumber } from "../utils/amountFormatting.js";

const toNumberLoose = (value) => {
  return toDisplayNumber(value);
};

const fmt = (value, symbol, digits = 4) => {
  const num = toNumberLoose(value);
  return num == null ? "--" : fmtVal(num, symbol, digits);
};

export const buildRows = (entries, mapFn, limit = 12) => {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const mapped = entries.map(mapFn).filter(Boolean).reverse();
  const rows = [];
  let previousKey = null;

  for (const row of mapped) {
    const key = `${row.a}\u0000${row.b}`;
    if (key === previousKey) continue;
    rows.push(row);
    previousKey = key;
    if (rows.length >= limit) break;
  }

  return rows;
};

function HistoryTab({
  buybackHistory = [],
  dripHistory = [],
  liquidityHistory = [],
}) {
  const buybackRows = React.useMemo(
    () =>
      buildRows(buybackHistory, (entry) => ({
        label: entry?.tsLabel || "--",
        a: fmt(
          entry?.BUYBACK?.totalNativeSpentNumeric ??
            entry?.BUYBACK?.totalNativeSpent,
          "POL",
        ),
        b: fmt(
          entry?.BUYBACK?.totalBiggiAcquiredNumeric ??
            entry?.BUYBACK?.totalBiggiAcquired,
          "BIGGI",
        ),
      })),
    [buybackHistory],
  );

  const dripRows = React.useMemo(
    () =>
      buildRows(dripHistory, (entry) => ({
        label: entry?.tsLabel || "--",
        a: fmt(
          entry?.distributor?.availableNumeric ??
            entry?.distributor?.availableTokens,
          "BIGGI",
        ),
        b: fmt(
          entry?.DRIPLM?.nativeBalanceNumeric ?? entry?.DRIPLM?.nativeBalance,
          "POL",
        ),
      })),
    [dripHistory],
  );

  const liquidityRows = React.useMemo(
    () =>
      buildRows(liquidityHistory, (entry) => ({
        label: entry?.tsLabel || "--",
        a: fmt(
          entry?.vault?.totalLpLockedNumeric ?? entry?.vault?.totalLpLocked,
          "LP",
          2,
        ),
        b: fmt(
          entry?.reserve?.maticBalanceNumeric ?? entry?.reserve?.maticBalance,
          "POL",
        ),
      })),
    [liquidityHistory],
  );

  const renderRows = (rows, emptyLabel) =>
    rows.length ? (
      rows.map((row, idx) => (
        <div key={`${row.label}-${idx}`} className={styles.ecoTableRow}>
          <span className={styles.ecoTableLabel}>{row.label}</span>
          <span className={styles.ecoTableValue}>
            {row.a} / {row.b}
          </span>
        </div>
      ))
    ) : (
      <div className={styles.ecoTableRow}>
        <span className={styles.ecoTableLabel}>{emptyLabel}</span>
        <span className={styles.ecoTableValue}>--</span>
      </div>
    );

  return (
    <div className={styles.ecoFlowGrid}>
      <Card
        title="BUYBACK SNAPSHOTS"
        subtitle="Buyback totals when the observed state changed"
      >
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Recent state changes</div>
          {renderRows(buybackRows, "No buyback entries yet")}
        </div>
      </Card>

      <Card
        title="LM SNAPSHOTS"
        subtitle="Liquidity state changes (LP locked vs reserve)"
      >
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Recent state changes</div>
          {renderRows(liquidityRows, "No LM entries yet")}
        </div>
      </Card>

      <Card
        title="DRIP SNAPSHOTS"
        subtitle="Distributor and LM balance changes"
      >
        <div className={styles.ecoTable}>
          <div className={styles.ecoTableHeader}>Recent state changes</div>
          {renderRows(dripRows, "No DRIP entries yet")}
        </div>
      </Card>
    </div>
  );
}

export default React.memo(HistoryTab);
