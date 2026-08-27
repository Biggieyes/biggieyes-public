// src/components/COLLECTIONBlocksGrid.jsx
import * as React from "react";
import "./COLLECTIONBlocksGrid.css";

import useIsMobile from "../../../hooks/useIsMobile";
import useIsTouch from "../../../hooks/useIsTouch";
import useChapterSeriesReader from "../../../hooks/useChapterSeriesReader";
import { useStatsREWARDS } from "../../../hooks/useStatsRewards";
import {
  DEFAULT_BLOCKS,
  BASE_PRICES,
  ROWS_BY_BLOCK,
  BTN_STYLES,
  FALLBACK_BTN_STYLE,
} from "@/shared/blocks";
import {
  handleImageError,
  safeBlockFolder,
  getBlockImages,
  getBlockThumb,
  buildBlockImagePath,
  buildBlockThumbPath,
} from "../../../utils/images";
import { useContracts } from "../../../providers/ContractsProvider";
import {
  ensurePolygon,
  getReadOnlyChapterMain,
  getReadOnlyChapterMain2,
  getROProvider,
} from "@/shared/utils/contract";
import { CORE_CHAPTERS } from "@/shared/utils/addresses.js";
import { coerceBool } from "@/shared/utils/boolean";
import { formatEther } from "ethers";

// Import constants a utilities
import {
  MOBILE_BREAKPOINT,
  MAX_BLOCKS,
  PREVIEW_SIZE,
  COLLECTION_TABS,
  FALLBACK_VALUE,
  COLLECTION_STATUSES,
  getFutureCollectionStats,
} from "./COLLECTIONBlocksGrid.constants";
import {
  parseCount,
  parsePrice,
  formatPrice,
  formatCount,
  computeDiff,
  isValidPrice,
  isValidCount,
  safeAsyncCall,
  safeSyncCall,
} from "./COLLECTIONBlocksGrid.utils";

// Import sub-komponenty
import BlockCard from "./CollectionBlocksGrid.BlockCard";
import PanelInfoModal from "@/components/common/PanelInfoModal";
import PanelInfoButton from "@/components/common/PanelInfoButton";
import COLLECTION1Panel from "./CollectionBlocksGrid.Collection1Panel";
import COLLECTION2Panel from "./CollectionBlocksGrid.Collection2Panel";
import ChapterSeriesPanel from "./CollectionBlocksGrid.ChapterSeriesPanel";
import FutureCollectionsModal from "./CollectionBlocksGrid.FutureCollectionsModal";
import ModalPortal from "../../../components/common/ModalPortal";

const ExpansionPanelLazy = React.lazy(
  () => import("../../../components/expansion/ExpansionPanel.jsx"),
);
const NOOP = () => {};
const BACKGROUND_CODES = ["O", "B", "W", "BR", "BL", "G", "V", "R", "P", "RB"];
const MODAL_FILE_PATTERN = /^Biggi_(\d+)_([A-Z]+)_([A-Z]+)\.png$/i;
const DEFAULT_MODAL_SCAN_SUPPLY = 550;
const MODAL_SCAN_CHUNK = 32;

const parseModalImageFile = (fileName) => {
  const match = String(fileName || "").match(MODAL_FILE_PATTERN);
  if (!match) return null;
  return {
    mainId: String(Number(match[1])),
    blockName: String(match[2] || "").toUpperCase(),
    bgCode: String(match[3] || "").toUpperCase(),
  };
};

const blockNameFromInfoIndex = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n >= 1 && n <= DEFAULT_BLOCKS.length) return DEFAULT_BLOCKS[n - 1];
  if (n >= 0 && n < DEFAULT_BLOCKS.length) return DEFAULT_BLOCKS[n];
  return "";
};

const bgCodeFromInfoIndex = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n >= 1 && n <= BACKGROUND_CODES.length) return BACKGROUND_CODES[n - 1];
  if (n >= 0 && n < BACKGROUND_CODES.length) return BACKGROUND_CODES[n];
  return "";
};

const buildMintedModalKey = (mainId, bgCode) => {
  const idRaw = String(mainId || "").trim();
  const bg = String(bgCode || "").trim().toUpperCase();
  if (!/^\d+$/.test(idRaw) || !bg) return "";
  return `${String(Number(idRaw))}:${bg}`;
};

const resolveButtonStyle = (name) => {
  const variant = BTN_STYLES[safeBlockFolder(name)] || FALLBACK_BTN_STYLE;
  return {
    background: variant.background,
    borderColor: variant.borderColor,
    color: variant.color,
    boxShadow: variant.shadow,
  };
};

