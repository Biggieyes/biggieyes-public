const RATE_LIMIT_CODES = new Set([429, -32005]);
const TRANSIENT_HTTP_STATUSES = new Set([429, 500, 503]);
const RATE_LIMIT_MESSAGES = [
  "rate limit",
  "rate limited",
  "too many request",
  "http 429",
  "http 500",
  "http 503",
  "internal server error",
  "service unavailable",
];

function hasRateLimitSignal(value, seen = new WeakSet(), depth = 0) {
  if (value == null || depth > 5) return false;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    return RATE_LIMIT_MESSAGES.some((needle) => normalized.includes(needle));
  }
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (RATE_LIMIT_CODES.has(Number(value.code))) return true;
  if (
    TRANSIENT_HTTP_STATUSES.has(
      Number(value.status ?? value.httpStatus ?? value.data?.httpStatus),
    )
  ) {
    return true;
  }

  const directMessages = [value.reason, value.shortMessage, value.message];
  if (directMessages.some((message) => hasRateLimitSignal(message))) {
    return true;
  }

  const nested = [value.error, value.info, value.data, value.value];
  if (Array.isArray(value)) nested.push(...value);
  return nested.some((entry) => hasRateLimitSignal(entry, seen, depth + 1));
}

export function isRateLimitedRpcError(err) {
  return hasRateLimitSignal(err);
}
