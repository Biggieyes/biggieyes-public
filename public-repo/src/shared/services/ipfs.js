// Known public IPFS gateways (first is primary, others are fallbacks)

// --- helpers ---
const LIMIT_TEXT = "THIS GATEWAY HAS REACHED ITS LIMITS";

function env(key) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env)
      return import.meta.env[key];
  } catch {
    // ignore
  }
  try {
    if (typeof process !== "undefined" && process.env) return process.env[key];
  } catch {
    // ignore
  }
  return undefined;
}

function headersForUrl() {
  // Browser-side gateway credentials are never safe: every VITE_* value is public.
  return undefined;
}

function normalizeIpfsPath(p) {
  if (!p) return "";
  return String(p)
    .trim()
    .replace(/^ipfs:\/\//i, "")
    .replace(/^ipns:\/\//i, "")
    .replace(/^\/?ipfs\//i, "")
    .replace(/^\/?ipns\//i, "")
    .replace(/^\/+/, ""); // remove leading slashes
}

function extractIpfsPathFromHttp(url) {
  try {
    const u = new URL(String(url));
    const path = u.pathname || "";
    const match = path.match(/\/(ipfs|ipns)\/([^?#]+)/i);
    if (!match) return null;
    return {
      path: normalizeIpfsPath(match[2]),
      isIpns: match[1].toLowerCase() === "ipns",
    };
  } catch {
    return null;
  }
}

function trimSlash(s) {
  return String(s).replace(/\/+$/, "");
}

function isPrivateHostname(hostname) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (!host) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::" ||
    host === "::1" ||
    host === "0:0:0:0:0:0:0:0" ||
    host === "0:0:0:0:0:0:0:1" ||
    host.startsWith("::ffff:") ||
    host.startsWith("0:0:0:0:0:ffff:") ||
    (host.includes(":") &&
      (host.startsWith("fc") ||
        host.startsWith("fd") ||
        /^fe[89abcdef]/.test(host)))
  ) {
    return true;
  }

  const octets = host.split(".").map(Number);
  if (
    octets.length === 4 &&
    octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
  ) {
    const [a, b] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  return false;
}

function isLocalDevelopmentPage() {
  if (typeof window === "undefined") return false;
  const host = String(window.location?.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function isSafeRemoteUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (parsed.username || parsed.password) return false;
    if (parsed.protocol === "https:") return !isPrivateHostname(parsed.hostname);
    return (
      parsed.protocol === "http:" &&
      isLocalDevelopmentPage() &&
      isPrivateHostname(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function isTrue(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function makeGateway(baseUrl) {
  const base = trimSlash(baseUrl);
  return (cidOrPath, isIpns = false) =>
    `${base}/${isIpns ? "ipns" : "ipfs"}/${normalizeIpfsPath(cidOrPath)}`;
}

const PINATA_PRIMARY_GATEWAY = trimSlash(
  env("VITE_PINATA_GATEWAY_URL") ||
    env("VITE_PINATA_GATEWAY_BASE_URL") ||
    "https://biggieyes.mypinata.cloud",
);
const EXTRA_GATEWAY_URL = trimSlash(
  env("VITE_IPFS_GATEWAY_URL") || env("VITE_IPFS_GATEWAY") || "",
);
const PINATA_ONLY = isTrue(env("VITE_IPFS_PINATA_ONLY"));

const PUBLIC_FALLBACK_GATEWAYS = [
  "https://ipfs.io",
  "https://cloudflare-ipfs.com",
  "https://dweb.link",
  "https://nftstorage.link",
  "https://cf-ipfs.com",
  "https://ipfs.filebase.io",
  "https://gateway.lighthouse.storage",
];

const dedupeGatewayUrls = (urls) => {
  const out = [];
  const seen = new Set();
  for (const raw of urls) {
    const normalized = trimSlash(raw || "");
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
};

let gatewayUrls = dedupeGatewayUrls([
  EXTRA_GATEWAY_URL,
  PINATA_PRIMARY_GATEWAY,
  "https://gateway.pinata.cloud",
  ...(PINATA_ONLY ? [] : PUBLIC_FALLBACK_GATEWAYS),
]);
let GWS = gatewayUrls.map((url) => makeGateway(url));

// Allow adding a custom gateway from outside
export function addIpfsGateway(fnOrBaseUrl) {
  if (typeof fnOrBaseUrl === "function") {
    GWS.unshift(fnOrBaseUrl);
    return;
  }
  if (typeof fnOrBaseUrl === "string" && fnOrBaseUrl.trim()) {
    const normalized = trimSlash(fnOrBaseUrl.trim());
    gatewayUrls = dedupeGatewayUrls([normalized, ...gatewayUrls]);
    GWS = gatewayUrls.map((url) => makeGateway(url));
  }
}

export { GWS, PINATA_PRIMARY_GATEWAY };

function buildGatewayUrl(gw, cidOrPath, isIpns = false) {
  return typeof gw === "function"
    ? gw(cidOrPath, isIpns)
    : makeGateway(String(gw))(cidOrPath, isIpns);
}

/** Fetch with an AbortController-based timeout. */
export async function fetchWithTimeout(
  url,
  ms = 8000,
  fetchImpl = fetch,
  headers,
) {
  const hasAbort = typeof AbortController !== "undefined";
  const ctrl = hasAbort ? new AbortController() : null;
  const t = hasAbort ? setTimeout(() => ctrl.abort(), ms) : null;
  try {
    const resp = await fetchImpl(url, {
      signal: ctrl?.signal,
      cache: "no-cache",
      ...(headers ? { headers } : {}),
    });
    return resp;
  } finally {
    if (t) clearTimeout(t);
  }
}

/** Convert ipfs://... or ipns://... or /ipfs|/ipns to an HTTP URL via the primary gateway. */
export function httpFromIpfs(uri) {
  if (!uri) return uri;
  const s = String(uri).trim();
  if (s.startsWith("//")) return "";
  const isIpns =
    s.startsWith("ipns://") || s.startsWith("/ipns/") || s.startsWith("ipns/");
  const isIpfs =
    s.startsWith("ipfs://") || s.startsWith("/ipfs/") || s.startsWith("ipfs/");

  if (isIpfs || isIpns) {
    const builder = GWS[0] || makeGateway("https://ipfs.io");
    return builder(uri, isIpns);
  }
  if (/^https?:\/\//i.test(s)) return isSafeRemoteUrl(s) ? s : "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return "";
  return uri;
}

/**
 * Resolve an image URL from a metadata `image` field and its metadata URI.
 * Tries all known IPFS gateways if ipfs:// or ipns://, supports relative paths.
 */
export async function resolveImageUrl(imageField, metadataUri, options = {}) {
  const { gateways = GWS, timeout = 8000, fetchImpl = fetch } = options;
  if (!imageField) return null;
  const img = String(imageField).trim();

  // ipfs/ipns resource
  if (
    img.startsWith("ipfs://") ||
    img.startsWith("ipns://") ||
    img.startsWith("/ipfs/") ||
    img.startsWith("/ipns/")
  ) {
    const isIpns =
      img.startsWith("ipns://") ||
      img.startsWith("/ipns/") ||
      img.startsWith("ipns/");
    const p = normalizeIpfsPath(img);
    const fallbackUrl =
      gateways && gateways.length
        ? buildGatewayUrl(gateways[0], p, isIpns)
        : makeGateway("https://ipfs.io")(p, isIpns);
    for (const gw of gateways) {
      try {
        const url = buildGatewayUrl(gw, p, isIpns);
        const resp = await fetchWithTimeout(
          url,
          timeout,
          fetchImpl,
          headersForUrl(url),
        );
        const ctype = resp?.headers?.get?.("content-type") || "";
        if (resp?.ok && !ctype.includes("text/html")) return url;
      } catch {
        // try next gateway
      }
    }
    // If all gateway fetches failed (often due to CORS), still return a usable URL.
    return fallbackUrl;
  }

  // already absolute http(s)
  if (/^https?:\/\//i.test(img)) {
    if (!isSafeRemoteUrl(img)) return null;
    const ipfsInfo = extractIpfsPathFromHttp(img);
    if (ipfsInfo) {
      const candidates = [img];
      for (const gw of gateways) {
        try {
          candidates.push(buildGatewayUrl(gw, ipfsInfo.path, ipfsInfo.isIpns));
        } catch {
          // ignore gateway build errors
        }
      }
      for (const url of candidates) {
        try {
          const resp = await fetchWithTimeout(
            url,
            timeout,
            fetchImpl,
            headersForUrl(url),
          );
          const ctype = resp?.headers?.get?.("content-type") || "";
          if (resp?.ok && !ctype.includes("text/html")) return url;
        } catch {
          // try next candidate
        }
      }
      // fallback to original URL if all fetches failed
      return img;
    }
    return img;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(img)) return null;

  // relative path beside the metadata file
  const metaHttp = httpFromIpfs(metadataUri);
  try {
    const u = new URL(metaHttp);
    const clean = img.replace(/^\.?\//, "");
    u.pathname = u.pathname.replace(/\/[^/]*$/, `/${clean}`);
    return u.toString();
  } catch {
    return img.startsWith("//") ? null : img;
  }
}

/** Read JSON from ipfs://, ipns://, /ipfs/, /ipns/ or http(s) URI, trying multiple gateways for IPFS/IPNS. */
export async function readJsonFromURI(uri, options = {}) {
  const { gateways = GWS, timeout = 8000, fetchImpl = fetch } = options;
  try {
    if (!uri) return null;
    const u = String(uri).trim();

    const isIpns =
      u.startsWith("ipns://") ||
      u.startsWith("/ipns/") ||
      u.startsWith("ipns/");
    const isIpfs =
      u.startsWith("ipfs://") ||
      u.startsWith("/ipfs/") ||
      u.startsWith("ipfs/");

    const tryJson = async (url) => {
      try {
        const resp = await fetchWithTimeout(
          url,
          timeout,
          fetchImpl,
          headersForUrl(url),
        );
        if (!resp?.ok) return null;
        const ctype = resp?.headers?.get?.("content-type") || "";
        if (ctype.includes("text/html")) {
          const txt = await resp.text().catch(() => "");
          if (txt && txt.includes(LIMIT_TEXT)) return null;
          return null;
        }
        return await resp.json();
      } catch {
        return null;
      }
    };

    if (isIpfs || isIpns) {
      const p = normalizeIpfsPath(u);
      for (const gw of gateways) {
        const url = buildGatewayUrl(gw, p, isIpns);
        const json = await tryJson(url);
        if (json) return json;
      }
      return null;
    }

    const ipfsInfo = extractIpfsPathFromHttp(u);
    if (ipfsInfo) {
      if (!isSafeRemoteUrl(u)) return null;
      // First try the original URL (may include gateway auth)
      const direct = await tryJson(u);
      if (direct) return direct;
      // Fallback to other gateways if the original fails
      for (const gw of gateways) {
        const url = buildGatewayUrl(gw, ipfsInfo.path, ipfsInfo.isIpns);
        const json = await tryJson(url);
        if (json) return json;
      }
      return null;
    }

    if (!isSafeRemoteUrl(u)) return null;

    const resp = await fetchWithTimeout(
      u,
      timeout,
      fetchImpl,
      headersForUrl(u),
    );
    if (resp?.ok) return await resp.json();
    return null;
  } catch {
    return null;
  }
}

// Default export for legacy compatibility (bundle-safe object).
export default {
  GWS,
  addIpfsGateway,
  fetchWithTimeout,
  httpFromIpfs,
  resolveImageUrl,
  readJsonFromURI,
};
