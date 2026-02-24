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

const buildSeries = (history, selector) =>
  history
    .map((entry) => ({
      label: entry?.tsLabel || "",
      value: toNumberLoose(selector(entry)),
    }))
    .filter((point) => Number.isFinite(point.value));

export default function useDRIPHistory(snapshot, options = {}) {
  const { limit = 30, minIntervalMs = 0 } = options;
  const { history } = useHistoryBuffer(snapshot, { limit, minIntervalMs });

  const availableSeries = React.useMemo(
    () =>
      buildSeries(
        history,
        (entry) =>
          entry?.distributor?.availableNumeric ??
          entry?.distributor?.availableTokens,
      ),
    [history],
  );

  const capSeries = React.useMemo(
    () =>
      buildSeries(
        history,
        (entry) =>
          entry?.distributor?.capRemainingNumeric ??
          entry?.distributor?.capRemaining,
      ),
    [history],
  );

  const nativeSeries = React.useMemo(
    () =>
      buildSeries(
        history,
        (entry) =>
          entry?.DRIPLM?.nativeBalanceNumeric ??
          entry?.DRIPLM?.nativeBalance,
      ),
    [history],
  );

  const tokensSeries = React.useMemo(() => availableSeries, [availableSeries]);

  return {
    history,
    availableSeries,
    capSeries,
    nativeSeries,
    tokensSeries,
  };
}
