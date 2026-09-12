import { getCached } from "../utils/fetchCache.js";

// Known public IPFS gateways (first is primary, others are fallbacks)

// --- helpers ---
const DEFAULT_JSON_CACHE_TTL_MS = 60_000;
const DEFAULT_IMAGE_CACHE_TTL_MS = 5 * 60_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 8000;
const DEFAULT_TOTAL_TIMEOUT_MS = 20_000;

function buildCacheKey(prefix, ...parts) {
  return `${prefix}:${parts.map((p) => String(p ?? "")).join("|")}`;
}

async function cachedOrFetch(key, fetcher, options = {}, defaultTtlMs) {
  if (!key || options?.cache === false) return fetcher();
  const ttlMs =
    Number.isFinite(options?.cacheTtlMs) && options.cacheTtlMs > 0
      ? options.cacheTtlMs
      : defaultTtlMs;
  const force = Boolean(options?.forceCache);
  const cacheNull = Boolean(options?.cacheNull);
  if (cacheNull) return getCached(key, fetcher, { ttlMs, force });

  return getCached(
    key,
    async () => {
      const value = await fetcher();
      if (value == null) {
        const err = new Error("cache-skip-null");
        err.__skipCache = true;
        throw err;
      }
      return value;
    },
    { ttlMs, force },
  ).catch((err) => {
    if (err && err.__skipCache) return null;
    throw err;
  });
}

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

function getIpfsResource(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^\/?(ipfs|ipns)(?::\/\/|\/)/i);
  if (match) {
    return {
      path: normalizeIpfsPath(raw),
      isIpns: match[1].toLowerCase() === "ipns",
    };
  }
  return /^https?:\/\//i.test(raw) ? extractIpfsPathFromHttp(raw) : null;
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
    if (parsed.protocol === "https:")
      return !isPrivateHostname(parsed.hostname);
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
  "https://dweb.link",
  "https://nftstorage.link",
  "https://ipfs.filebase.io",
  "https://gateway.lighthouse.storage",
];

