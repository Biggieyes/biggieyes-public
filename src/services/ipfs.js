// Known public IPFS gateways (first is primary, others are fallbacks)

// --- helpers ---
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

function makeGateway(baseUrl) {
  const base = trimSlash(baseUrl);
  return (cidOrPath, isIpns = false) =>
    `${base}/${isIpns ? "ipns" : "ipfs"}/${normalizeIpfsPath(cidOrPath)}`;
}

// Primary and fallback gateways
let GWS = [
  makeGateway("https://ipfs.io"),
  makeGateway("https://cloudflare-ipfs.com"),
  makeGateway("https://gateway.pinata.cloud"),
  makeGateway("https://dweb.link"),
  makeGateway("https://nftstorage.link"),
  makeGateway("https://cf-ipfs.com"),
  makeGateway("https://ipfs.filebase.io"),
  makeGateway("https://gateway.lighthouse.storage"),
];

// Allow adding a custom gateway from outside
export function addIpfsGateway(fnOrBaseUrl) {
  if (typeof fnOrBaseUrl === "function") {
    GWS.unshift(fnOrBaseUrl);
    return;
  }
  if (typeof fnOrBaseUrl === "string" && fnOrBaseUrl.trim()) {
    GWS.unshift(makeGateway(fnOrBaseUrl.trim()));
  }
}

export { GWS };

/** Fetch with an AbortController-based timeout. */
export async function fetchWithTimeout(url, ms = 8000, fetchImpl = fetch) {
  const hasAbort = typeof AbortController !== "undefined";
  const ctrl = hasAbort ? new AbortController() : null;
  const t = hasAbort ? setTimeout(() => ctrl.abort(), ms) : null;
  try {
    const resp = await fetchImpl(url, {
      signal: ctrl?.signal,
      cache: "no-cache",
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
        const resp = await fetchWithTimeout(url, timeout, fetchImpl);
        if (resp?.ok) return url;
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
          const resp = await fetchWithTimeout(url, timeout, fetchImpl);
          if (resp?.ok) return await resp.json();
        } catch {
          // try next gateway
        }
      }
      return null;
    }

    const resp = await fetchWithTimeout(u, timeout, fetchImpl);
    if (resp?.ok) return await resp.json();
    return null;
  } catch {
    return null;
  }
}

