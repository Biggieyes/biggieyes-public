import {
  formatAmountDisplay,
  formatNativeDisplay,
  formatTokenDisplay,
  toDisplayNumber,
} from "@/features/tokenomics/utils/amountFormatting.js";

const DEFAULT_DECIMALS = 18;

export function formatMappedAmount(
  raw,
  {
    decimals = DEFAULT_DECIMALS,
    unit = "",
    maximumFractionDigits = 2,
    placeholder = "--",
  } = {},
) {
  if (raw === undefined || raw === null) {
    return { display: placeholder, numeric: null };
  }

  const display =
    unit === "POL" || unit === "MATIC"
      ? formatNativeDisplay(raw, maximumFractionDigits)
      : unit === "BIGGI"
        ? formatTokenDisplay(raw, decimals, maximumFractionDigits, "BIGGI")
        : formatAmountDisplay(raw, {
            decimals,
            unit,
            maximumFractionDigits,
          });

  const safeDisplay = display === "--" ? placeholder : display;
  const numeric =
    toDisplayNumber(safeDisplay, decimals) ?? toDisplayNumber(raw, decimals);

  return { display: safeDisplay, numeric };
}

export const formatMappedNative = (
  raw,
  maximumFractionDigits = 2,
  placeholder = "--",
) =>
  formatMappedAmount(raw, {
    unit: "POL",
    maximumFractionDigits,
    placeholder,
  });

export const formatMappedToken = (
  raw,
  decimals = DEFAULT_DECIMALS,
  maximumFractionDigits = 2,
  placeholder = "--",
) =>
  formatMappedAmount(raw, {
    decimals,
    unit: "BIGGI",
    maximumFractionDigits,
    placeholder,
  });

export const formatMappedLp = (
  raw,
  maximumFractionDigits = 4,
  placeholder = "--",
) =>
  formatMappedAmount(raw, {
    decimals: DEFAULT_DECIMALS,
    unit: "LP",
    maximumFractionDigits,
    placeholder,
  });
