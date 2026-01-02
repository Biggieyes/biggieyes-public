import { BACKGROUND_NAMES, BACKGROUND_CODES } from "./shared";

export function canonBackgroundName(val) {
  if (!val) return null;
  const u = String(val).trim().toUpperCase();
  const codeIdx = BACKGROUND_CODES.indexOf(u);
  if (codeIdx !== -1) return BACKGROUND_NAMES[codeIdx];
  const nameIdx = BACKGROUND_NAMES.indexOf(u);
  if (nameIdx !== -1) return BACKGROUND_NAMES[nameIdx];
  return null;
}

export function backgroundIndexFromAny(val) {
  if (!val) return null;
  const u = String(val).trim().toUpperCase();
  let idx = BACKGROUND_CODES.indexOf(u);
  if (idx !== -1) return idx + 1;
  idx = BACKGROUND_NAMES.indexOf(u);
  if (idx !== -1) return idx + 1;
  return null;
}

export function mergeAttrs(baseArr, patchArr) {
  const out = Array.isArray(baseArr) ? [...baseArr] : [];
  if (!Array.isArray(patchArr)) return out;
  for (const p of patchArr) {
    if (!p || !p.trait_type) continue;
    const i = out.findIndex((a) => String(a?.trait_type) === String(p.trait_type));
    if (i === -1) out.push(p);
    else out[i] = { ...out[i], value: p.value };
  }
  return out;
}

export function getCachedPriceAttrs(tokenId) {
  try {
    const raw = localStorage.getItem(`biggi_meta_prices_${String(tokenId)}`);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const attrs = Array.isArray(obj?.attributes) ? obj.attributes : null;
    return attrs?.length ? attrs : null;
  } catch {
    return null;
  }
}

export function setCachedPriceAttrs(tokenId, attrs) {
  try {
    const keep = ["Ticket Price", "Block Price", "Final Price"];
    const compact = (Array.isArray(attrs) ? attrs : []).filter((a) => keep.includes(String(a?.trait_type)));
    if (compact.length) {
      localStorage.setItem(
        `biggi_meta_prices_${String(tokenId)}`,
        JSON.stringify({ attributes: compact })
      );
    }
  } catch {
    // ignore cache write errors
  }
}
