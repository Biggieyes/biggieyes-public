import { formatUnits } from "ethers";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const UNIT_PATTERN = /\b(POL|MATIC|BIGGI|ETH|WETH|LP)\b/i;
const SCIENTIFIC_PATTERN = /(?:^|\s)-?\d+(?:\.\d+)?e[+-]?\d+(?:\s|$)/i;
const EMPTY_VALUES = new Set(["", "--", "N/A", "NA", "null", "undefined", "NaN"]);

export function isRealAddress(value) {
  return (
    typeof value === "string" &&
    /^0x[0-9a-fA-F]{40}$/.test(value) &&
    value.toLowerCase() !== ZERO_ADDRESS
  );
}

export function cleanAmountDisplay(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (EMPTY_VALUES.has(text)) return null;
  return text;
}

function hasExpectedUnit(text, unit) {
  if (unit === "POL") return /\b(POL|MATIC)\b/i.test(text);
  return new RegExp(`\\b${unit}\\b`, "i").test(text);
}

function normalizeUnit(text, unit) {
  return unit === "POL" ? text.replace(/\bMATIC\b/gi, "POL") : text;
}

export function formatDecimalString(value, maximumFractionDigits = 4) {
  const [integerPartRaw, fractionPartRaw = ""] = String(value).split(".");
  const negative = integerPartRaw.startsWith("-");
  const integerDigits = (negative ? integerPartRaw.slice(1) : integerPartRaw)
    .replace(/^0+(?=\d)/, "") || "0";
  const integerPart = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fractionPart = fractionPartRaw
    .slice(0, maximumFractionDigits)
    .replace(/0+$/, "");

  return `${negative ? "-" : ""}${integerPart}${fractionPart ? `.${fractionPart}` : ""}`;
}

function rawBigIntFrom(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return null;

  const text = cleanAmountDisplay(value);
  if (!text || UNIT_PATTERN.test(text) || SCIENTIFIC_PATTERN.test(text)) {
    return null;
  }

  const normalized = text.replace(/,/g, "");
  if (/^0x[0-9a-f]+$/i.test(normalized)) return BigInt(normalized);
  if (/^\d{16,}$/.test(normalized) || normalized === "0") {
    return BigInt(normalized);
  }

  return null;
}

function formatHumanDisplay(value, unit, maximumFractionDigits) {
  const text = cleanAmountDisplay(value);
  if (!text || SCIENTIFIC_PATTERN.test(text)) return null;

  if (unit && hasExpectedUnit(text, unit)) {
    return normalizeUnit(text, unit);
  }

  if (UNIT_PATTERN.test(text)) return null;

  const normalized = text.replace(/,/g, "");
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    const amount = formatDecimalString(normalized, maximumFractionDigits);
    return unit ? `${amount} ${unit}` : amount;
  }

  return unit ? `${text} ${unit}` : text;
}

export function formatAmountDisplay(
  value,
  { decimals = 18, unit = "", maximumFractionDigits = 4 } = {},
) {
  const raw = rawBigIntFrom(value);
  if (raw != null) {
    try {
      const amount = formatDecimalString(
        formatUnits(raw, decimals),
        maximumFractionDigits,
      );
      return unit ? `${amount} ${unit}` : amount;
    } catch {
      return "--";
    }
  }

  return formatHumanDisplay(value, unit, maximumFractionDigits) || "--";
}

export function formatNativeDisplay(value, maximumFractionDigits = 4) {
  return formatAmountDisplay(value, {
    decimals: 18,
    unit: "POL",
    maximumFractionDigits,
  });
}

export function formatTokenDisplay(
  value,
  decimals = 18,
  maximumFractionDigits = 4,
  symbol = "BIGGI",
) {
  return formatAmountDisplay(value, {
    decimals,
    unit: symbol || "BIGGI",
    maximumFractionDigits,
  });
}

export function toDisplayNumber(value, decimals = 18) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") {
    const num = Number(formatUnits(value, decimals));
    return Number.isFinite(num) ? num : null;
  }

  const text = cleanAmountDisplay(value);
  if (!text || SCIENTIFIC_PATTERN.test(text)) return null;

  const normalized = text
    .replace(/,/g, "")
    .replace(/\b(POL|MATIC|BIGGI|ETH|WETH|LP|R|LM|LV)\b/gi, "")
    .trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;

  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function pickFormatted(formatter, ...values) {
  for (const value of values) {
    const formatted = formatter(value);
    if (formatted !== "--") return formatted;
  }
  return "--";
}
