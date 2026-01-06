import * as React from "react";

const HISTORY_LIMIT = 18;

const fmtLabel = (ts) =>
  new Date(ts).toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

const toNumber = (value) => {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

export default function useDistributorHistory(distributorData) {
  const [history, setHistory] = React.useState([]);

  React.useEffect(() => {
    if (!distributorData) return;
    const totalReceived = toNumber(
      distributorData.totalReceived ?? distributorData.totalDistributed,
    );
    if (totalReceived == null) return;
    const ts = Date.now();

    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.total === totalReceived) return prev;
      const updated = [...prev, { ts, total: totalReceived }];
      return updated.slice(-HISTORY_LIMIT);
    });
  }, [distributorData]);

  const points = React.useMemo(
    () =>
      history.map((entry) => ({
        label: fmtLabel(entry.ts),
        value: entry.total,
      })),
    [history],
  );

  return { history, points };
}
