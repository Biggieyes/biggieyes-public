const DISTRIBUTOR_SNAPSHOT_KEYS = [
  "collectionRewards",
  "reserve",
  "buybackAgent",
  "treasury",
  "communityCenter",
  "totalPending",
  "totalReceived",
];

export function isDistributorSnapshot(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.length >= DISTRIBUTOR_SNAPSHOT_KEYS.length;
  return DISTRIBUTOR_SNAPSHOT_KEYS.some((key) => key in value);
}

export function unwrapDistributorSnapshot(value) {
  const candidates = [value, value?.s, value?.[0]];
  for (const candidate of candidates) {
    if (isDistributorSnapshot(candidate)) return candidate;
  }
  return null;
}
