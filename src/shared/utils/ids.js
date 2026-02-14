// Parse comma/space separated token IDs into an array of bigint IDs.
export function parseIdsCsv(csv = "") {
  return String(csv || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^\d+$/.test(s))
    .map((s) => BigInt(s));
}
