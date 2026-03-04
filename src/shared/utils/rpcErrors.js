export function isRateLimitedRpcError(err) {
  const code = err?.code ?? err?.error?.code ?? err?.info?.error?.code;
  if (Number(code) === 429 || Number(code) === -32005) return true;
  const status =
    err?.status ??
    err?.data?.httpStatus ??
    err?.error?.data?.httpStatus ??
    err?.info?.error?.data?.httpStatus;
  if (Number(status) === 429) return true;
  const msg = String(
    err?.reason ||
      err?.shortMessage ||
      err?.message ||
      err?.error?.message ||
      err?.info?.error?.message ||
      "",
  ).toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("rate limited") ||
    msg.includes("too many request") ||
    msg.includes("http 429")
  );
}

