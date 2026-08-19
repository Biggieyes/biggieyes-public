export const coerceBool = (val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "bigint") return val !== 0n;
  if (typeof val?.toNumber === "function") {
    try {
      return Boolean(val.toNumber());
    } catch {
      // fall through to other coercions
    }
  }
  if (typeof val?.toString === "function") {
    const s = val.toString();
    if (s === "0") return false;
    if (s === "1") return true;
  }
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") {
    const normalized = val.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0" || normalized === "") {
      return false;
    }
  }
  return Boolean(val);
};
