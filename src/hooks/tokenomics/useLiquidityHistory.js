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
  const { limit = 30 } = options;
  const { history } = useHistoryBuffer(snapshot, { limit });

  const chartPoints = React.useMemo(
    () =>
      history
        .map((entry) => ({
          time: entry?.tsLabel || "",
          value:
            toNumberLoose(entry?.vault?.totalLpLockedNumeric) ??
            toNumberLoose(entry?.vault?.totalLpLocked),
        }))
        .filter((point) => Number.isFinite(point.value)),
    [history],
  );

  return { history, chartPoints };
}
