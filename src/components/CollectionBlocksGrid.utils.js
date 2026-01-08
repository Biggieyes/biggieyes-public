/**
 * CollectionBlocksGrid Utils
 * Utility funkce pro formatting, parsing a výpočty
 */

import { FALLBACK_VALUE } from "./CollectionBlocksGrid.constants";

/**
 * Parsuje číslo ze stringu odstraněním non-numerických znaků
 */
export const parseCount = (value) => {
  const numeric = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

/**
 * Parsuje cenu ze stringu
 */
export const parsePrice = (value) => {
  const numeric = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

/**
 * Formatuje cenu pro zobrazení
 */
export const formatPrice = (v) =>
  typeof v === "number" && Number.isFinite(v)
    ? `${Math.round(v)} POL`
    : FALLBACK_VALUE;

/**
 * Formatuje počet pro zobrazení
 */
export const formatCount = (v) =>
  typeof v === "number" && Number.isFinite(v)
    ? String(Math.round(v))
    : FALLBACK_VALUE;

/**
 * Počítá rozdíl mezi aktuální a base cenou
 */
export const computeDiff = (currentPrice, basePrice) => {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(basePrice))
    return null;
  const delta = currentPrice - basePrice;
  const percent = basePrice === 0 ? 0 : (delta / basePrice) * 100;
  return {
    value: `${delta >= 0 ? "+" : ""}${Math.round(delta)} POL`,
    percent: `${delta >= 0 ? "+" : ""}${Math.round(percent)}%`,
    positive: delta >= 0,
  };
};

/**
 * Validuje, zda je cena platná
 */
export const isValidPrice = (price) =>
  typeof price === "number" && Number.isFinite(price);

/**
 * Validuje, zda je počet platný
 */
export const isValidCount = (count) =>
  typeof count === "number" && Number.isFinite(count);

/**
 * Bezpečně volá async funkci s fallbackem
 */
export const safeAsyncCall = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch (error) {
    // Throttled warn to avoid spamming console with repeated RPC errors
    throttledWarn("safeAsyncCall", "Safe async call failed:", error);
    return fallback;
  }
};

/**
 * Bezpečně volá sync funkci s fallbackem
 */
export const safeSyncCall = (fn, fallback = null) => {
  try {
    return fn();
  } catch (error) {
    throttledWarn("safeSyncCall", "Safe sync call failed:", error);
    return fallback;
  }
};

// --- simple throttled logger ---
const _lastWarn = new Map();
const DEFAULT_WARN_TTL = 60 * 1000; // 1 minute
function throttledWarn(key, msg, err, ttl = DEFAULT_WARN_TTL) {
  try {
    const now = Date.now();
    const last = _lastWarn.get(key) || 0;
    if (now - last < ttl) return; // skip repeated warn
    _lastWarn.set(key, now);
    // keep original stack if present
    if (err && err.stack) {
      console.warn(msg, err);
    } else {
      console.warn(msg, err && err.message ? err.message : err);
    }
  } catch (e) {
    console.debug("throttledWarn failed", e);
  }
}