const dedupeGatewayUrls = (urls) => {
  const out = [];
  const seen = new Set();
  for (const raw of urls) {
    const normalized = trimSlash(String(raw || "").trim());
    if (!normalized || !isSafeRemoteUrl(normalized)) continue;
    const key = new URL(normalized).href;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
};

const gatewayUrls = dedupeGatewayUrls([
  EXTRA_GATEWAY_URL,
  PINATA_PRIMARY_GATEWAY,
  "https://gateway.pinata.cloud",
  ...(PINATA_ONLY ? [] : PUBLIC_FALLBACK_GATEWAYS),
]);
const GWS = gatewayUrls.map((url) => makeGateway(url));

// Allow adding a custom gateway from outside
export function addIpfsGateway(fnOrBaseUrl) {
  if (typeof fnOrBaseUrl === "function") {
    if (!GWS.includes(fnOrBaseUrl)) GWS.unshift(fnOrBaseUrl);
    return;
  }
  if (typeof fnOrBaseUrl === "string" && fnOrBaseUrl.trim()) {
    const normalized = trimSlash(fnOrBaseUrl.trim());
    if (isSafeRemoteUrl(normalized)) GWS.unshift(makeGateway(normalized));
  }
}

export { GWS, PINATA_PRIMARY_GATEWAY };

function buildGatewayUrl(gw, cidOrPath, isIpns = false) {
  return typeof gw === "function"
    ? gw(cidOrPath, isIpns)
    : makeGateway(String(gw))(cidOrPath, isIpns);
}

/** Keep the IPFS/IPNS path intact while changing gateways, with no duplicate URLs. */
export function getIpfsGatewayCandidates(uri, gateways = GWS) {
  const raw = String(uri || "").trim();
  const resource = getIpfsResource(raw);
  if (!resource?.path) return [];
  if (/^https?:\/\//i.test(raw) && !isSafeRemoteUrl(raw)) return [];
  const urls = /^https?:\/\//i.test(raw) ? [raw] : [];
  for (const gw of gateways) {
    try {
      urls.push(buildGatewayUrl(gw, resource.path, resource.isIpns));
    } catch {
      // An invalid custom builder must not prevent trying the remaining gateways.
    }
  }
  return [
    ...new Set(urls.filter(isSafeRemoteUrl).map((url) => new URL(url).href)),
  ];
}

function cancelBody(response) {
  try {
    response?.body?.cancel?.()?.catch?.(() => {});
  } catch {
    // A body being consumed by json() can already be locked or aborted.
  }
}

function positiveTimeout(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function requestBudget(options) {
  const deadline =
    Date.now() +
    positiveTimeout(options.totalTimeout, DEFAULT_TOTAL_TIMEOUT_MS);
  const timeout = positiveTimeout(options.timeout, DEFAULT_ATTEMPT_TIMEOUT_MS);
  return () => Math.max(0, Math.min(timeout, deadline - Date.now()));
}

/** The optional consumer keeps the deadline active while reading the response body. */
export async function fetchWithTimeout(
  url,
  ms = 8000,
  fetchImpl = fetch,
  headers,
  consume,
) {
  const hasAbort = typeof AbortController !== "undefined";
  const ctrl = hasAbort ? new AbortController() : null;
  let response;
  let expired = false;
  let timer;
  const timeoutError = new Error("IPFS request timed out");
  timeoutError.name = "TimeoutError";
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => {
        expired = true;
        ctrl?.abort();
        cancelBody(response);
        reject(timeoutError);
      },
      positiveTimeout(ms, DEFAULT_ATTEMPT_TIMEOUT_MS),
    );
  });
  try {
    const work = (async () => {
      response = await fetchImpl(url, {
        signal: ctrl?.signal,
        cache: "no-cache",
        ...(headers ? { headers } : {}),
      });
      if (expired) {
        cancelBody(response);
        throw timeoutError;
      }
      return consume ? await consume(response) : response;
    })();
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Convert ipfs://... or ipns://... or /ipfs|/ipns to an HTTP URL via the primary gateway. */
export function httpFromIpfs(uri) {
  if (!uri) return uri;
  const s = String(uri).trim();
  if (s.startsWith("//")) return "";
  if (/^\/?(ipfs|ipns)(?::\/\/|\/)/i.test(s)) {
    return getIpfsGatewayCandidates(s)[0] || "";
  }
  if (/^https?:\/\//i.test(s)) return isSafeRemoteUrl(s) ? s : "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return "";
  return uri;
}

/**
 * Resolve an image URL from a metadata `image` field and its metadata URI.
 * Tries all known IPFS gateways if ipfs:// or ipns://, supports relative paths.
 */
async function resolveImageUrlRaw(imageField, metadataUri, options = {}) {
  const { gateways = GWS, fetchImpl = fetch } = options;
  if (!imageField) return null;
  const img = String(imageField).trim();
  if (img.startsWith("//")) return null;
  if (getIpfsResource(img)) {
    const candidates = getIpfsGatewayCandidates(img, gateways);
    const remaining = requestBudget(options);
    for (const url of candidates) {
      const timeout = remaining();
      if (!timeout) break;
      try {
        const valid = await fetchWithTimeout(
          url,
          timeout,
          fetchImpl,
          headersForUrl(url),
          (resp) => {
            const ctype = (resp?.headers?.get?.("content-type") || "")
              .toLowerCase()
              .split(";")[0]
              .trim();
            const isImage =
              !ctype ||
              ctype.startsWith("image/") ||
              ctype === "application/octet-stream";
            cancelBody(resp);
            return resp?.ok && isImage;
          },
        );
        if (valid) return url;
      } catch {
        // try next gateway
      }
    }
    // CORS can block fetch while <img> remains usable. The card has onError fallbacks.
    return candidates[0] || null;
  }

  if (/^https?:\/\//i.test(img)) {
    return isSafeRemoteUrl(img) ? img : null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(img)) return null;

  // relative path beside the metadata file
  const metaHttp = httpFromIpfs(metadataUri);
  try {
    const resolved = new URL(img, metaHttp).href;
    return resolveImageUrlRaw(resolved, metadataUri, options);
  } catch {
    return img.startsWith("//") ? null : img;
  }
}

export async function resolveImageUrl(imageField, metadataUri, options = {}) {
  if (!imageField) return null;
  const key = buildCacheKey("ipfs:img", imageField, metadataUri);
  try {
    return await cachedOrFetch(
      key,
      () => resolveImageUrlRaw(imageField, metadataUri, options),
      options,
      DEFAULT_IMAGE_CACHE_TTL_MS,
    );
  } catch {
    return resolveImageUrlRaw(imageField, metadataUri, options);
  }
}

/** Read JSON from ipfs://, ipns://, /ipfs/, /ipns/ or http(s) URI, trying multiple gateways for IPFS/IPNS. */
async function readJsonFromURIRaw(uri, options = {}) {
  const { gateways = GWS, fetchImpl = fetch } = options;
  try {
    if (!uri) return null;
    const u = String(uri).trim();

    const candidates = getIpfsResource(u)
      ? getIpfsGatewayCandidates(u, gateways)
      : isSafeRemoteUrl(u)
        ? [u]
        : [];
    const remaining = requestBudget(options);
    for (const url of candidates) {
      const timeout = remaining();
      if (!timeout) break;
      try {
        const json = await fetchWithTimeout(
          url,
          timeout,
          fetchImpl,
          headersForUrl(url),
          async (resp) => {
            const ctype = (
              resp?.headers?.get?.("content-type") || ""
            ).toLowerCase();
            if (!resp?.ok || ctype.includes("text/html")) {
              cancelBody(resp);
              return null;
            }
            return await resp.json();
          },
        );
        if (json) return json;
      } catch {
        // Includes stalled bodies and invalid JSON, not just connection failures.
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function readJsonFromURI(uri, options = {}) {
  if (!uri) return null;
  const key = buildCacheKey("ipfs:json", uri);
  try {
    return await cachedOrFetch(
      key,
      () => readJsonFromURIRaw(uri, options),
      options,
      DEFAULT_JSON_CACHE_TTL_MS,
    );
  } catch {
    return readJsonFromURIRaw(uri, options);
  }
}

// Default export for legacy compatibility (bundle-safe object).
export default {
  GWS,
  getIpfsGatewayCandidates,
  addIpfsGateway,
  fetchWithTimeout,
  httpFromIpfs,
  resolveImageUrl,
  readJsonFromURI,
};
