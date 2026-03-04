const PLACEHOLDER_IMAGE = "/images/Biggi.png";
const TICKET_IMAGE_MARKER = "biggi_random_mint_ticket.png";

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

function imageLooksTicket(raw) {
  return String(raw || "")
    .toLowerCase()
    .includes(TICKET_IMAGE_MARKER);
}

function looksLikeNftMeta(meta) {
  if (!meta || typeof meta !== "object") return false;
  const attrs = Array.isArray(meta?.attributes) ? meta.attributes : [];
  return attrs.some((a) => {
    const t = String(a?.trait_type || "").toLowerCase();
    return t.includes("background") || t.includes("block") || t.includes("eye");
  });
}

function hasStrongNftSignal(item, metaOverride = null) {
  const meta = metaOverride || item?.meta;
  if (looksLikeNftMeta(meta)) return true;
  const image = String(item?.image || "").trim();
  if (!image || image === PLACEHOLDER_IMAGE) return false;
  if (imageLooksTicket(image)) return false;
  return true;
}

function resolveIsTicket(prev, next, mergedMeta) {
  const prevTicket = Boolean(prev?.isTicket);
  const nextTicketRaw = next?.isTicket;
  const nextTicket = nextTicketRaw == null ? null : Boolean(nextTicketRaw);
  const prevNftSignal = hasStrongNftSignal(prev, prev?.meta);
  const nextNftSignal = hasStrongNftSignal(next, mergedMeta);

  if (nextTicket === true) {
    // Prevent weak ticket payloads from downgrading already-resolved NFTs.
    if (!prevTicket && prevNftSignal && !nextNftSignal) return false;
    return true;
  }
  if (nextTicket === false) {
    // Keep previous ticket state until next payload has clear NFT evidence.
    if (prevTicket && !nextNftSignal) return true;
    return false;
  }

  if (prevTicket && !nextNftSignal) return true;
  return prevTicket;
}

function resolvePending(prev, next, mergedMeta, mergedIsTicket) {
  if (next?.isPending != null) return Boolean(next.isPending);
  if (mergedIsTicket === false) return false;
  if (looksLikeNftMeta(next?.meta) || looksLikeNftMeta(mergedMeta)) return false;
  return Boolean(prev?.isPending);
}

export function mergeGalleryItem(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  const mergedMeta = mergeMeta(prev.meta, next.meta);
  const mergedIsTicket = resolveIsTicket(prev, next, mergedMeta);
  return {
    ...prev,
    ...next,
    tokenId: toIdString(next) || toIdString(prev),
    image: pickImage(prev.image, next.image),
    meta: mergedMeta,
    isTicket: mergedIsTicket,
    isPending: resolvePending(prev, next, mergedMeta, mergedIsTicket),
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
    if (item?.isTicket || item?.isPending) continue;
    out.push(item);
  }

  return out;
}