const COLLECTION_SECTION_META = {
  COLLECTION1: {
    title: "ORIGINALS COLLECTION",
    subtitle:
      "Live VRF collection view with block pricing, background impact, and rarity-linked supply signals across the first collection layer.",
    accent: "#ffe800",
    accentSoft: "rgba(255, 232, 0, 0.22)",
    accentGlow: "rgba(255, 232, 0, 0.38)",
  },
  COLLECTION2: {
    title: "PUBLIC COLLECTION",
    subtitle:
      "Track public mint pricing, availability, and mint setup inputs for the second collection layer in one control view.",
    accent: "#5ddcff",
    accentSoft: "rgba(93, 220, 255, 0.22)",
    accentGlow: "rgba(93, 220, 255, 0.38)",
  },
  expansion: {
    title: "EXPANSION",
    subtitle:
      "Inspect the expansion roadmap and ecosystem-linked telemetry gathered inside the collection hub.",
    accent: "#b584ff",
    accentSoft: "rgba(181, 132, 255, 0.22)",
    accentGlow: "rgba(181, 132, 255, 0.38)",
  },
  chapterSeries: {
    title: "CHAPTER / SERIES",
    subtitle:
      "Verify ChapterSeriesReader wiring, collection eligibility, and the active VRF/Public pair from Polygon mainnet.",
    accent: "#27d9d2",
    accentSoft: "rgba(39, 217, 210, 0.2)",
    accentGlow: "rgba(39, 217, 210, 0.32)",
  },
};

