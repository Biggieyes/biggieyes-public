const normalizeTokenId = (value) => String(value || "").trim();
const normalizeImage = (value) => String(value || "").trim();

export function buildLiveStatsAssetIdentity(contractAddress, tokenId) {
  const contract = String(contractAddress || "unknown").trim().toLowerCase();
  return `${contract || "unknown"}:${normalizeTokenId(tokenId)}`;
}

export function selectLiveStatsImage({
  tokenId,
  directImage,
  directTokenId,
  stableImage,
  stableTokenId,
  cachedImage,
  firstCandidate,
}) {
  const currentToken = normalizeTokenId(tokenId);
  if (!currentToken || currentToken === "-") return "";

  const direct = normalizeImage(directImage);
  if (direct && normalizeTokenId(directTokenId) === currentToken) return direct;

  const stable = normalizeImage(stableImage);
  if (stable && normalizeTokenId(stableTokenId) === currentToken) return stable;

  const cached = normalizeImage(cachedImage);
  if (cached) return cached;

  return normalizeImage(firstCandidate);
}
