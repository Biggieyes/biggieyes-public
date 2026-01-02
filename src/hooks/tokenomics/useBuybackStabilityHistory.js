import * as React from "react";

const HISTORY_LIMIT = 24;

const fmtLabel = (ts) =>
  new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function useBuybackStabilityHistory({ buybackSnapshot, dripSnapshot } = {}) {
  const [history, setHistory] = React.useState([]);

  React.useEffect(() => {
    const bbTs = buybackSnapshot?.ts ?? 0;
    const dripTs = dripSnapshot?.ts ?? 0;
    const ts = Math.max(bbTs, dripTs);
    if (!ts) return;

    const point = {
      ts,
      time: buybackSnapshot?.tsLabel || dripSnapshot?.tsLabel || fmtLabel(ts),
      dripDistributor: dripSnapshot?.distributor?.tokenBalanceNumeric ?? null,
      dripLm: dripSnapshot?.dripLM?.biggiBalanceNumeric ?? null,
      buybackAgent: buybackSnapshot?.buyback?.biggiBalanceNumeric ?? null,
      treasury: buybackSnapshot?.treasury?.biggiBalanceNumeric ?? null,
    };

    const hasValue = [point.dripDistributor, point.dripLm, point.buybackAgent, point.treasury].some(
      (val) => typeof val === "number" && Number.isFinite(val)
    );
    if (!hasValue) return;

    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.ts === point.ts) return prev;
      const updated = [...prev, point];
      return updated.slice(-HISTORY_LIMIT);
    });
  }, [buybackSnapshot, dripSnapshot]);

  return history;
}
