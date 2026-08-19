import * as React from "react";
import { Contract } from "ethers";
import { BiggiChapterSeriesReader as ABI } from "@/config/abi/index.js";
import { ADDR, CORE_CHAPTERS } from "@/shared/utils/addresses.js";
import {
  getReadOnlyTicketHub,
  getROProvider,
} from "@/shared/utils/contract.js";
import { isRealAddress } from "@/features/tokenomics/utils/amountFormatting.js";

const toStringValue = (value) => {
  if (value == null) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value?.toString === "function") return value.toString();
  return String(value);
};

const toBool = (value) => {
  if (value == null) return null;
  return Boolean(value);
};

const collectionSnapshotFrom = (raw = {}, fallbackAddress = null) => ({
  collection: raw.collection ?? raw[0] ?? fallbackAddress,
  chapterId: toStringValue(raw.chapterId ?? raw[1]),
  seriesId: toStringValue(raw.seriesId ?? raw[2]),
  chapterNumber: toStringValue(raw.chapterNumber ?? raw[3]),
  tokenRewardsEligible: toBool(raw.tokenRewardsEligible ?? raw[4]),
  collectionRewardsEligible: toBool(raw.collectionRewardsEligible ?? raw[5]),
  isVrfCollection: toBool(raw.isVrfCollection ?? raw[6]),
  isPublicCollection: toBool(raw.isPublicCollection ?? raw[7]),
  isTicketHubCollection: toBool(raw.isTicketHubCollection ?? raw[8]),
});

const chapterSnapshotFrom = (raw = {}) => ({
  chapterId: toStringValue(raw.chapterId ?? raw[0]),
  configured: toBool(raw.configured ?? raw[1]),
  chapterExists: toBool(raw.chapterExists ?? raw[2]),
  seriesId: toStringValue(raw.seriesId ?? raw[3]),
  chapterNumber: toStringValue(raw.chapterNumber ?? raw[4]),
  vrfCollection: raw.vrfCollection ?? raw[5] ?? null,
  publicCollection: raw.publicCollection ?? raw[6] ?? null,
  ticketHub: raw.ticketHub ?? raw[7] ?? null,
  saleCap: toStringValue(raw.saleCap ?? raw[8]),
  marketingCap: toStringValue(raw.marketingCap ?? raw[9]),
  totalCap: toStringValue(raw.totalCap ?? raw[10]),
  saleMinted: toStringValue(raw.saleMinted ?? raw[11]),
  marketingMinted: toStringValue(raw.marketingMinted ?? raw[12]),
  totalMinted: toStringValue(raw.totalMinted ?? raw[13]),
  publicUnlocked: toBool(raw.publicUnlocked ?? raw[14]),
  priceProvider: raw.priceProvider ?? raw[15] ?? null,
  tokenRewardsEligibleVRF: toBool(raw.tokenRewardsEligibleVRF ?? raw[16]),
  tokenRewardsEligiblePublic: toBool(raw.tokenRewardsEligiblePublic ?? raw[17]),
  collectionRewardsEligibleVRF: toBool(
    raw.collectionRewardsEligibleVRF ?? raw[18],
  ),
  controllerRegistryMatch: toBool(raw.controllerRegistryMatch ?? raw[19]),
});

const seriesSnapshotFrom = (raw = {}) => ({
  seriesId: toStringValue(raw.seriesId ?? raw[0]),
  exists: toBool(raw.exists ?? raw[1]),
  name: raw.name ?? raw[2] ?? "",
  chapterCount: toStringValue(raw.chapterCount ?? raw[3]),
});

const globalSnapshotFrom = (raw = {}) => ({
  controller: raw.controller ?? raw[0] ?? ADDR.CHAPTER_CONTROLLER,
  registry: raw.registry ?? raw[1] ?? ADDR.SERIES_REGISTRY ?? ADDR.REGISTRY,
  seriesCount: toStringValue(raw.seriesCount ?? raw[2]),
  chapterCount: toStringValue(raw.chapterCount ?? raw[3]),
  controllerRegistry: raw.controllerRegistry ?? raw[4] ?? null,
  controllerMatchesRegistry: toBool(raw.controllerMatchesRegistry ?? raw[5]),
});

const uniqIds = (values) =>
  Array.from(
    new Set(
      values
        .map((value) => toStringValue(value))
        .filter((value) => value && value !== "0"),
    ),
  );

const safeCall = async (fn, fallback = null) => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

const buildFallback = () => ({
  reader: ADDR.CHAPTER_SERIES_READER || null,
  global: {
    controller: ADDR.CHAPTER_CONTROLLER,
    registry: ADDR.SERIES_REGISTRY || ADDR.REGISTRY,
    seriesCount: null,
    chapterCount: null,
    controllerRegistry: null,
    controllerMatchesRegistry: null,
  },
  collections: [],
  chapters: [],
  series: [],
});

export default function useChapterSeriesReader() {
  const [data, setData] = React.useState(() => buildFallback());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const provider = React.useMemo(() => {
    try {
      return getROProvider();
    } catch {
      return null;
    }
  }, []);

  const refresh = React.useCallback(async () => {
    const fallback = buildFallback();
    const readerAddress = ADDR.CHAPTER_SERIES_READER;
    const collectionAddresses = Array.from(
      new Set(
        [
          ...CORE_CHAPTERS.flatMap((chapter) => [chapter.main, chapter.main2]),
          ADDR.TICKET_HUB,
        ].filter(isRealAddress),
      ),
    );

    if (!provider || !isRealAddress(readerAddress) || !Array.isArray(ABI)) {
      setData(fallback);
      setError(null);
      return fallback;
    }

    setLoading(true);
    setError(null);
    try {
      const reader = new Contract(readerAddress, ABI, provider);
      const ticketHub = getReadOnlyTicketHub(provider);
      const [globalRaw, batchRaw] = await Promise.all([
        safeCall(() => reader.globalSnapshot(), null),
        collectionAddresses.length
          ? safeCall(
              () => reader.batchCollectionSnapshot(collectionAddresses),
              null,
            )
          : Promise.resolve(null),
      ]);

      const collections = Array.isArray(batchRaw)
        ? batchRaw.map((raw, index) =>
            collectionSnapshotFrom(raw, collectionAddresses[index]),
          )
        : await Promise.all(
            collectionAddresses.map(async (address) =>
              collectionSnapshotFrom(
                await safeCall(() => reader.collectionSnapshot(address), {}),
                address,
              ),
            ),
          );

      const chapterIds = uniqIds([
        ...CORE_CHAPTERS.map((chapter) => chapter.chapterId),
        ...collections.map((item) => item.chapterId),
      ]);
      const seriesIds = uniqIds([
        ...CORE_CHAPTERS.map((chapter) => chapter.seriesId),
        ...collections.map((item) => item.seriesId),
      ]);

      const chapters = await Promise.all(
        chapterIds.map(async (chapterId) => {
          const snapshot = chapterSnapshotFrom(
            await safeCall(() => reader.chapterSnapshot(chapterId), {}),
          );
          snapshot.active = toBool(
            await safeCall(() => ticketHub.chapterActive(chapterId), null),
          );
          return snapshot;
        }),
      );
      const series = await Promise.all(
        seriesIds.map(async (seriesId) =>
          seriesSnapshotFrom(
            await safeCall(() => reader.seriesSnapshot(seriesId), {}),
          ),
        ),
      );

      const next = {
        reader: readerAddress,
        global: globalSnapshotFrom(globalRaw || fallback.global),
        collections,
        chapters,
        series,
      };
      setData(next);
      return next;
    } catch (err) {
      setError(err);
      setData(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [provider]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
