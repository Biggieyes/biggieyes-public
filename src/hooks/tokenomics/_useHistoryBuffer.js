import * as React from "react";

const defaultLabel = (ts) =>
  new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function useHistoryBuffer(snapshot, options = {}) {
  const { limit = 30, getKey, normalize, minIntervalMs = 0 } = options;
  const [history, setHistory] = React.useState([]);

  React.useEffect(() => {
    if (!snapshot) return;
    const entry = typeof normalize === "function" ? normalize(snapshot) : snapshot;
    if (!entry) return;

    const ts = entry.ts ?? Date.now();
    const tsLabel = entry.tsLabel ?? defaultLabel(ts);
    const normalized = { ...entry, ts, tsLabel };
    const keyValue = typeof getKey === "function" ? getKey(normalized) : ts;

    setHistory((prev) => {
      if (!prev.length) return [normalized];
      const last = prev[prev.length - 1];
      const lastKey = typeof getKey === "function" ? getKey(last) : last?.ts;
      if (lastKey === keyValue) return prev;
      if (
        Number(minIntervalMs) > 0 &&
        typeof last?.ts === "number" &&
        ts - last.ts < Number(minIntervalMs)
      ) {
        return prev;
      }
      const next = [...prev, normalized];
      return next.length > limit ? next.slice(-limit) : next;
    });
  }, [snapshot, limit, getKey, normalize, minIntervalMs]);

  return { history, setHistory };
}
