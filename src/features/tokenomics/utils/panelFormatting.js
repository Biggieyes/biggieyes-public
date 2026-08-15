import {
  formatNativeDisplay,
  formatTokenDisplay,
  isRealAddress,
} from "./amountFormatting.js";

const MISSING_DISPLAY = new Set(["", "--", "N/A", "NaN"]);

export function hasDisplayValue(value) {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "bigint") return true;
  const text = String(value).trim();
  return text ? !MISSING_DISPLAY.has(text) : false;
}

export function pickDisplay(...values) {
  const match = values.find((value) => hasDisplayValue(value));
  return hasDisplayValue(match) ? String(match) : "--";
}

export function formatTokenAmount(
  value,
  decimals = 18,
  maximumFractionDigits = 2,
) {
  return formatTokenDisplay(value, decimals, maximumFractionDigits);
}

export function formatNativeAmount(value, maximumFractionDigits = 4) {
  return formatNativeDisplay(value, maximumFractionDigits);
}

export function isAddress(address) {
  return isRealAddress(address);
}

export function pickAddress(...addresses) {
  return addresses.find((address) => isAddress(address)) ?? null;
}

export function sameAddress(a, b) {
  if (!isAddress(a) || !isAddress(b)) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

export function shortAddress(address) {
  if (!address || typeof address !== "string") return "--";
  return address.length <= 10
    ? address
    : `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function summarizeAddresses(addresses = []) {
  const unique = [];
  const seen = new Set();

  for (const address of addresses) {
    if (!isAddress(address)) continue;
    const normalized = address.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(address);
  }

  return unique.length ? unique.map((address) => shortAddress(address)).join(" | ") : "--";
}
