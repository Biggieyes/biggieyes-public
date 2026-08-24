import { CORE_CHAPTERS } from "@/shared/utils/addresses.js";
import { getAssetContractAddress } from "@/shared/utils/assetIdentity.js";

const toChapterId = (value) => {
  if (value == null || value === "") return null;
  const direct = Number(value);
  if (Number.isSafeInteger(direct) && direct > 0) return direct;

  const match = String(value).match(/(?:chapter\s*)?#?\s*(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const metadataChapterId = (item, chapters) => {
  const attributes = Array.isArray(item?.meta?.attributes)
    ? item.meta.attributes
    : Array.isArray(item?.attributes)
      ? item.attributes
      : [];
  const chapterTrait = attributes.find((attribute) =>
    /^chapter(?:\s+id)?$/i.test(
      String(attribute?.trait_type || attribute?.traitType || "").trim(),
    ),
  );
  const numeric = toChapterId(chapterTrait?.value);
  if (numeric != null) return numeric;

  const chapterName = String(chapterTrait?.value || "")
    .trim()
    .toLowerCase();
  if (!chapterName) return null;
  return (
    chapters.find(
      (chapter) =>
        String(chapter.displayName || "").toLowerCase() === chapterName ||
        String(chapter.seriesName || "").toLowerCase() === chapterName,
    )?.chapterId ?? null
  );
};

export function resolveGalleryChapterId(
  item,
  chapters = CORE_CHAPTERS,
  fallbackChapterId = CORE_CHAPTERS[0]?.chapterId ?? 1,
) {
  const configuredChapters = Array.isArray(chapters) ? chapters : [];
  const direct = toChapterId(item?.chapterId);
  if (direct != null) return direct;

  const contractAddress = getAssetContractAddress(item);
  if (contractAddress) {
    const chapter = configuredChapters.find(
      (candidate) =>
        String(candidate?.main || "").toLowerCase() === contractAddress ||
        String(candidate?.main2 || "").toLowerCase() === contractAddress,
    );
    if (chapter) return chapter.chapterId;
  }

  return metadataChapterId(item, configuredChapters) ?? fallbackChapterId;
}

export function filterGalleryItemsByChapter(
  items,
  chapterId,
  chapters = CORE_CHAPTERS,
) {
  const selected = toChapterId(chapterId);
  if (selected == null) return [];
  return (Array.isArray(items) ? items : []).filter(
    (item) => resolveGalleryChapterId(item, chapters) === selected,
  );
}

export function countGalleryAssetsByChapter(items, chapters = CORE_CHAPTERS) {
  const counts = Object.fromEntries(
    (Array.isArray(chapters) ? chapters : []).map((chapter) => [
      chapter.chapterId,
      0,
    ]),
  );
  for (const item of Array.isArray(items) ? items : []) {
    const chapterId = resolveGalleryChapterId(item, chapters);
    if (chapterId == null) continue;
    counts[chapterId] = (counts[chapterId] || 0) + 1;
  }
  return counts;
}
