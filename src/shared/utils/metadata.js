import { BACKGROUND_NAMES, BACKGROUND_CODES } from "./shared";

const PRICE_KEYS = ["Ticket Price", "Block Price", "Final Price"];
const LEGACY_KEY_PREFIX = "biggi_meta_prices_";
const normalizeContractAddress = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(raw) ? raw : "";
};
const keyFor = (tokenId, contractAddress = null) => {
  const token = String(tokenId ?? "").trim();
  const addr = normalizeContractAddress(contractAddress);
  return addr
    ? `${LEGACY_KEY_PREFIX}${addr}_${token}`
    : `${LEGACY_KEY_PREFIX}${token}`;
};
const normKey = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase();

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
  const base = Array.isArray(baseArr) ? baseArr : [];
  const patch = Array.isArray(patchArr) ? patchArr : [];

  const map = new Map();
  for (const a of base) {
    if (!a || typeof a.trait_type !== "string") continue;
    const k = normKey(a.trait_type);
    if (!k) continue;
    map.set(k, { ...a, trait_type: a.trait_type });
  }
  for (const p of patch) {
    if (!p || typeof p.trait_type !== "string") continue;
    const k = normKey(p.trait_type);
    if (!k) continue;
    const prev = map.get(k);
    map.set(
      k,
      prev ? { ...prev, ...p, trait_type: prev.trait_type } : { ...p },
    );
  }

  return Array.from(map.values());
}

export function getCachedPriceAttrs(tokenId, contractAddress = null) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(keyFor(tokenId, contractAddress));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const attrs = Array.isArray(obj?.attributes) ? obj.attributes : null;
    if (!attrs) return null;
    return attrs
      .filter(
        (a) =>
          a &&
          typeof a.trait_type === "string" &&
          PRICE_KEYS.includes(a.trait_type) &&
          Object.prototype.hasOwnProperty.call(a, "value"),
      )
      .map((a) => ({ ...a }));
  } catch {
    return null;
  }
}

export function setCachedPriceAttrs(tokenId, attrs, contractAddress = null) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const scopedKey = keyFor(tokenId, contractAddress);
    const legacyKey = keyFor(tokenId);
    const compact = (Array.isArray(attrs) ? attrs : []).filter(
      (a) =>
        a &&
        typeof a.trait_type === "string" &&
        PRICE_KEYS.includes(a.trait_type) &&
        Object.prototype.hasOwnProperty.call(a, "value"),
    );
    if (compact.length) {
      window.localStorage.setItem(
        scopedKey,
        JSON.stringify({ attributes: compact }),
      );
      if (scopedKey !== legacyKey) {
        window.localStorage.removeItem(legacyKey);
      }
    } else {
      window.localStorage.removeItem(scopedKey);
      if (scopedKey !== legacyKey) {
        window.localStorage.removeItem(legacyKey);
      }
    }
  } catch {
    // ignore cache write errors
  }
}

