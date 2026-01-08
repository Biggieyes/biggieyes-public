import * as React from "react";

const HISTORY_LIMIT = 24;

const fmtLabel = (ts) =>
  new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function useBUYBACKStabilityHistory({
  BUYBACKSnapshot,
  DRIPSnapshot,
} = {}) {
  const [history, setHistory] = React.useState([]);

  React.useEffect(() => {
    const bbTs = BUYBACKSnapshot?.ts ?? 0;
    const DRIPTs = DRIPSnapshot?.ts ?? 0;
    const ts = Math.max(bbTs, DRIPTs);
    if (!ts) return;

    const point = {
      ts,
      time: BUYBACKSnapshot?.tsLabel || DRIPSnapshot?.tsLabel || fmtLabel(ts),
      DRIPDistributor: DRIPSnapshot?.distributor?.tokenBalanceNumeric ?? null,
      DRIPLm: DRIPSnapshot?.DRIPLM?.biggiBalanceNumeric ?? null,
      BUYBACKAgent: BUYBACKSnapshot?.BUYBACK?.biggiBalanceNumeric ?? null,
      treasury: BUYBACKSnapshot?.treasury?.biggiBalanceNumeric ?? null,
    };

    const hasValue = [
      point.DRIPDistributor,
      point.DRIPLm,
      point.BUYBACKAgent,
      point.treasury,
    ].some((val) => typeof val === "number" && Number.isFinite(val));
    if (!hasValue) return;

    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.ts === point.ts) return prev;
      const updated = [...prev, point];
      return updated.slice(-HISTORY_LIMIT);
    });
  }, [BUYBACKSnapshot, DRIPSnapshot]);

  return history;
}



