const GALLERY_CACHE_VERSION = "v7-core-series";
const GALLERY_CACHE_TTL = 60 * 24 * 60 * 60 * 1000;

export function galleryCacheKey(addr, contractAddr) {
  const wallet = String(addr || "").toLowerCase();
  const contract = String(contractAddr || "").toLowerCase();
  const suffix = contract ? `_c_${contract}` : "";
  return `biggi_gallery_${GALLERY_CACHE_VERSION}_${wallet}${suffix}`;
}

export function readGalleryCache(addr, contractAddr) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(
      galleryCacheKey(addr, contractAddr),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const items = Array.isArray(parsed.items) ? parsed.items : null;
    if (!items) return null;
    const ts = Number(parsed.ts || 0);
    const stale = ts > 0 ? Date.now() - ts > GALLERY_CACHE_TTL : false;
    return { items, ts, stale };
  } catch {
    return null;
  }
}

export function loadGalleryCache(addr, options = {}) {
  const record = readGalleryCache(addr, options.contractAddr);
  if (!record) return null;
  if (record.stale && !options.allowExpired) return null;
  return record.items;
}

export function saveGalleryCache(addr, items, contractAddr) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const payload = JSON.stringify({ ts: Date.now(), items });
    window.localStorage.setItem(galleryCacheKey(addr, contractAddr), payload);
  } catch {
    // ignore
  }
}
