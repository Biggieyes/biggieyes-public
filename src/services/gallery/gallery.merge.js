const PLACEHOLDER_IMAGE = "/images/Biggi.png";

function toIdString(item) {
  if (!item) return "";
  if (item.tokenId != null) return String(item.tokenId);
  if (item.id != null) return String(item.id);
  return "";
}

function isEmptyMeta(meta) {
  if (!meta || typeof meta !== "object") return true;
  return Object.keys(meta).length === 0;
}

function pickImage(prev, next) {
  if (next && next !== PLACEHOLDER_IMAGE) return next;
  if (prev) return prev;
  return next || PLACEHOLDER_IMAGE;
}

function mergeMeta(prev, next) {
  if (isEmptyMeta(prev) && isEmptyMeta(next)) return next || prev || {};
  if (isEmptyMeta(prev)) return next;
  if (isEmptyMeta(next)) return prev;
  return { ...prev, ...next };
}

export function mergeGalleryItem(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  return {
    ...prev,
    ...next,
    tokenId: toIdString(next) || toIdString(prev),
    image: pickImage(prev.image, next.image),
    meta: mergeMeta(prev.meta, next.meta),
    isTicket: next.isTicket ?? prev.isTicket,
    mint: next.mint ?? prev.mint,
  };
}

export function mergeGalleryLists(baseItems = [], incomingItems = []) {
  const baseMap = new Map();
  const out = [];

  for (const item of baseItems) {
    const key = toIdString(item);
    if (!key) continue;
    baseMap.set(key, item);
  }

  for (const item of incomingItems) {
    const key = toIdString(item);
    if (!key) continue;
    const merged = mergeGalleryItem(baseMap.get(key), item);
    baseMap.delete(key);
    out.push(merged);
  }

  for (const item of baseMap.values()) {
    if (item?.isTicket || item?.isPending || item?.isPlaceholder) continue;
    out.push(item);
  }

  return out;
}
