// useIPFS.js
import * as React from "react";

const IPFS_GATEWAYS = [
  (cid) => `https://ipfs.io/ipfs/${cid}`,
  (cid) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid) => `https://gateway.pinata.cloud/ipfs/${cid}`,
  (cid) => `https://dweb.link/ipfs/${cid}`,
  (cid) => `https://nftstorage.link/ipfs/${cid}`,
  (cid) => `https://cf-ipfs.com/ipfs/${cid}`,
  (cid) => `https://ipfs.filebase.io/ipfs/${cid}`,
  (cid) => `https://gateway.lighthouse.storage/ipfs/${cid}`,
];

async function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const resp = await fetch(url, { signal: ctrl.signal, cache: "no-cache" });
    return resp;
  } finally {
    clearTimeout(t);
  }
}

export function useIPFS() {
  const httpFromIpfs = React.useCallback((uri) => {
    if (!uri) return uri;
    if (uri.startsWith("ipfs://")) {
      const cid = uri.replace("ipfs://", "");
      return `https://ipfs.io/ipfs/${cid}`;
    }
    return uri;
  }, []);

  const normalizeIpfsImage = React.useCallback((img) => {
    if (!img) return img;
    if (!img.startsWith("ipfs://")) return img;
    const cid = img.replace("ipfs://", "");
    return IPFS_GATEWAYS[0](cid);
  }, []);

  const resolveImageUrl = React.useCallback(
    (imageField, metadataUri) => {
      if (!imageField) return null;
      if (imageField.startsWith("ipfs://"))
        return normalizeIpfsImage(imageField);
      if (/^https?:\/\//i.test(imageField)) return imageField;

      const metaHttp = httpFromIpfs(metadataUri);
      try {
        const u = new URL(metaHttp);
        const clean = String(imageField).replace(/^\.?\//, "");
        u.pathname = u.pathname.replace(/\/[^/]*$/, `/${clean}`);
        return u.toString();
      } catch (err) {
        console.debug("resolveImageUrl URL parse failed", err);
        return imageField;
      }
    },
    [httpFromIpfs, normalizeIpfsImage],
  );

  const readJsonFromURI = React.useCallback(async (uri) => {
    try {
      if (!uri) return null;
      if (uri.startsWith("ipfs://")) {
        const cid = uri.replace("ipfs://", "");
        for (const build of IPFS_GATEWAYS) {
          try {
            const resp = await fetchWithTimeout(build(cid), 8000);
            if (resp.ok) return await resp.json();
          } catch (err) {
            console.debug(
              "readJsonFromURI IPFS gateway failed",
              build(cid),
              err,
            );
          }
        }
        return null;
      } else {
        const resp = await fetchWithTimeout(uri, 8000);
        if (resp.ok) return await resp.json();
        return null;
      }
    } catch (err) {
      console.debug("readJsonFromURI failed", uri, err);
      return null;
    }
  }, []);

  return { httpFromIpfs, normalizeIpfsImage, resolveImageUrl, readJsonFromURI };
}
