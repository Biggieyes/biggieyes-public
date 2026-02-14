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

export default function useDistributorHistory(snapshot, options = {}) {
  const { limit = 30 } = options;
  const { history } = useHistoryBuffer(snapshot, { limit });

  const points = React.useMemo(
    () =>
      history
        .map((entry) => ({
          label: entry?.tsLabel || "",
          value: toNumberLoose(resolveTotal(entry)),
        }))
        .filter((point) => Number.isFinite(point.value)),
    [history],
  );

  return { history, points };
}
