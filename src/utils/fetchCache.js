const cache = new Map();

export function getCached(key, fetcher, { ttlMs = 10000, force = false } = {}) {
  if (!key) throw new Error("cache key is required");
  const now = Date.now();
  const entry = cache.get(key);

  if (entry) {
    if (!force) {
      if (entry.hasValue && entry.expiresAt > now) {
        return Promise.resolve(entry.value);
      }
      if (entry.promise) return entry.promise;
    } else if (entry.promise) {
      return entry.promise;
    }
  }

  const promise = Promise.resolve()
    .then(fetcher)
    .then((value) => {
      cache.set(key, { value, hasValue: true, expiresAt: now + ttlMs, promise: null });
      return value;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });

  cache.set(key, {
    value: entry ? entry.value : undefined,
    hasValue: entry ? entry.hasValue : false,
    expiresAt: entry ? entry.expiresAt : 0,
    promise,
  });

  return promise;
}

export function invalidateCache(key) {
  if (!key) return;
  cache.delete(key);
}

export function clearCache(prefix) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
