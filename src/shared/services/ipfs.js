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

const PINATA_GATEWAY_TOKEN = env("VITE_PINATA_GATEWAY_TOKEN");
const PINATA_GATEWAY_JWT = env("VITE_PINATA_GATEWAY_JWT");

function headersForUrl(url) {
  if (!url) return undefined;
  const u = String(url).toLowerCase();
  const isPinata = u.includes("pinata") || u.includes("mypinata");
  if (!isPinata) return undefined;
  if (PINATA_GATEWAY_JWT) {
    return { Authorization: `Bearer ${PINATA_GATEWAY_JWT}` };
  }
  if (PINATA_GATEWAY_TOKEN) {
    return { "x-pinata-gateway-token": PINATA_GATEWAY_TOKEN };
  }
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

function trimSlash(s) {
  return String(s).replace(/\/+$/, "");
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
  const s = String(uri);
  const isIpns =
    s.startsWith("ipns://") || s.startsWith("/ipns/") || s.startsWith("ipns/");
  const isIpfs =
    s.startsWith("ipfs://") || s.startsWith("/ipfs/") || s.startsWith("ipfs/");

  if (isIpfs || isIpns) {
    const builder = GWS[0] || makeGateway("https://ipfs.io");
    return builder(uri, isIpns);
  }
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
    for (const gw of gateways) {
      try {
        const url =
          typeof gw === "function"
            ? gw(p, isIpns)
            : makeGateway(String(gw))(p, isIpns);
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
    return null; // all gateways failed
  }

  // already absolute http(s)
  if (/^https?:\/\//i.test(img)) return img;

  // relative path beside the metadata file
  const metaHttp = httpFromIpfs(metadataUri);
  try {
    const u = new URL(metaHttp);
    const clean = img.replace(/^\.?\//, "");
    u.pathname = u.pathname.replace(/\/[^/]*$/, `/${clean}`);
    return u.toString();
  } catch {
    return img;
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

    if (isIpfs || isIpns) {
      const p = normalizeIpfsPath(u);
      for (const gw of gateways) {
        try {
          const url =
            typeof gw === "function"
              ? gw(p, isIpns)
              : makeGateway(String(gw))(p, isIpns);
          const resp = await fetchWithTimeout(
            url,
            timeout,
            fetchImpl,
            headersForUrl(url),
          );
          if (resp?.ok) {
            const ctype = resp?.headers?.get?.("content-type") || "";
            if (ctype.includes("text/html")) {
              const txt = await resp.text().catch(() => "");
              if (txt && txt.includes(LIMIT_TEXT)) continue;
              continue;
            }
            return await resp.json();
          }
        } catch {
          // try next gateway
        }
      }
      return null;
    }

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

