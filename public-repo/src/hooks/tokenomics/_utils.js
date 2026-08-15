import { formatUnits } from "ethers";

export const toNumberSafe = (value, decimals = null) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") {
    if (decimals == null) return Number(value);
    try {
      return Number(formatUnits(value, decimals));
    } catch {
      return Number(value);
    }
  }
  try {
    if (decimals != null) return Number(formatUnits(value, decimals));
  } catch {
    // fall through
  }
  const raw = value?.toString?.() ?? value;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};
