import { DEFAULT_BLOCKS } from "@/shared/blocks";

// A pinned prerelease is display-only; mint preflight still reads contract URIs.
export function getPublicArtworkPreviewAsset({
  release,
  chainId,
  chapterId,
  contractAddress,
  index,
}) {
  if (
    !release ||
    Number(chainId) !== release.chainId ||
    Number(chapterId) !== release.chapterId ||
    String(contractAddress || "").toLowerCase() !==
      String(release.contract || "").toLowerCase() ||
    !Number.isSafeInteger(index) ||
    index < 1 ||
    index > 100
  ) {
    return null;
  }

  const color = DEFAULT_BLOCKS[Math.floor((index - 1) / 10)];
  const stem = `Biggi_${index}_${color}_PUBLIC`;
  const sourceUri = `ipfs://${release.sourceMetadataCid}/${stem}.json`;
  const metadataUri = `ipfs://${release.metadataCid}/${stem}.json`;
  const awaitingArtwork = release.missingIds.includes(index);
  const extension = release.webpIds.includes(index) ? "webp" : "png";
  return {
    imageUri: awaitingArtwork
      ? ""
      : `ipfs://${release.imagesCid}/${stem}.${extension}`,
    metadataUri,
    sourceUri,
    awaitingArtwork,
  };
}

export function getPublicArtworkPreview(options) {
  const asset = getPublicArtworkPreviewAsset(options);
  const artwork = options?.artwork;
  if (
    !asset ||
    artwork?.valid !== true ||
    artwork.finalized !== false ||
    ![asset.sourceUri, asset.metadataUri].includes(artwork.metadataUri)
  ) {
    return null;
  }

  const { sourceUri: _sourceUri, ...preview } = asset;
  return preview;
}
