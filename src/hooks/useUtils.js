// useUtils.js
import * as React from "react";
import {
  mergeAttrs as mergeAttrsUtil,
  getCachedPriceAttrs as getCachedPriceAttrsUtil,
  setCachedPriceAttrs as setCachedPriceAttrsUtil,
} from "../utils/metadata";

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
    return mergeAttrsUtil(baseArr, patchArr);
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
    return getCachedPriceAttrsUtil(tokenId);
  }, []);

  const setCachedPriceAttrs = React.useCallback((tokenId, attrs) => {
    return setCachedPriceAttrsUtil(tokenId, attrs);
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
