const DEFAULT_MAX_MAIN_SUPPLY = 550;

export const BIGGI_ID_RANGES = Object.freeze({
  TICKET_OFFSET: 1n,
  BIGGI_OFFSET: 1001n,
  CHARACTER_OFFSET: 2001n,
  REWARDS_OFFSET: 3001n,
  DEFAULT_MAX_MAIN_SUPPLY,
});

export const BIGGI_TOKEN_TYPE = Object.freeze({
  TICKET: "ticket",
  MAIN: "main",
  CHARACTER: "character",
  REWARD: "reward",
  UNKNOWN: "unknown",
});

export function toTokenIdBigIntOrNull(value) {
  try {
    if (value == null) return null;
    if (typeof value === "bigint") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      return BigInt(Math.trunc(value));
    }
    if (typeof value === "string") {
      const s = value.trim();
      if (!/^\d+$/.test(s)) return null;
      return BigInt(s);
    }
    if (typeof value?.toString === "function") {
      return toTokenIdBigIntOrNull(value.toString());
    }
  } catch {
    return null;
  }
  return null;
}

export function isCanonicalTicketTokenId(value) {
  const tokenId = toTokenIdBigIntOrNull(value);
  if (tokenId == null) return false;
  return (
    tokenId >= BIGGI_ID_RANGES.TICKET_OFFSET &&
    tokenId < BIGGI_ID_RANGES.BIGGI_OFFSET
  );
}

export function isCanonicalMainNftTokenId(value) {
  const tokenId = toTokenIdBigIntOrNull(value);
  if (tokenId == null) return false;
  return (
    tokenId >= BIGGI_ID_RANGES.BIGGI_OFFSET &&
    tokenId < BIGGI_ID_RANGES.CHARACTER_OFFSET
  );
}

export function isCanonicalCharacterTokenId(value) {
  const tokenId = toTokenIdBigIntOrNull(value);
  if (tokenId == null) return false;
  return (
    tokenId >= BIGGI_ID_RANGES.CHARACTER_OFFSET &&
    tokenId < BIGGI_ID_RANGES.REWARDS_OFFSET
  );
}

export function isCanonicalRewardTokenId(value) {
  const tokenId = toTokenIdBigIntOrNull(value);
  if (tokenId == null) return false;
  const upper = BIGGI_ID_RANGES.REWARDS_OFFSET + 20n;
  return tokenId >= BIGGI_ID_RANGES.REWARDS_OFFSET && tokenId < upper;
}

export function getCanonicalBiggiTokenType(value) {
  if (isCanonicalTicketTokenId(value)) return BIGGI_TOKEN_TYPE.TICKET;
  if (isCanonicalMainNftTokenId(value)) return BIGGI_TOKEN_TYPE.MAIN;
  if (isCanonicalCharacterTokenId(value)) return BIGGI_TOKEN_TYPE.CHARACTER;
  if (isCanonicalRewardTokenId(value)) return BIGGI_TOKEN_TYPE.REWARD;
  return BIGGI_TOKEN_TYPE.UNKNOWN;
}

export function toMainNftIndexFromTokenId(value, options = {}) {
  const tokenId = toTokenIdBigIntOrNull(value);
  if (tokenId == null || tokenId <= 0n) return null;

  const maxSupplyRaw = Number(options?.maxSupply);
  const maxSupply =
    Number.isFinite(maxSupplyRaw) && maxSupplyRaw > 0
      ? Math.trunc(maxSupplyRaw)
      : DEFAULT_MAX_MAIN_SUPPLY;
  const maxSupplyBI = BigInt(maxSupply);

  if (isCanonicalMainNftTokenId(tokenId)) {
    const idx = tokenId - BIGGI_ID_RANGES.BIGGI_OFFSET + 1n;
    if (idx >= 1n && idx <= maxSupplyBI) return Number(idx);
    return null;
  }

  const allowLegacy = options?.allowLegacy !== false;
  if (!allowLegacy) return null;

  if (tokenId >= 1n && tokenId <= maxSupplyBI) {
    return Number(tokenId);
  }
  return null;
}

export function toCanonicalMainTokenIdFromIndex(index, options = {}) {
  const idxRaw = Number(index);
  if (!Number.isFinite(idxRaw)) return null;
  const idx = Math.trunc(idxRaw);
  if (idx <= 0) return null;

  const maxSupplyRaw = Number(options?.maxSupply);
  const maxSupply =
    Number.isFinite(maxSupplyRaw) && maxSupplyRaw > 0
      ? Math.trunc(maxSupplyRaw)
      : DEFAULT_MAX_MAIN_SUPPLY;
  if (idx > maxSupply) return null;

  return (BIGGI_ID_RANGES.BIGGI_OFFSET + BigInt(idx) - 1n).toString();
}
