/**
 * COLLECTIONBlocksGrid Utils
 * Utility funkce pro formatting, parsing a výpočty
 */

import { FALLBACK_VALUE } from "./COLLECTIONBlocksGrid.constants";

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
    ? `${v.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} POL`
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
  if (Math.abs(delta) < Number.EPSILON) return null;
  const percent = basePrice === 0 ? 0 : (delta / basePrice) * 100;
  return {
    value: `${delta >= 0 ? "+" : ""}${Math.abs(delta).toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )} POL`,
    percent: `${delta >= 0 ? "+" : ""}${Math.abs(percent).toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )}%`,
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

const tryRead = async (fn) => {
  try {
    return await fn();
  } catch {
    return null;
  }
};

/**
 * Contract helpers use block numbers 1..10 while public array getters use
 * storage indexes 0..9. Keep those index spaces separate.
 */
export const readCollectionBlockSnapshot = async (contract, blockNumber) => {
  const blockId = Number(blockNumber);
  if (!contract || !Number.isInteger(blockId) || blockId < 1 || blockId > 10) {
    return { basePriceWei: null, priceWei: null, mintedRaw: null };
  }

  const storageIndex = blockId - 1;
  const [helperPrice, helperMinted, info] = await Promise.all([
    typeof contract.getCurrentBlockPrice === "function"
      ? tryRead(() => contract.getCurrentBlockPrice(blockId))
      : Promise.resolve(null),
    typeof contract.getBlockMintCount === "function"
      ? tryRead(() => contract.getBlockMintCount(blockId))
      : Promise.resolve(null),
    typeof contract.blockInfos === "function"
      ? tryRead(() => contract.blockInfos(storageIndex))
      : Promise.resolve(null),
  ]);

  const basePriceWei = info?.basePrice ?? info?.[0] ?? null;
  let priceWei = helperPrice;
  let mintedRaw = helperMinted;

  if (priceWei == null) {
    priceWei = info?.currentPrice ?? info?.[2] ?? null;
  }
  if (mintedRaw == null && typeof contract.blockMintCounts === "function") {
    mintedRaw = await tryRead(() => contract.blockMintCounts(storageIndex));
  }
  if (mintedRaw == null) {
    mintedRaw = info?.mintCount ?? info?.[3] ?? null;
  }

  return { basePriceWei, priceWei, mintedRaw };
};

export const normalizeNftInfo = (raw) => {
  if (raw == null) return null;
  const normalized = {
    minted: Boolean(raw.minted ?? raw[0]),
    background: Number(raw.background ?? raw[1] ?? 0),
    blockIdx: Number(raw.blockIdx ?? raw[2] ?? 0),
    mainId: String(raw.mainId ?? raw[3] ?? "0"),
    ticketPrice: raw.ticketPrice ?? raw[4] ?? null,
    blockPrice: raw.blockPrice ?? raw[5] ?? null,
    finalPrice: raw.finalPrice ?? raw[6] ?? null,
  };
  normalized.configured =
    normalized.background >= 1 &&
    normalized.background <= 10 &&
    normalized.blockIdx >= 1 &&
    normalized.blockIdx <= 10 &&
    normalized.mainId !== "0";
  return normalized;
};

export const normalizeMetadataConsistency = (raw) => {
  if (raw == null) {
    return {
      configuredCount: null,
      fullyConfigured: null,
      rewardMatrixConsistent: null,
    };
  }
  return {
    configuredCount: Number(raw.configuredCount ?? raw[0] ?? 0),
    fullyConfigured: Boolean(raw.fullyConfigured ?? raw[1]),
    rewardMatrixConsistent: Boolean(raw.rewardMatrixConsistent ?? raw[2]),
  };
};

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
