import * as React from "react";

export default function usePollingSnapshot(fetcher, options = {}) {
  const {
    intervalMs = 15000,
    immediate = true,
    pauseWhenHidden = true,
    initialDelayMs = 0,
    refreshKey = null,
    sanitize: sanitizeOpt = true,
  } = options;
  const [snapshot, setSnapshot] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const inFlightRef = React.useRef(false);
  const hasLoadedRef = React.useRef(false);
  const snapshotRef = React.useRef(snapshot);
  const [isVisible, setIsVisible] = React.useState(() => {
    if (typeof document === "undefined") return true;
    return !document.hidden;
  });
  React.useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

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
    const startTransition =
      typeof React.startTransition === "function"
        ? React.startTransition
        : (fn) => fn();
    if (typeof fetcher !== "function") return null;
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    const shouldSetLoading =
      !hasLoadedRef.current && snapshotRef.current == null;
    if (shouldSetLoading) setLoading(true);
    setError(null);
    try {
      const data = await fetcher();
      const safe =
        data == null
          ? null
          : sanitizeOpt === false
            ? data
            : typeof sanitizeOpt === "function"
              ? sanitizeOpt(data)
              : sanitize(data);
      startTransition(() => {
        setSnapshot(safe);
      });
      if (safe != null) hasLoadedRef.current = true;
      return safe;
    } catch (err) {
      startTransition(() => {
        setError(err);
      });
      return null;
    } finally {
      inFlightRef.current = false;
      if (shouldSetLoading) setLoading(false);
    }
  }, [fetcher, sanitize, sanitizeOpt]);

  React.useEffect(() => {
    if (!immediate) return undefined;
    if (pauseWhenHidden && !isVisible) return undefined;
    const delay = Number(initialDelayMs) || 0;
    if (delay > 0) {
      const id = setTimeout(() => {
        refresh();
      }, delay);
      return () => clearTimeout(id);
    }
    refresh();
    return undefined;
  }, [immediate, refresh, pauseWhenHidden, isVisible, initialDelayMs]);

  React.useEffect(() => {
    if (refreshKey == null) return undefined;
    if (pauseWhenHidden && !isVisible) return undefined;
    const delay = Number(initialDelayMs) || 0;
    if (delay > 0) {
      const id = setTimeout(() => {
        refresh();
      }, delay);
      return () => clearTimeout(id);
    }
    refresh();
    return undefined;
  }, [refreshKey, refresh, pauseWhenHidden, isVisible, initialDelayMs]);

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
    const delay = Number(initialDelayMs) || 0;
    let intervalId = null;
    let timeoutId = null;
    const start = () => {
      intervalId = setInterval(refresh, interval);
    };
    if (delay > 0) {
      timeoutId = setTimeout(start, delay);
    } else {
      start();
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalMs, refresh, pauseWhenHidden, isVisible, initialDelayMs]);

  return { snapshot, loading, error, refresh };
}