function COLLECTIONBlocksGrid({
  blockNames = [], // nepovinné override
  blockPrices: blockPricesProp, // nepovinné override
  blockMintCounts: blockMintCountsProp, // nepovinné override
  additionalText = "",
  activeCOLLECTION: activeCOLLECTIONProp = "COLLECTION1",
  onCOLLECTIONChange = () => {},
  autoOpenInfo = false,
  onActiveSectionChange,
}) {
  const [openBlock, setOpenBlock] = React.useState(null);
  const [hoveredBlock, setHoveredBlock] = React.useState(null);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const autoInfoOpened = React.useRef(false);
  const [futureOpen, setFutureOpen] = React.useState(false);
  const [selectedBlock, setSelectedBlock] = React.useState(1);
  const [selectedBackground, setSelectedBackground] = React.useState(1);
  const [desiredTokenId, setDesiredTokenId] = React.useState("");
  const [COLLECTIONMeta, setCOLLECTIONMeta] = React.useState({});
  const [onchainUnavailable, setOnchainUnavailable] = React.useState(false);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [localActive, setLocalActive] = React.useState(activeCOLLECTIONProp);
  const [modalMintedLoading, setModalMintedLoading] = React.useState(false);
  const [modalMintedKeys, setModalMintedKeys] = React.useState(() => new Set());
  const modalMintedCacheRef = React.useRef({
    snapshotKey: "",
    byBlock: {},
  });
  const futureStats = React.useMemo(
    () => getFutureCollectionStats(),
    [],
  );
  const {
    data: chapterSeriesData,
    loading: chapterSeriesLoading,
    error: chapterSeriesError,
    refresh: refreshChapterSeries,
  } = useChapterSeriesReader();

  const isMobile = useIsMobile(MOBILE_BREAKPOINT);
  const isTouch = useIsTouch();

  React.useEffect(() => {
    if (autoOpenInfo && !autoInfoOpened.current) {
      setInfoOpen(true);
      autoInfoOpened.current = true;
    }
  }, [autoOpenInfo]);

  React.useEffect(() => {
    setLocalActive(activeCOLLECTIONProp);
  }, [activeCOLLECTIONProp]);

  const [fallbackPrices, setFallbackPrices] = React.useState(
    Array(MAX_BLOCKS).fill(null),
  );
  const [fallbackMinted, setFallbackMinted] = React.useState(
    Array(MAX_BLOCKS).fill(null),
  );
  const [fallbackBgMinted, setFallbackBgMinted] = React.useState(
    Array(MAX_BLOCKS).fill(null),
  );

  const { fetchStats: fetchSnapshotStats } = useStatsREWARDS({
    setTicketPrice: NOOP,
    setTicketMinted: NOOP,
    setBiggiMinted: NOOP,
    setBlockPrices: setFallbackPrices,
    setBlockMintCounts: setFallbackMinted,
    setBackgroundMintCounts: setFallbackBgMinted,
    setRewardPool: NOOP,
    setMintVolumeMatic: NOOP,
    walletAddress: "",
    myNFTs: [],
    setMyClaimable: NOOP,
  });
  let contracts;
  try {
    contracts = useContracts();
  } catch (error) {
    // don't let contract access crash the component; log and continue
    // eslint-disable-next-line no-console
    console.warn("Failed to get contracts:", error);
    contracts = null;
  }

  const activeCollectionKey =
    localActive === "COLLECTION2" ? "COLLECTION2" : "COLLECTION1";

  const activeChapterIds = React.useMemo(
    () =>
      (Array.isArray(chapterSeriesData?.chapters)
        ? chapterSeriesData.chapters
        : []
      )
        .filter((chapter) => chapter.active === true)
        .map((chapter) => Number(chapter.chapterId))
        .filter((chapterId) => Number.isSafeInteger(chapterId)),
    [chapterSeriesData?.chapters],
  );
  const displayedChapter = React.useMemo(() => {
    if (activeChapterIds.length === 1) {
      return (
        CORE_CHAPTERS.find(
          (chapter) => chapter.chapterId === activeChapterIds[0],
        ) || CORE_CHAPTERS[0]
      );
    }
    return CORE_CHAPTERS[0];
  }, [activeChapterIds]);
  const displayedChapterIsActive = activeChapterIds.length === 1;

  const getCollectionReadContract = React.useCallback(() => {
    const readPublic = activeCollectionKey === "COLLECTION2";
    try {
      const roProvider = getROProvider();
      return readPublic
        ? getReadOnlyChapterMain2(displayedChapter.chapterId, roProvider)
        : getReadOnlyChapterMain(displayedChapter.chapterId, roProvider);
    } catch {
      try {
        if (readPublic) {
          return contracts?.chapterMain2Read?.(displayedChapter.chapterId) || null;
        }
        return contracts?.chapterMainRead?.(displayedChapter.chapterId) || null;
      } catch {
        return null;
      }
    }
  }, [contracts, activeCollectionKey, displayedChapter.chapterId]);

  // ==== on-chain zdroje ====
  const [livePrices, setLivePrices] = React.useState(
    Array(MAX_BLOCKS).fill(null),
  );
  const [liveMinted, setLiveMinted] = React.useState(
    Array(MAX_BLOCKS).fill(null),
  );

  React.useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const fmtPrice = (wei) =>
      safeSyncCall(() => Number(formatEther(wei)), null);

    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const coll = getCollectionReadContract();
        if (!coll) return;

        const pausedVal = await safeAsyncCall(() => coll.paused?.());
        const meta = {
          maxSupply: await safeAsyncCall(() => coll.MAX_SUPPLY?.()),
          maxTickets: await safeAsyncCall(() => coll.MAX_TICKETS?.()),
          ticketMinted: await safeAsyncCall(() => coll.ticketMinted?.()),
          biggiMinted: await safeAsyncCall(() => coll.biggiMinted?.()),
          paused: coerceBool(pausedVal),
        };

        meta.maxSupply = meta.maxSupply != null ? Number(meta.maxSupply) : null;
        meta.maxTickets =
          meta.maxTickets != null ? Number(meta.maxTickets) : null;
        meta.ticketMinted =
          meta.ticketMinted != null ? Number(meta.ticketMinted) : null;
        meta.biggiMinted =
          meta.biggiMinted != null ? Number(meta.biggiMinted) : null;

        const prices = [];
        const minted = [];

        // Defensive: verify there's contract code at the address before making repeated read calls.
        // If provider.getCode returns '0x' we likely pointed to a non-contract address or wrong network.
        try {
          const providerForCode = coll && coll.provider ? coll.provider : null;
          const contractAddress =
            coll?.target ||
            coll?.address ||
            (await safeAsyncCall(() =>
              typeof coll?.getAddress === "function" ? coll.getAddress() : null,
            ));
          const code =
            providerForCode && contractAddress
              ? await safeAsyncCall(() => providerForCode.getCode(contractAddress))
              : null;
          if (!code || code === "0x" || code === "0x0") {
            // eslint-disable-next-line no-console
            console.warn(
              "COLLECTION contract not found at address, skipping block reads:",
              contractAddress,
              code,
            );
            // mark as unavailable so UI can show a friendly notice
            setOnchainUnavailable(true);
            // leave prices/minted as null arrays
            for (let i = 1; i <= MAX_BLOCKS; i++) {
              prices.push(null);
              minted.push(null);
            }
            if (!cancelled) {
              setLivePrices(prices);
              setLiveMinted(minted);
              setCOLLECTIONMeta(meta);
            }
            return;
          }
        } catch (err) {
          // if getCode failed, fall back to attempting reads but don't crash
          // eslint-disable-next-line no-console
          console.debug(
            "Failed to verify contract code, attempting reads anyway:",
            err,
          );
        }

        const silentAsyncCall = async (fn) => {
          try {
            return await fn();
          } catch {
            return null;
          }
        };

        let blockInfosSupported = true;
        if (typeof coll.blockInfos === "function") {
          // Some deployments use 0-based blockIdx (0..9), others 1-based (1..10).
          const probe0 = await silentAsyncCall(() => coll.blockInfos(0));
          const probe1 = probe0 == null ? await silentAsyncCall(() => coll.blockInfos(1)) : null;
          if (probe0 == null && probe1 == null) blockInfosSupported = false;
        } else {
          blockInfosSupported = false;
        }

        const blockMintCountReader =
          typeof coll.getBlockMintCount === "function"
            ? (i) => coll.getBlockMintCount(i)
            : typeof coll.blockMintCounts === "function"
              ? (i) => coll.blockMintCounts(i)
              : null;
        let blockMintCountsSupported = false;
        if (blockMintCountReader) {
          const probe0 = await silentAsyncCall(() => blockMintCountReader(0));
          const probe1 = probe0 == null ? await silentAsyncCall(() => blockMintCountReader(1)) : null;
          blockMintCountsSupported = probe0 != null || probe1 != null;
        }

        // Decide block index base once to avoid off-by-one UI issues.
        let blockIndexBase = 1;
        if (typeof coll.getCurrentBlockPrice === "function") {
          const probe0 = await silentAsyncCall(() => coll.getCurrentBlockPrice(0));
          const probe1 = await silentAsyncCall(() => coll.getCurrentBlockPrice(1));
          // If 0 works, prefer 0-based to match base price table (Block 1 => index 0).
          if (probe0 != null) blockIndexBase = 0;
          else if (probe1 != null) blockIndexBase = 1;
        } else if (typeof coll.blockInfos === "function") {
          const probe0 = await silentAsyncCall(() => coll.blockInfos(0));
          if (probe0 != null) blockIndexBase = 0;
        } else if (blockMintCountReader) {
          const probe0 = await silentAsyncCall(() => blockMintCountReader(0));
          if (probe0 != null) blockIndexBase = 0;
        }

        for (let i = 0; i < MAX_BLOCKS; i++) {
          const blockId = i + blockIndexBase;
          let blockPrice = null;
          let blockMinted = null;

          if (blockInfosSupported) {
            const info = await silentAsyncCall(() => coll.blockInfos(blockId));
            blockPrice = info?.currentPrice ?? info?.[2] ?? null;
            blockMinted = info?.mintCount ?? info?.[3] ?? null;
          }

          if (blockPrice == null) {
            blockPrice = await safeAsyncCall(() =>
              coll.getCurrentBlockPrice?.(blockId),
            );
          }

          if (blockMinted == null && blockMintCountsSupported) {
            blockMinted = await silentAsyncCall(() =>
              blockMintCountReader(blockId),
            );
          }

          prices.push(blockPrice != null ? fmtPrice(blockPrice) : null);
          minted.push(blockMinted != null ? Number(blockMinted) : null);
        }

        if (!cancelled) {
          setLivePrices(prices);
          setLiveMinted(minted);
          setCOLLECTIONMeta(meta);
          // if we reached here, clear unavailable flag
          setOnchainUnavailable(false);
        }
      } catch (error) {
        console.error("Failed to load COLLECTION data:", error);
        // mark unavailable to inform user
        setOnchainUnavailable(true);
        if (!cancelled) {
          setLivePrices(Array(MAX_BLOCKS).fill(null));
          setLiveMinted(Array(MAX_BLOCKS).fill(null));
          setCOLLECTIONMeta({});
        }
      } finally {
        inFlight = false;
      }
    };

    load();
    const interval = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [getCollectionReadContract, reloadCounter]);

  React.useEffect(() => {
    setLivePrices(Array(MAX_BLOCKS).fill(null));
    setLiveMinted(Array(MAX_BLOCKS).fill(null));
    setCOLLECTIONMeta({});
    setFallbackPrices(Array(MAX_BLOCKS).fill(null));
    setFallbackMinted(Array(MAX_BLOCKS).fill(null));
    setFallbackBgMinted(Array(MAX_BLOCKS).fill(null));
    modalMintedCacheRef.current = { snapshotKey: "", byBlock: {} };
  }, [displayedChapter.chapterId, activeCollectionKey]);

  React.useEffect(() => {
    const missingPrices =
      !Array.isArray(blockPricesProp) || blockPricesProp.length === 0;
    const missingMintCounts =
      !Array.isArray(blockMintCountsProp) || blockMintCountsProp.length === 0;
    if (displayedChapter.chapterId !== 1) return;
    if (!missingPrices && !missingMintCounts) return;
    fetchSnapshotStats().catch((err) => {
      console.debug("COLLECTIONBlocksGrid snapshot fallback failed", err);
    });
  }, [
    blockPricesProp,
    blockMintCountsProp,
    displayedChapter.chapterId,
    fetchSnapshotStats,
  ]);

  // ====== normalizace vstupů + on-chain fallbacky ======
  const normalizedNames = React.useMemo(() => {
    const source =
      Array.isArray(blockNames) && blockNames.length
        ? blockNames
        : DEFAULT_BLOCKS;
    const trimmed = source.slice(0, MAX_BLOCKS);
    if (trimmed.length < MAX_BLOCKS) {
      return trimmed.concat(Array(MAX_BLOCKS - trimmed.length).fill("-"));
    }
    return trimmed;
  }, [blockNames]);

  const normalizedPrices = React.useMemo(() => {
    const fromProps = Array.isArray(blockPricesProp)
      ? blockPricesProp.slice(0, MAX_BLOCKS)
      : [];
    while (fromProps.length < MAX_BLOCKS) fromProps.push(null);

    const hasProps = fromProps.some((v) => Number.isFinite(v));
    const hasLive = Array.isArray(livePrices)
      ? livePrices.some((v) => Number.isFinite(v))
      : false;

    return fromProps.map((v, i) => {
      if (Number.isFinite(v)) return v;
      if (!hasProps && hasLive && Number.isFinite(livePrices?.[i]))
        return livePrices[i];
      return v == null ? (fallbackPrices[i] ?? null) : v;
    });
  }, [blockPricesProp, livePrices, fallbackPrices]);

  const normalizedMintCounts = React.useMemo(() => {
    const fromProps = Array.isArray(blockMintCountsProp)
      ? blockMintCountsProp.slice(0, MAX_BLOCKS)
      : [];
    while (fromProps.length < MAX_BLOCKS) fromProps.push(null);

    const hasProps = fromProps.some((v) => Number.isFinite(v));
    const hasLive = Array.isArray(liveMinted)
      ? liveMinted.some((v) => Number.isFinite(v))
      : false;

    return fromProps.map((v, i) => {
      if (Number.isFinite(v)) return v;
      if (!hasProps && hasLive && Number.isFinite(liveMinted?.[i]))
        return liveMinted[i];
      return v == null ? (fallbackMinted[i] ?? null) : v;
    });
  }, [blockMintCountsProp, liveMinted, fallbackMinted]);

  const blockEntries = React.useMemo(
    () =>
      normalizedNames.map((name, index) => {
        const folder = safeBlockFolder(name);
        const currentPrice = normalizedPrices[index];
        const minted = normalizedMintCounts[index];
        const basePrice =
          typeof BASE_PRICES[folder] === "number" ? BASE_PRICES[folder] : null;
        const blockFiles = getBlockImages(name);
        const thumbFallback =
          blockFiles.length > 0 ? buildBlockImagePath(blockFiles[0]) : "";

        return {
          id: `${folder || "BLOCK"}-${index}`,
          name,
          folder,
          currentPrice,
          minted,
          basePrice,
          diff: computeDiff(currentPrice ?? NaN, basePrice ?? NaN),
          thumb: getBlockThumb(name),
          thumbFallback,
          hasData: Boolean(name && name !== "-"),
          buttonStyle: resolveButtonStyle(name),
        };
      }),
    [normalizedNames, normalizedPrices, normalizedMintCounts],
  );

  const stats = React.useMemo(() => {
    const priceEntries = normalizedPrices
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => Number.isFinite(value));

    const mintEntries = normalizedMintCounts
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => Number.isFinite(value));

    const totalMinted = mintEntries.reduce((acc, { value }) => acc + value, 0);

    const averagePrice = priceEntries.length
      ? Math.round(
          priceEntries.reduce((acc, { value }) => acc + value, 0) /
            priceEntries.length,
        )
      : null;

    const highestPrice = priceEntries.reduce(
      (acc, e) => (acc && acc.value > e.value ? acc : e),
      null,
    );
    const lowestPrice = priceEntries.reduce(
      (acc, e) => (acc && acc.value < e.value ? acc : e),
      null,
    );
    const topMinted = mintEntries.reduce(
      (acc, e) => (acc && acc.value > e.value ? acc : e),
      null,
    );

    return {
      totalMinted,
      averagePrice,
      highestPrice,
      lowestPrice,
      topMinted,
      blocksWithData: blockEntries.filter((entry) => entry.hasData).length,
    };
  }, [normalizedPrices, normalizedMintCounts, blockEntries]);

  const selectedEntry = React.useMemo(() => {
    const idx = Number(selectedBlock) - 1;
    return blockEntries[idx] || blockEntries[0] || null;
  }, [selectedBlock, blockEntries]);

  const COLLECTIONTotals = React.useMemo(
    () => ({
      maxSupply: COLLECTIONMeta.maxSupply ?? null,
      maxTickets: COLLECTIONMeta.maxTickets ?? null,
      ticketMinted: COLLECTIONMeta.ticketMinted ?? null,
      biggiMinted: COLLECTIONMeta.biggiMinted ?? null,
      paused: Boolean(COLLECTIONMeta.paused),
    }),
    [COLLECTIONMeta],
  );

  React.useEffect(() => {
    if (openBlock) setHoveredBlock(null);
  }, [openBlock]);
  React.useEffect(() => {
    if (!openBlock) return;
    if (typeof document === "undefined") return;
    const body = document.body;
    if (!body) return;

    const prevTouchAction = body.style.touchAction;
    body.style.touchAction = "none";

    return () => {
      body.style.touchAction = prevTouchAction;
    };
  }, [openBlock]);

  const closeModal = React.useCallback(() => setOpenBlock(null), []);

  const handleCardOpen = React.useCallback((name) => {
    if (name && name !== "-") setOpenBlock(name);
  }, []);

  const handleCardKeyDown = React.useCallback(
    (e, name) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCardOpen(name);
      }
    },
    [handleCardOpen],
  );

  const handleRowHoverEnter = React.useCallback((name) => {
    setHoveredBlock(name);
  }, []);

  const handleRowHoverLeave = React.useCallback(() => {
    setHoveredBlock(null);
  }, []);

  const modalRows = openBlock
    ? ROWS_BY_BLOCK[safeBlockFolder(openBlock)] || MAX_BLOCKS
    : MAX_BLOCKS;
  const modalImages = React.useMemo(
    () => (openBlock ? getBlockImages(openBlock) : []),
    [openBlock],
  );
  const mintSnapshotKey = React.useMemo(
    () =>
      `${displayedChapter.chapterId}|${activeCollectionKey}|${normalizedMintCounts
        .map((value) => (Number.isFinite(value) ? Math.round(value) : 0))
        .join(",")}`,
    [displayedChapter.chapterId, activeCollectionKey, normalizedMintCounts],
  );

  React.useEffect(() => {
    if (!openBlock) {
      setModalMintedLoading(false);
      setModalMintedKeys(new Set());
      return;
    }

    const targetBlock = safeBlockFolder(openBlock);
    const cached = modalMintedCacheRef.current;
    if (cached.snapshotKey === mintSnapshotKey) {
      setModalMintedKeys(new Set(cached.byBlock?.[targetBlock] || []));
      setModalMintedLoading(false);
      return;
    }

    let cancelled = false;
    setModalMintedLoading(true);

    const loadMintedMatrix = async () => {
      try {
        const coll = getCollectionReadContract();
        if (!coll || typeof coll.nftInfo !== "function") {
          if (!cancelled) {
            modalMintedCacheRef.current = {
              snapshotKey: mintSnapshotKey,
              byBlock: {},
            };
            setModalMintedKeys(new Set());
          }
          return;
        }

        const maxSupplyRaw = await safeAsyncCall(
          () => coll.MAX_SUPPLY?.(),
          DEFAULT_MODAL_SCAN_SUPPLY,
        );
        const maxSupply = Math.max(
          1,
          Number(maxSupplyRaw) || DEFAULT_MODAL_SCAN_SUPPLY,
        );

        const byBlock = {};
        for (const name of DEFAULT_BLOCKS) byBlock[name] = new Set();

        for (let start = 1; start <= maxSupply; start += MODAL_SCAN_CHUNK) {
          const chunkLength = Math.min(MODAL_SCAN_CHUNK, maxSupply - start + 1);
          const indices = Array.from(
            { length: chunkLength },
            (_, offset) => start + offset,
          );
          const infos = await Promise.all(
            indices.map((idx) => safeAsyncCall(() => coll.nftInfo(idx), null)),
          );
          if (cancelled) return;

          for (const info of infos) {
            if (!info) continue;
            const minted = coerceBool(info?.minted ?? info?.[0]);
            if (!minted) continue;

            const blockName = blockNameFromInfoIndex(
              info?.blockIdx ?? info?.[2],
            );
            const bgCode = bgCodeFromInfoIndex(info?.background ?? info?.[1]);
            const key = buildMintedModalKey(info?.mainId ?? info?.[3], bgCode);

            if (!blockName || !key) continue;
            if (!byBlock[blockName]) byBlock[blockName] = new Set();
            byBlock[blockName].add(key);
          }
        }

        if (cancelled) return;
        modalMintedCacheRef.current = {
          snapshotKey: mintSnapshotKey,
          byBlock,
        };
        setModalMintedKeys(new Set(byBlock[targetBlock] || []));
      } finally {
        if (!cancelled) setModalMintedLoading(false);
      }
    };

    loadMintedMatrix();

    return () => {
      cancelled = true;
    };
  }, [openBlock, mintSnapshotKey, getCollectionReadContract]);

  const highestPriceName =
    stats.highestPrice &&
    blockEntries[stats.highestPrice.index] &&
    blockEntries[stats.highestPrice.index].name;
  const lowestPriceName =
    stats.lowestPrice &&
    blockEntries[stats.lowestPrice.index] &&
    blockEntries[stats.lowestPrice.index].name;
  const topMintedName =
    stats.topMinted &&
    blockEntries[stats.topMinted.index] &&
    blockEntries[stats.topMinted.index].name;

  const panelInfoItems = React.useMemo(
    () => [
      {
        label: "ORIGINALS COLLECTION",
        description: [
          "Primary collection blocks with live pricing and mints.",
          "Prices reflect base 1–10 POL + demand adjustments.",
        ],
      },
      {
        label: "COLLECTION 2",
        description: [
          "Secondary collection overview and on-chain stats.",
          "Useful for comparing demand and pricing between collections.",
        ],
      },
      {
        label: "EXPANSION",
        description: [
          "Expansion collection blocks and roadmap previews.",
          "Shows the mainnet-ready roadmap tied to the ecosystem loop.",
        ],
      },
      {
        label: "CHAPTER / SERIES",
        description: [
          "Live ChapterSeriesReader wiring for the current VRF/Public pair.",
          "Shows registry, controller, chapter caps, mint progress, and reward eligibility.",
        ],
      },
      {
        label: "FUTURE COLLECTIONS",
        description: [
          "Preview the mainnet-ready collection roadmap.",
          "Informational view for upcoming releases and supply targets.",
        ],
      },
    ],
    [],
  );

  const statRows = [
    {
      label: "Blocks configured",
      value: String(stats.blocksWithData ?? FALLBACK_VALUE),
      detail: "Cards rendered below",
    },
    {
      label: "Total minted",
      value: Number.isFinite(stats.totalMinted)
        ? String(Math.round(stats.totalMinted))
        : FALLBACK_VALUE,
      detail: "Sum across all blocks",
    },
    {
      label: "Average price",
      value: Number.isFinite(stats.averagePrice)
        ? `${stats.averagePrice} POL`
        : FALLBACK_VALUE,
      detail: "Based on live prices",
    },
    {
      label: "Highest price",
      value:
        stats.highestPrice && Number.isFinite(stats.highestPrice.value)
          ? `${Math.round(stats.highestPrice.value)} POL`
          : FALLBACK_VALUE,
      detail: highestPriceName || FALLBACK_VALUE,
    },
    {
      label: "Lowest price",
      value:
        stats.lowestPrice && Number.isFinite(stats.lowestPrice.value)
          ? `${Math.round(stats.lowestPrice.value)} POL`
          : FALLBACK_VALUE,
      detail: lowestPriceName || FALLBACK_VALUE,
    },
    {
      label: "Top minted block",
      value:
        stats.topMinted && Number.isFinite(stats.topMinted.value)
          ? String(Math.round(stats.topMinted.value))
          : FALLBACK_VALUE,
      detail: topMintedName || FALLBACK_VALUE,
    },
  ];

  // --- nový lokální stav pro fallback řízení activeCOLLECTION ---
  const effectiveActive = localActive;
  const activeSectionMeta =
    COLLECTION_SECTION_META[effectiveActive] ||
    COLLECTION_SECTION_META.COLLECTION1;

  React.useEffect(() => {
    onActiveSectionChange?.(activeSectionMeta);
  }, [activeSectionMeta, onActiveSectionChange]);

  const handleSwitchCOLLECTION = (key) => {
    // aktualizuj lokálně (zajistí zobrazení i když parent nekontroluje)
    // add a console trace to help debug UI hiding issues
    try {
      // set local active first
      setLocalActive(key);
      // call parent's handler if provided
      if (typeof onCOLLECTIONChange === "function") onCOLLECTIONChange(key);
    } catch (e) {
      // log error so it doesn't silently swallow and hide the UI
      // eslint-disable-next-line no-console
      console.error("[COLLECTIONBlocksGrid] handleSwitchCOLLECTION error:", e);
    }
  };

  const handleEnsurePolygon = React.useCallback(async () => {
    try {
      await ensurePolygon();
      // try reload data after switching
      setOnchainUnavailable(false);
      setReloadCounter((c) => c + 1);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("ensurePolygon failed:", err);
    }
  }, []);

  const handleRetry = React.useCallback(() => {
    setReloadCounter((c) => c + 1);
  }, []);

  const renderBlockCardsGrid = React.useCallback(
    (ctaLabel = "Open preview") =>
      blockEntries
        .filter((e) => e.hasData)
        .map((entry) => (
          <BlockCard
            key={entry.id}
            entry={entry}
            isHovered={hoveredBlock === entry.name}
            isTouch={isTouch}
            onOpen={handleCardOpen}
            onKeyDown={handleCardKeyDown}
            onMouseEnter={handleRowHoverEnter}
            onMouseLeave={handleRowHoverLeave}
            ctaLabel={ctaLabel}
          />
        )),
    [
      blockEntries,
      hoveredBlock,
      isTouch,
      handleCardOpen,
      handleCardKeyDown,
      handleRowHoverEnter,
      handleRowHoverLeave,
    ],
  );

  const renderCOLLECTIONTwo = React.useCallback(
    () => (
      <COLLECTION2Panel
        renderBlockCardsGrid={renderBlockCardsGrid}
        blockEntries={blockEntries}
        selectedBlock={selectedBlock}
        selectedBackground={selectedBackground}
        desiredTokenId={desiredTokenId}
        selectedEntry={selectedEntry}
        COLLECTIONTotals={COLLECTIONTotals}
        onBlockChange={setSelectedBlock}
        onBackgroundChange={setSelectedBackground}
        onTokenIdChange={setDesiredTokenId}
      />
    ),
    [
      renderBlockCardsGrid,
      blockEntries,
      selectedBlock,
      selectedBackground,
      desiredTokenId,
      selectedEntry,
      COLLECTIONTotals,
    ],
  );

  const renderExpansionPanel = () => (
    <section className="collection-grid__panel collection-grid__panel--expansion">
      <header className="collection-grid__panel-header">
        <h3>Expansion overview</h3>
        <p>Protocol telemetry moved into the COLLECTION hub.</p>
      </header>

      <div className="collection-grid__expansion-loading">
        <React.Suspense
          fallback={
            <div className="collection-grid__expansion-loading">
              Loading expansion data...
            </div>
          }
        >
          <ExpansionPanelLazy compact={isMobile} />
        </React.Suspense>
      </div>
    </section>
  );

  const renderChapterSeriesPanel = React.useCallback(
    () => (
      <ChapterSeriesPanel
        chapterSeries={chapterSeriesData}
        loading={chapterSeriesLoading}
        error={chapterSeriesError}
        onRefresh={refreshChapterSeries}
      />
    ),
    [
      chapterSeriesData,
      chapterSeriesLoading,
      chapterSeriesError,
      refreshChapterSeries,
    ],
  );

  const renderCOLLECTIONOne = React.useCallback(
    () => (
      <COLLECTION1Panel
        renderBlockCardsGrid={renderBlockCardsGrid}
        blockEntries={blockEntries}
        blockPrices={normalizedPrices}
        blockMints={normalizedMintCounts}
        stats={stats}
        highestPriceName={highestPriceName}
        lowestPriceName={lowestPriceName}
        topMintedName={topMintedName}
        additionalText={additionalText}
      />
    ),
    [
      renderBlockCardsGrid,
      blockEntries,
      normalizedPrices,
      normalizedMintCounts,
      stats,
      highestPriceName,
      lowestPriceName,
      topMintedName,
      additionalText,
    ],
  );

  const activePanel =
    effectiveActive === "COLLECTION2"
      ? renderCOLLECTIONTwo()
      : effectiveActive === "expansion"
        ? renderExpansionPanel()
        : effectiveActive === "chapterSeries"
          ? renderChapterSeriesPanel()
        : renderCOLLECTIONOne();

  return (
    <section
      className="collection-grid"
      style={{
        "--collection-active-accent": activeSectionMeta.accent,
        "--collection-active-accent-soft": activeSectionMeta.accentSoft,
        "--collection-active-accent-glow": activeSectionMeta.accentGlow,
      }}
    >
      <div
        className={`collection-grid__surface${isMobile ? " is-mobile" : ""}`}
      >
        <header className="collection-grid__header panel-header panel-header--collection">
          <div>
            <h2 className="collection-grid__title">{activeSectionMeta.title}</h2>
            <p className="collection-grid__subtitle">
              {activeSectionMeta.subtitle}
            </p>
            <span className="collection-grid__pill collection-grid__pill--outline">
              Chapter {displayedChapter.chapterId}: {displayedChapter.displayName}
              {displayedChapterIsActive ? " / Active" : " / Preview"}
            </span>
          </div>

          <div className="collection-grid__header-actions collection-grid__header-actions-gap">
            <div className="collection-grid__tabs">
              <button
                type="button"
                className={`collection-grid__tab${effectiveActive === "COLLECTION1" ? " is-active" : ""}`}
                onClick={() => handleSwitchCOLLECTION("COLLECTION1")}
              >
                ORIGINALS COLLECTION
              </button>
              <button
                type="button"
                className={`collection-grid__tab${effectiveActive === "COLLECTION2" ? " is-active" : ""}`}
                onClick={() => handleSwitchCOLLECTION("COLLECTION2")}
              >
                COLLECTION 2
              </button>
              <button
                type="button"
                className={`collection-grid__tab${effectiveActive === "expansion" ? " is-active" : ""}`}
                onClick={() => handleSwitchCOLLECTION("expansion")}
              >
                Expansion
              </button>
              <button
                type="button"
                className={`collection-grid__tab${effectiveActive === "chapterSeries" ? " is-active" : ""}`}
                onClick={() => handleSwitchCOLLECTION("chapterSeries")}
              >
                Chapter / Series
              </button>
              <button
                type="button"
                className="collection-grid__tab collection-grid__tab--future"
                onClick={() => setFutureOpen(true)}
              >
                Future COLLECTIONs
              </button>
              <PanelInfoButton
                className="panel-info-btn--transparent"
                onClick={() => setInfoOpen(true)}
                ariaLabel="COLLECTION buttons info"
              />
            </div>
          </div>
        </header>

        <PanelInfoModal
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          title="Collection Panel"
          items={panelInfoItems}
        />

        {onchainUnavailable && (
          <div
            className="collection-grid__onchain-warning"
            role="status"
            aria-live="polite"
          >
            <div className="collection-grid__onchain-message">
              On-chain data is unavailable. Switch MetaMask to{" "}
              <strong>Polygon mainnet</strong> or try again.
            </div>
            <div className="collection-grid__onchain-actions">
              <button
                type="button"
                className="collection-grid__btn"
                onClick={handleEnsurePolygon}
                aria-label="Switch MetaMask to Polygon mainnet"
              >
                Switch to Polygon
              </button>
              <button
                type="button"
                className="collection-grid__btn collection-grid__btn--ghost"
                onClick={handleRetry}
                aria-label="Retry loading on-chain data"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {futureOpen && (
          <FutureCollectionsModal
            isOpen={futureOpen}
            onClose={() => setFutureOpen(false)}
            futureStats={futureStats}
          />
        )}

        {activePanel || (
          <section className="collection-grid__panel">
            <div className="collection-grid__panel-empty">
              <p>
                Unable to render the selected panel. If this persists, check
                console for details.
              </p>
            </div>
          </section>
        )}
      </div>

      {openBlock && (
        <ModalPortal lockScroll>
          <div
            className="collection-grid__modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${safeBlockFolder(openBlock)} block preview`}
          >
            <div
              className="collection-grid__modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="collection-grid__modal-header">
                <div className="collection-grid__modal-title-wrap">
                  <h3>{safeBlockFolder(openBlock)} block preview</h3>
                  {modalMintedLoading ? (
                    <span className="collection-grid__modal-sync">
                      Syncing minted markers...
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="collection-grid__close-btn"
                  onClick={closeModal}
                >
                  Close
                </button>
              </div>

              <div
                className="collection-grid__modal-grid"
                style={{ "--grid-rows": String(modalRows) }}
              >
                {modalImages.length > 0 ? (
                  modalImages.map((file, index) => {
                    const isColumnStart = index % modalRows === 0;
                    const columnNumber = Math.floor(index / modalRows) + 1;
                    const imagePath = buildBlockImagePath(file);
                    const thumbPath = buildBlockThumbPath(file);
                    const parsed = parseModalImageFile(file);
                    const modalKey = parsed
                      ? buildMintedModalKey(parsed.mainId, parsed.bgCode)
                      : "";
                    const isMinted =
                      modalKey && modalMintedKeys.has(modalKey);
                    return (
                      <div
                        key={`${file}-${index}`}
                        className={`collection-grid__modal-item${isMinted ? " is-minted" : ""}`}
                      >
                        {isColumnStart && !isMobile && (
                          <div className="collection-grid__badge">
                            ID {safeBlockFolder(openBlock)} #{columnNumber}
                          </div>
                        )}
                        <div className="collection-grid__modal-image-wrap">
                          {isMinted ? (
                            <span className="collection-grid__minted-pill">
                              Minted
                            </span>
                          ) : null}
                          <img
                            src={thumbPath}
                            data-fallback-src={imagePath}
                            alt={`${safeBlockFolder(openBlock)} NFT ${index + 1}`}
                            width={PREVIEW_SIZE}
                            height={PREVIEW_SIZE}
                            loading="lazy"
                            decoding="async"
                            onError={handleImageError}
                          />
                        </div>
                        <span className="collection-grid__modal-name">
                          {file.replace(/\.\w+$/, "")}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="collection-grid__modal-empty">
                    No images configured for this block.
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  );
}

export default COLLECTIONBlocksGrid;
