export function formatAddress(addr, start = 6, end = 4) {
  if (!addr || typeof addr !== "string") return "";
  const address = addr.trim();
  const s = Math.max(0, start);
  const e = Math.max(0, end);
  if (address.length <= s + e) return address;
  return `${address.slice(0, s)}...${address.slice(-e)}`;
}

export function isLikelyAddress(addr = "") {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}
