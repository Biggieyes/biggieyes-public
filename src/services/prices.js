/** Merge two arrays of metadata attributes by trait_type (patch overrides/extends). */
const PRICE_KEYS = ["Ticket Price", "Block Price", "Final Price"];
const keyFor = (tokenId) => `biggi_meta_prices_${String(tokenId)}`;
const normKey = (s) => String(s ?? "").trim().toLowerCase();

export function mergeAttrs(baseArr, patchArr) {
  const base = Array.isArray(baseArr) ? baseArr : [];
  const patch = Array.isArray(patchArr) ? patchArr : [];

  // map by normalized trait_type, keep last occurrence
  const map = new Map();

  for (const a of base) {
    if (!a || typeof a.trait_type !== "string") continue;
    const k = normKey(a.trait_type);
    if (!k) continue;
    map.set(k, { ...a, trait_type: a.trait_type }); // preserve original casing
  }
  for (const p of patch) {
    if (!p || typeof p.trait_type !== "string") continue;
    const k = normKey(p.trait_type);
    if (!k) continue;
    const prev = map.get(k);
    map.set(k, prev ? { ...prev, ...p, trait_type: prev.trait_type } : { ...p });
  }

  return Array.from(map.values());
}

/** Read cached price-related attributes for a tokenId from localStorage. */
export function getCachedPriceAttrs(tokenId) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(keyFor(tokenId));
    if (!raw) return null;

    const obj = JSON.parse(raw);
    const attrs = Array.isArray(obj?.attributes) ? obj.attributes : null;
    if (!attrs) return null;

    // return only valid price attrs, shallow-copied
    return attrs
      .filter(
        (a) =>
          a &&
          typeof a.trait_type === "string" &&
          PRICE_KEYS.includes(a.trait_type) &&
          Object.prototype.hasOwnProperty.call(a, "value")
      )
      .map((a) => ({ ...a }));
  } catch {
    return null;
  }
}

/** Write only price-related attributes to localStorage cache for a tokenId. */
export function setCachedPriceAttrs(tokenId, attrs) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;

    const compact = (Array.isArray(attrs) ? attrs : []).filter(
      (a) =>
        a &&
        typeof a.trait_type === "string" &&
        PRICE_KEYS.includes(a.trait_type) &&
        Object.prototype.hasOwnProperty.call(a, "value")
    );

    if (compact.length) {
      window.localStorage.setItem(keyFor(tokenId), JSON.stringify({ attributes: compact }));
    } else {
      // remove cache entry when there are no valid price attributes
      window.localStorage.removeItem(keyFor(tokenId));
    }
  } catch {
    // ignore storage errors
  }
}
