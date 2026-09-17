import { DEFAULT_BLOCKS } from "@/shared/blocks";

// A pinned prerelease is display-only; mint preflight still reads contract URIs.
export function getPublicArtworkPreview({
  release,
  chainId,
  chapterId,
  contractAddress,
  index,
  artwork,
}) {
  if (
    !release ||
    Number(chainId) !== release.chainId ||
    Number(chapterId) !== release.chapterId ||
    String(contractAddress || "").toLowerCase() !==
      release.contract.toLowerCase() ||
    !Number.isSafeInteger(index) ||
    index < 1 ||
    index > 100 ||
    artwork?.valid !== true ||
    artwork.finalized !== false
  ) {
    return null;
  }

  const color = DEFAULT_BLOCKS[Math.floor((index - 1) / 10)];
  const stem = `Biggi_${index}_${color}_PUBLIC`;
  const sourceUri = `ipfs://${release.sourceMetadataCid}/${stem}.json`;
  const metadataUri = `ipfs://${release.metadataCid}/${stem}.json`;
  if (![sourceUri, metadataUri].includes(artwork.metadataUri)) return null;

  const awaitingArtwork = release.missingIds.includes(index);
  const extension = release.webpIds.includes(index) ? "webp" : "png";
  return {
    imageUri: awaitingArtwork
      ? ""
      : `ipfs://${release.imagesCid}/${stem}.${extension}`,
    metadataUri,
    awaitingArtwork,
  };
}
