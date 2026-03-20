import * as React from "react";
import useHistoryBuffer from "./_useHistoryBuffer";

const toNumberLoose = (value) => {
  if (value == null) return null;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

export default function useLiquidityHistory(snapshot, options = {}) {
  const { limit = 30, minIntervalMs = 0 } = options;
  const { history } = useHistoryBuffer(snapshot, { limit, minIntervalMs });

  const buildSeries = React.useCallback(
    (selector, timeKey = "label") =>
      history
        .map((entry) => {
          const value = toNumberLoose(selector(entry));
          return Number.isFinite(value)
            ? { [timeKey]: entry?.tsLabel || "", value }
            : null;
        })
        .filter(Boolean),
    [history],
  );

  const vaultSeries = React.useMemo(
    () =>
      buildSeries(
        (entry) =>
          entry?.vault?.totalLpLockedNumeric ?? entry?.vault?.totalLpLocked,
      ),
    [buildSeries],
  );

  const reserveSeries = React.useMemo(
    () =>
      buildSeries(
        (entry) =>
          entry?.reserve?.maticBalanceNumeric ?? entry?.reserve?.maticBalance,
      ),
    [buildSeries],
  );

  const waitingSeries = React.useMemo(
    () =>
      buildSeries(
        (entry) =>
          entry?.reserve?.waitingBiggiNumeric ?? entry?.reserve?.waitingBiggi,
      ),
    [buildSeries],
  );

  const refillSeries = React.useMemo(
    () =>
      buildSeries(
        (entry) =>
          entry?.reserve?.dexRefillBiggiNumeric ??
          entry?.reserve?.dexRefillBiggi,
      ),
    [buildSeries],
  );

  const quotaSeries = React.useMemo(
    () =>
      buildSeries(
        (entry) =>
          entry?.automation?.usedTodayNumeric ?? entry?.automation?.usedToday,
      ),
    [buildSeries],
  );

  const chartPoints = React.useMemo(
    () =>
      vaultSeries.map((point) => ({
        time: point.label || "",
        value: point.value,
      })),
    [vaultSeries],
  );

  return {
    history,
    chartPoints,
    vaultSeries,
    reserveSeries,
    waitingSeries,
    refillSeries,
    quotaSeries,
  };
}
