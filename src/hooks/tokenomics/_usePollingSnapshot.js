import * as React from "react";

const SNAPSHOT_CACHE = new Map();

function readCachedSnapshot(cacheKey, cacheTtlMs = 0) {
  if (!cacheKey) return null;
  const hit = SNAPSHOT_CACHE.get(cacheKey);
  if (!hit) return null;
  const ttl = Number(cacheTtlMs) || 0;
  if (ttl > 0 && Date.now() - hit.ts > ttl) {
    SNAPSHOT_CACHE.delete(cacheKey);
    return null;
  }
  return hit.snapshot ?? null;
}

function writeCachedSnapshot(cacheKey, snapshot) {
  if (!cacheKey || snapshot == null) return;
  SNAPSHOT_CACHE.set(cacheKey, { ts: Date.now(), snapshot });
}

function deepEqualIgnoringKeys(a, b, ignoreKeys, seen = new WeakMap()) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return false;
  if (typeof a !== "object") return false;

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqualIgnoringKeys(a[i], b[i], ignoreKeys, seen)) return false;
    }
    return true;
  }

  const seenB = seen.get(a);
  if (seenB === b) return true;
  seen.set(a, b);

  const keysA = Object.keys(a).filter((k) => !ignoreKeys?.has(k));
  const keysB = Object.keys(b).filter((k) => !ignoreKeys?.has(k));
  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i += 1) {
    const key = keysA[i];
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqualIgnoringKeys(a[key], b[key], ignoreKeys, seen)) return false;
  }
  return true;
}

export default function usePollingSnapshot(fetcher, options = {}) {
  const {
    intervalMs = 15000,
    immediate = true,
    pauseWhenHidden = true,
    initialDelayMs = 0,
    minRefreshGapMs = 0,
    refreshKey = null,
    cacheKey = null,
    cacheTtlMs = 0,
    dedupeSnapshot = false,
    compareIgnoreKeys = null,
    sanitize: sanitizeOpt = true,
  } = options;
  const [snapshot, setSnapshot] = React.useState(() =>
    readCachedSnapshot(cacheKey, cacheTtlMs),
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const inFlightRef = React.useRef(false);
  const lastRefreshAtRef = React.useRef(0);
  const hasLoadedRef = React.useRef(snapshot != null);
  const snapshotRef = React.useRef(snapshot);
  const compareIgnoreSet = React.useMemo(() => {
    if (!dedupeSnapshot) return null;
    if (!Array.isArray(compareIgnoreKeys) || compareIgnoreKeys.length === 0) {
      return new Set(["ts", "tsLabel"]);
    }
    return new Set(compareIgnoreKeys);
  }, [dedupeSnapshot, compareIgnoreKeys]);

  React.useEffect(() => {
    if (!cacheKey) return;
    const cached = readCachedSnapshot(cacheKey, cacheTtlMs);
    setSnapshot(cached);
    snapshotRef.current = cached;
    hasLoadedRef.current = cached != null;
  }, [cacheKey, cacheTtlMs]);

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

  const refresh = React.useCallback(async (force = false) => {
    const startTransition =
      typeof React.startTransition === "function"
        ? React.startTransition
        : (fn) => fn();
    if (typeof fetcher !== "function") return null;
    const now = Date.now();
    const minGap = Number(minRefreshGapMs) || 0;
    if (!force && minGap > 0 && now - lastRefreshAtRef.current < minGap) {
      return null;
    }
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    lastRefreshAtRef.current = now;
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
      if (safe != null) writeCachedSnapshot(cacheKey, safe);
      const prev = snapshotRef.current;
      const sameSnapshot =
        dedupeSnapshot &&
        prev != null &&
        safe != null &&
        deepEqualIgnoringKeys(prev, safe, compareIgnoreSet);
      startTransition(() => {
        if (!sameSnapshot) setSnapshot(safe);
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
  }, [
    cacheKey,
    compareIgnoreSet,
    dedupeSnapshot,
    fetcher,
    minRefreshGapMs,
    sanitize,
    sanitizeOpt,
  ]);

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
