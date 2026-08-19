import { toMainNftIndexFromTokenId } from "./biggiIdIndex.js";

export function getAssetTokenId(asset) {
  const value = asset?.tokenId ?? asset?.id;
  if (value == null) return "";
  return String(value).trim();
}

export function normalizeAssetContractAddress(value) {
  return String(value || "").trim().toLowerCase();
}

export const getAssetTokenIdString = getAssetTokenId;
export const normalizeAssetAddress = normalizeAssetContractAddress;

export function getAssetContractAddress(asset) {
  return normalizeAssetContractAddress(
    asset?.contractAddress || asset?.collectionAddress || asset?.collection,
  );
}

export function getAssetIdentity(asset, fallbackContractAddress = "") {
  const tokenId = getAssetTokenId(asset);
  if (!tokenId) return "";
  const contractAddress = normalizeAssetContractAddress(
    getAssetContractAddress(asset) || fallbackContractAddress,
  );
  return `${contractAddress || "unknown"}:${tokenId}`;
}

export const getAssetCompositeKey = getAssetIdentity;

export function getAssetReference(asset, fallbackContractAddress = "") {
  const tokenId = getAssetTokenId(asset);
  if (!tokenId) return "";
  const contractAddress = normalizeAssetContractAddress(
    getAssetContractAddress(asset) || fallbackContractAddress,
  );
  return contractAddress ? `${contractAddress}:${tokenId}` : tokenId;
}

export function isAssetReferenceMatch(
  asset,
  reference,
  fallbackContractAddress = "",
) {
  const normalizedReference = String(reference || "").trim().toLowerCase();
  if (!normalizedReference) return false;
  if (!normalizedReference.includes(":")) {
    return getAssetTokenId(asset).toLowerCase() === normalizedReference;
  }
  return (
    getAssetReference(asset, fallbackContractAddress).toLowerCase() ===
    normalizedReference
  );
}

export function buildRewardClaimPayload(assets, options = {}) {
  const maxSupply = Number(options.maxSupply || 550) || 550;
  const primaryCollectionAddress = normalizeAssetContractAddress(
    options.primaryCollectionAddress,
  );
  const allowedCollections = new Set(
    (Array.isArray(options.allowedCollectionAddresses)
      ? options.allowedCollectionAddresses
      : []
    )
      .map(normalizeAssetContractAddress)
      .filter(Boolean),
  );

  const tokenIds = [];
  const collections = [];
  const seen = new Set();
  const tokenIdCounts = new Map();

  for (const asset of Array.isArray(assets) ? assets : []) {
    if (!asset || asset.isTicket || asset.isPending) continue;
    const collection =
      getAssetContractAddress(asset) || primaryCollectionAddress;
    if (!collection) continue;
    if (allowedCollections.size && !allowedCollections.has(collection)) continue;

    const nftIndex = toMainNftIndexFromTokenId(getAssetTokenId(asset), {
      maxSupply,
      allowLegacy: true,
    });
    if (nftIndex == null) continue;

    const tokenId = BigInt(nftIndex);
    const key = `${collection}:${tokenId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    tokenIds.push(tokenId);
    collections.push(collection);
    const tokenKey = tokenId.toString();
    tokenIdCounts.set(tokenKey, (tokenIdCounts.get(tokenKey) || 0) + 1);
  }

  const hasTokenIdCollisions = Array.from(tokenIdCounts.values()).some(
    (count) => count > 1,
  );
  const hasSecondaryCollections = collections.some(
    (collection) =>
      primaryCollectionAddress && collection !== primaryCollectionAddress,
  );

  return {
    tokenIds,
    collections,
    trackedCount: tokenIds.length,
    hasTokenIdCollisions,
    shouldUseCollectionAware:
      hasTokenIdCollisions || hasSecondaryCollections,
  };
}
