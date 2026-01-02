// useUtils.js
import * as React from "react";

export function useUtils() {
  const mapLimit = React.useCallback(async (items, limit, mapper) => {
    const ret = [];
    let i = 0;
    const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
      while (i < items.length) {
        const cur = i++;
        ret[cur] = await mapper(items[cur], cur);
      }
    });
    await Promise.all(workers);
    return ret;
  }, []);

  const mergeAttrs = React.useCallback((baseArr, patchArr) => {
    const out = Array.isArray(baseArr) ? [...baseArr] : [];
    if (!Array.isArray(patchArr)) return out;
    for (const p of patchArr) {
      if (!p || !p.trait_type) continue;
      const i = out.findIndex((a) => String(a?.trait_type) === String(p.trait_type));
      if (i === -1) out.push(p);
      else out[i] = { ...out[i], value: p.value };
    }
    return out;
  }, []);

  const canonBackgroundName = React.useCallback((val) => {
    const BACKGROUND_NAMES = ["ORANGE","BLACK","WHITE","BROWN","BLUE","GREEN","VIOLET","RED","PINK","RAINBOW"];
    const BACKGROUND_CODES = ["O","B","W","BR","BL","G","V","R","P","RB"];
    if (!val) return null;
    const u = String(val).trim().toUpperCase();
    const codeIdx = BACKGROUND_CODES.indexOf(u);
    if (codeIdx !== -1) return BACKGROUND_NAMES[codeIdx];
    const nameIdx = BACKGROUND_NAMES.indexOf(u);
    if (nameIdx !== -1) return BACKGROUND_NAMES[nameIdx];
    return null;
  }, []);

  const backgroundIndexFromAny = React.useCallback((val) => {
    const BACKGROUND_NAMES = ["ORANGE","BLACK","WHITE","BROWN","BLUE","GREEN","VIOLET","RED","PINK","RAINBOW"];
    const BACKGROUND_CODES = ["O","B","W","BR","BL","G","V","R","P","RB"];
    if (!val) return null;
    const u = String(val).trim().toUpperCase();
    let idx = BACKGROUND_CODES.indexOf(u);
    if (idx !== -1) return idx + 1;
    idx = BACKGROUND_NAMES.indexOf(u);
    if (idx !== -1) return idx + 1;
    return null;
  }, []);

  const getCachedPriceAttrs = React.useCallback((tokenId) => {
    try {
      const raw = localStorage.getItem(`biggi_meta_prices_${String(tokenId)}`);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const attrs = Array.isArray(obj?.attributes) ? obj.attributes : null;
      return attrs?.length ? attrs : null;
    } catch {
      return null;
    }
  }, []);

  const setCachedPriceAttrs = React.useCallback((tokenId, attrs) => {
    try {
      const keep = ["Ticket Price", "Block Price", "Final Price"];
      const compact = (Array.isArray(attrs) ? attrs : []).filter((a) => keep.includes(String(a?.trait_type)));
      if (compact.length) {
        localStorage.setItem(
          `biggi_meta_prices_${String(tokenId)}`,
          JSON.stringify({ attributes: compact })
        );
      }
    } catch (err) {
      console.debug("setCachedPriceAttrs failed", err);
    }
  }, []);

  return {
    mapLimit,
    mergeAttrs,
    canonBackgroundName,
    backgroundIndexFromAny,
    getCachedPriceAttrs,
    setCachedPriceAttrs,
  };
}
