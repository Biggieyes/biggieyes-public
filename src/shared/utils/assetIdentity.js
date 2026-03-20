import { toTokenIdBigIntOrNull } from "./biggiIdIndex";

export function normalizeAssetAddress(value) {
  try {
    const raw =
      typeof value === "string"
        ? value
        : typeof value?.toString === "function"
          ? value.toString()
          : "";
    return String(raw || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

export function getAssetTokenIdString(item) {
  const tokenId = toTokenIdBigIntOrNull(item?.tokenId ?? item?.id ?? null);
  if (tokenId != null) return tokenId.toString();

  const fallback = String(item?.tokenId ?? item?.id ?? "").trim();
  return fallback;
}

export function getAssetContractAddress(item, fallbackAddress = "") {
  const candidates = [
    item?.contractAddress,
    item?.collectionAddress,
    item?.collection,
    item?.contract?.target,
    item?.contract?.address,
    item?.contract?.runner?.address,
    fallbackAddress,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeAssetAddress(candidate);
    if (normalized) return normalized;
  }

  return "";
}

export function getAssetCompositeKey(item, options = {}) {
  const tokenId = getAssetTokenIdString(item);
  if (!tokenId) return "";

  const address = getAssetContractAddress(item, options?.fallbackAddress);
  return address ? `${address}::${tokenId}` : tokenId;
}

export function buildRewardClaimPayload(items = [], options = {}) {
  const maxSupplyRaw = Number(options?.maxSupply);
  const maxSupply =
    Number.isFinite(maxSupplyRaw) && maxSupplyRaw > 0
      ? Math.trunc(maxSupplyRaw)
      : 550;
  const maxReasonableTokenId = BigInt(Math.max(maxSupply * 1000, 1_000_000));

  const primaryCollectionAddress = normalizeAssetAddress(
    options?.primaryCollectionAddress,
  );
  const allowedCollectionAddresses = Array.from(
    new Set(
      (Array.isArray(options?.allowedCollectionAddresses)
        ? options.allowedCollectionAddresses
        : []
      )
        .map((value) => normalizeAssetAddress(value))
        .filter(Boolean),
    ),
  );
  const allowedSet = new Set(allowedCollectionAddresses);
  const hasExplicitAllowlist = allowedSet.size > 0;

  const entries = [];
  const seen = new Set();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || item.isTicket || item.isPending) continue;

    const tokenId = toTokenIdBigIntOrNull(item?.tokenId ?? item?.id ?? null);
    if (tokenId == null || tokenId <= 0n || tokenId > maxReasonableTokenId) {
      continue;
    }

    let collectionAddress = getAssetContractAddress(item);
    if (collectionAddress && hasExplicitAllowlist && !allowedSet.has(collectionAddress)) {
      continue;
    }

    if (!collectionAddress) {
      if (allowedSet.size === 1) {
        collectionAddress = Array.from(allowedSet)[0];
      } else if (!hasExplicitAllowlist && primaryCollectionAddress) {
        collectionAddress = primaryCollectionAddress;
      }
    }

    const tokenIdString = tokenId.toString();
    const key = collectionAddress
      ? `${collectionAddress}::${tokenIdString}`
      : tokenIdString;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      item,
      tokenId,
      tokenIdString,
      collectionAddress,
    });
  }

  const tokenIds = entries.map((entry) => entry.tokenId);
  const collections = entries.map((entry) => entry.collectionAddress || "");
  const uniqueCollections = Array.from(
    new Set(collections.map((value) => normalizeAssetAddress(value)).filter(Boolean)),
  );
  const hasTokenIdCollisions =
    new Set(entries.map((entry) => entry.tokenIdString)).size !== entries.length;
  const canUseCollectionAware =
    entries.length > 0 && entries.every((entry) => Boolean(entry.collectionAddress));
  const hasCollectionOutsidePrimary =
    Boolean(primaryCollectionAddress) &&
    uniqueCollections.some((address) => address !== primaryCollectionAddress);

  return {
    entries,
    tokenIds,
    collections,
    trackedCount: entries.length,
    uniqueCollections,
    hasTokenIdCollisions,
    canUseCollectionAware,
    shouldUseCollectionAware:
      canUseCollectionAware &&
      (uniqueCollections.length > 1 ||
        hasTokenIdCollisions ||
        hasCollectionOutsidePrimary),
  };
}
