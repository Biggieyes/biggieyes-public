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

export const IPFS_GATEWAYS = [
  (cid) => `https://biggieyes.mypinata.cloud/ipfs/${cid}`,
  (cid) => `https://ipfs.io/ipfs/${cid}`,
  (cid) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid) => `https://gateway.pinata.cloud/ipfs/${cid}`,
  (cid) => `https://dweb.link/ipfs/${cid}`,
  (cid) => `https://nftstorage.link/ipfs/${cid}`,
  (cid) => `https://cf-ipfs.com/ipfs/${cid}`,
  (cid) => `https://ipfs.filebase.io/ipfs/${cid}`,
  (cid) => `https://gateway.lighthouse.storage/ipfs/${cid}`,
];

const META_CACHE_LIMIT = 400;
const IMAGE_CACHE_LIMIT = 600;
const metaCache = new Map();
const imageCache = new Map();

function cacheSet(map, key, value, limit) {
  if (!key) return;
  if (!map.has(key) && map.size >= limit) {
    const firstKey = map.keys().next().value;
    if (firstKey != null) map.delete(firstKey);
  }
  map.set(key, value);
}

export async function fetchWithTimeout(url, ms = 8000, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-cache",
      ...(headers ? { headers } : {}),
    });
    return resp;
  } finally {
    clearTimeout(t);
  }
}

export function httpFromIpfs(uri) {
  if (!uri) return uri;
  if (uri.startsWith("ipfs://")) {
    const cid = uri.replace("ipfs://", "");
    return IPFS_GATEWAYS[0](cid);
  }
  return uri;
}

export function normalizeIpfsImage(img) {
  if (!img) return img;
  if (!img.startsWith("ipfs://")) return img;
  const cid = img.replace("ipfs://", "");
  return IPFS_GATEWAYS[0](cid);
}

export function resolveImageUrl(imageField, metadataUri) {
  const cacheKey = `${metadataUri || ""}|${imageField || ""}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);
  if (!imageField) return null;
  if (imageField.startsWith("ipfs://")) {
    const resolved = normalizeIpfsImage(imageField);
    cacheSet(imageCache, cacheKey, resolved, IMAGE_CACHE_LIMIT);
    return resolved;
  }
  if (/^https?:\/\//i.test(imageField)) {
    cacheSet(imageCache, cacheKey, imageField, IMAGE_CACHE_LIMIT);
    return imageField;
  }

  const metaHttp = httpFromIpfs(metadataUri);
  try {
    const u = new URL(metaHttp);
    const clean = String(imageField).replace(/^\.\.?\//, "");
    u.pathname = u.pathname.replace(/\/[^/]*$/, `/${clean}`);
    const resolved = u.toString();
    cacheSet(imageCache, cacheKey, resolved, IMAGE_CACHE_LIMIT);
    return resolved;
  } catch {
    cacheSet(imageCache, cacheKey, imageField, IMAGE_CACHE_LIMIT);
    return imageField;
  }
}

export async function readJsonFromURI(uri) {
  try {
    if (!uri) return null;
    if (metaCache.has(uri)) return metaCache.get(uri);
    if (uri.startsWith("ipfs://")) {
      const cid = uri.replace("ipfs://", "");
      for (const build of IPFS_GATEWAYS) {
        try {
          const url = build(cid);
          const resp = await fetchWithTimeout(url, 8000, headersForUrl(url));
          if (resp.ok) {
            const ctype = resp?.headers?.get?.("content-type") || "";
            if (ctype.includes("text/html")) {
              const txt = await resp.text().catch(() => "");
              if (txt && txt.includes(LIMIT_TEXT)) continue;
              continue;
            }
            const json = await resp.json();
            if (json) cacheSet(metaCache, uri, json, META_CACHE_LIMIT);
            return json;
          }
        } catch {
          // try next gateway
        }
      }
      return null;
    } else {
      const resp = await fetchWithTimeout(uri, 8000, headersForUrl(uri));
      if (resp.ok) {
        const json = await resp.json();
        if (json) cacheSet(metaCache, uri, json, META_CACHE_LIMIT);
        return json;
      }
      return null;
    }
  } catch {
    return null;
  }
}

