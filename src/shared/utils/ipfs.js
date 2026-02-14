// Legacy compatibility layer.
// Keep imports from "@/shared/utils/ipfs" working, but route all logic
// through the canonical implementation in "@/shared/services/ipfs".
import {
  GWS,
  addIpfsGateway,
  fetchWithTimeout,
  httpFromIpfs,
  readJsonFromURI,
  resolveImageUrl as resolveImageUrlAsync,
} from "../services/ipfs.js";

export const IPFS_GATEWAYS = GWS;

export { addIpfsGateway, fetchWithTimeout, httpFromIpfs, readJsonFromURI };

export function normalizeIpfsImage(value) {
  return httpFromIpfs(value);
}

export async function resolveImageUrl(imageField, metadataUri, options = {}) {
  return resolveImageUrlAsync(imageField, metadataUri, options);
}

export default {
  IPFS_GATEWAYS,
  addIpfsGateway,
  fetchWithTimeout,
  httpFromIpfs,
  normalizeIpfsImage,
  resolveImageUrl,
  readJsonFromURI,
};
