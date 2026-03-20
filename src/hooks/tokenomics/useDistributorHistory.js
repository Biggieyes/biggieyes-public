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

const resolveTotal = (entry) =>
  entry?.totalReceived ??
  entry?.totalDistributed ??
  entry?.totalReceivedPol ??
  entry?.totalMaticReceived ??
  entry?.totalNativeReceived ??
  null;

const buildSeries = (history, selector) =>
  history
    .map((entry) => ({
      label: entry?.tsLabel || "",
      value: toNumberLoose(selector(entry)),
    }))
    .filter((point) => Number.isFinite(point.value));

export default function useDistributorHistory(snapshot, options = {}) {
  const { limit = 30, minIntervalMs = 0 } = options;
  const { history } = useHistoryBuffer(snapshot, { limit, minIntervalMs });

  const totalSeries = React.useMemo(
    () =>
      buildSeries(
        history,
        (entry) => entry?.totalReceivedNumeric ?? resolveTotal(entry),
      ),
    [history],
  );

  const pendingSeries = React.useMemo(
    () => buildSeries(history, (entry) => entry?.totalPendingNumeric ?? entry?.totalPending),
    [history],
  );

  const reserveSeries = React.useMemo(
    () =>
      buildSeries(
        history,
        (entry) => entry?.pendingReserveNumeric ?? entry?.pendingReserve,
      ),
    [history],
  );

  const buybackSeries = React.useMemo(
    () =>
      buildSeries(
        history,
        (entry) =>
          entry?.pendingBUYBACKNumeric ??
          entry?.pendingBUYBACK ??
          entry?.pendingBUYBACKAgent,
      ),
    [history],
  );

  const communitySeries = React.useMemo(
    () =>
      buildSeries(
        history,
        (entry) =>
          entry?.communityPoolBalanceNumeric ??
          entry?.communityPoolBalance ??
          entry?.pendingCOMMUNITYCENTERNumeric ??
          entry?.pendingCOMMUNITYCENTER,
      ),
    [history],
  );

  return {
    history,
    points: totalSeries,
    totalSeries,
    pendingSeries,
    reserveSeries,
    buybackSeries,
    communitySeries,
  };
}
