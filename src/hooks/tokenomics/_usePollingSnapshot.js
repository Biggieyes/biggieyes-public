import * as React from "react";

export default function usePollingSnapshot(fetcher, options = {}) {
  const { intervalMs = 15000, immediate = true, pauseWhenHidden = true } =
    options;
  const [snapshot, setSnapshot] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const inFlightRef = React.useRef(false);
  const [isVisible, setIsVisible] = React.useState(() => {
    if (typeof document === "undefined") return true;
    return !document.hidden;
  });

  const sanitize = React.useCallback((value) => {
    const seen = new WeakMap();
    const walk = (input) => {
      if (input == null) return input;
      if (typeof input === "bigint") return input.toString();
      if (typeof input === "number" || typeof input === "string") return input;
      if (typeof input === "object") {
        if (input instanceof Date) return input;
        if (input._isBigNumber || input.type === "BigNumber") {
          return input.toString();
        }
        if (Array.isArray(input)) return input.map(walk);
        if (seen.has(input)) return seen.get(input);
        const out = {};
        seen.set(input, out);
        for (const [key, val] of Object.entries(input)) {
          out[key] = walk(val);
        }
        return out;
      }
      if (typeof input?.toString === "function") return input.toString();
      return input;
    };
    return walk(value);
  }, []);

  const refresh = React.useCallback(async () => {
    if (typeof fetcher !== "function") return null;
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await fetcher();
      const safe = data == null ? null : sanitize(data);
      setSnapshot(safe);
      return safe;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [fetcher, sanitize]);

  React.useEffect(() => {
    if (!immediate) return undefined;
    if (pauseWhenHidden && !isVisible) return undefined;
    refresh();
    return undefined;
  }, [immediate, refresh, pauseWhenHidden, isVisible]);

  React.useEffect(() => {
    if (!pauseWhenHidden) return undefined;
    if (typeof document === "undefined") return undefined;
    const handleVisibility = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      if (visible && immediate) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [pauseWhenHidden, immediate, refresh]);

  React.useEffect(() => {
    const interval = Number(intervalMs) || 0;
    if (interval <= 0) return undefined;
    if (pauseWhenHidden && !isVisible) return undefined;
    const id = setInterval(refresh, interval);
    return () => clearInterval(id);
  }, [intervalMs, refresh, pauseWhenHidden, isVisible]);

  return { snapshot, loading, error, refresh };
}
