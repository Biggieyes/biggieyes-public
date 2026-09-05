const DEFAULT_ALLOWED_ORIGIN = "https://biggieyes.com";

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "*") return DEFAULT_ALLOWED_ORIGIN;

  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    const isLocalHttp =
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(hostname);
    if (parsed.protocol !== "https:" && !isLocalHttp) {
      return DEFAULT_ALLOWED_ORIGIN;
    }
    return parsed.origin;
  } catch {
    return DEFAULT_ALLOWED_ORIGIN;
  }
}

export function getAllowedOrigin() {
  return normalizeOrigin(process.env.ALLOWED_ORIGIN);
}

export function buildApiHeaders({
  methods,
  allowedHeaders = "Content-Type,Authorization",
} = {}) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(),
    "Access-Control-Allow-Methods": String(methods || "GET,OPTIONS"),
    "Access-Control-Allow-Headers": allowedHeaders,
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    "Cross-Origin-Resource-Policy": "same-site",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    Vary: "Origin",
  };
}

export { DEFAULT_ALLOWED_ORIGIN };
