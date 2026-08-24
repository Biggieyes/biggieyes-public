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
  readCollectionBlockSnapshot,
  normalizeNftInfo,
  normalizeMetadataConsistency,
} from "./COLLECTIONBlocksGrid.utils";

// Import sub-komponenty
import BlockCard from "./CollectionBlocksGrid.BlockCard";
import PanelInfoModal from "@/components/common/PanelInfoModal";
import PanelInfoButton from "@/components/common/PanelInfoButton";
import COLLECTION1Panel from "./CollectionBlocksGrid.Collection1Panel";
import COLLECTION2Panel from "./CollectionBlocksGrid.Collection2Panel";
import ChapterSeriesPanel from "./CollectionBlocksGrid.ChapterSeriesPanel";
import ModalPortal from "../../../components/common/ModalPortal";

const NOOP = () => {};
const BACKGROUND_CODES = ["O", "B", "W", "BR", "BL", "G", "V", "R", "P", "RB"];
const MODAL_FILE_PATTERN = /^Biggi_(\d+)_([A-Z]+)_([A-Z]+)\.png$/i;
const DEFAULT_MODAL_SCAN_SUPPLY = 550;
const PUBLIC_MAX_SUPPLY = 100;
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
  const bg = String(bgCode || "")
    .trim()
    .toUpperCase();
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
    title: "VRF COLLECTION",
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
  chapterSeries: {
    title: "CHAPTERS",
    subtitle:
      "Current chapter availability and mint progress from Polygon mainnet.",
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
  const [selectedChapterId, setSelectedChapterId] = React.useState(1);
  const [selectedBlock, setSelectedBlock] = React.useState(1);
  const [desiredTokenId, setDesiredTokenId] = React.useState("");
  const [selectedPublicNft, setSelectedPublicNft] = React.useState({
    info: null,
    loading: false,
    error: null,
  });
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
  const displayedChapter = React.useMemo(
    () =>
      CORE_CHAPTERS.find(
        (chapter) => chapter.chapterId === selectedChapterId,
      ) || CORE_CHAPTERS[0],
    [selectedChapterId],
  );
  const displayedChapterIsActive =
    activeChapterIds.length === 1 &&
    activeChapterIds[0] === displayedChapter.chapterId;
  const isFutureChapter = displayedChapter.chapterId !== 1;
  const displayedChapterSnapshot = React.useMemo(
    () =>
      (Array.isArray(chapterSeriesData?.chapters)
        ? chapterSeriesData.chapters
        : []
      ).find(
        (chapter) =>
          Number(chapter.chapterId) === Number(displayedChapter.chapterId),
      ) || null,
    [chapterSeriesData?.chapters, displayedChapter.chapterId],
  );

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
          return (
            contracts?.chapterMain2Read?.(displayedChapter.chapterId) || null
          );
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
  const [liveBasePrices, setLiveBasePrices] = React.useState(
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

        const [pausedVal, metadataRaw] = await Promise.all([
          safeAsyncCall(() => coll.paused?.()),
          safeAsyncCall(() => coll.metadataConsistency?.()),
        ]);
        const metadata = normalizeMetadataConsistency(metadataRaw);
        const meta = {
          maxSupply: await safeAsyncCall(() => coll.MAX_SUPPLY?.()),
          biggiMinted: await safeAsyncCall(() => coll.biggiMinted?.()),
          paused: pausedVal == null ? null : coerceBool(pausedVal),
          ...metadata,
        };

        meta.maxSupply = meta.maxSupply != null ? Number(meta.maxSupply) : null;
        meta.biggiMinted =
          meta.biggiMinted != null ? Number(meta.biggiMinted) : null;

        const basePrices = [];
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
              ? await safeAsyncCall(() =>
                  providerForCode.getCode(contractAddress),
                )
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
              basePrices.push(null);
              prices.push(null);
              minted.push(null);
            }
            if (!cancelled) {
              setLiveBasePrices(basePrices);
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

        const blockRows = await Promise.all(
          Array.from({ length: MAX_BLOCKS }, (_, index) =>
            readCollectionBlockSnapshot(coll, index + 1),
          ),
        );
        for (const row of blockRows) {
          basePrices.push(
            row.basePriceWei != null ? fmtPrice(row.basePriceWei) : null,
          );
          prices.push(row.priceWei != null ? fmtPrice(row.priceWei) : null);
          minted.push(row.mintedRaw != null ? Number(row.mintedRaw) : null);
        }

        if (!cancelled) {
          setLiveBasePrices(basePrices);
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
          setLiveBasePrices(Array(MAX_BLOCKS).fill(null));
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
    setLiveBasePrices(Array(MAX_BLOCKS).fill(null));
    setLivePrices(Array(MAX_BLOCKS).fill(null));
    setLiveMinted(Array(MAX_BLOCKS).fill(null));
    setCOLLECTIONMeta({});
    setFallbackPrices(Array(MAX_BLOCKS).fill(null));
    setFallbackMinted(Array(MAX_BLOCKS).fill(null));
    setFallbackBgMinted(Array(MAX_BLOCKS).fill(null));
    modalMintedCacheRef.current = { snapshotKey: "", byBlock: {} };
  }, [displayedChapter.chapterId, activeCollectionKey]);

  React.useEffect(() => {
    if (activeCollectionKey !== "COLLECTION2") {
      setSelectedPublicNft({ info: null, loading: false, error: null });
      return undefined;
    }

    const index = Number(desiredTokenId);
    const publicMaxSupply = Number(COLLECTIONMeta.maxSupply) || PUBLIC_MAX_SUPPLY;
    if (!Number.isInteger(index) || index < 1 || index > publicMaxSupply) {
      setSelectedPublicNft({ info: null, loading: false, error: null });
      return undefined;
    }

    let cancelled = false;
    setSelectedPublicNft({ info: null, loading: true, error: null });
    const load = async () => {
      const contract = getCollectionReadContract();
      if (!contract || typeof contract.nftInfo !== "function") {
        if (!cancelled) {
          setSelectedPublicNft({
            info: null,
            loading: false,
            error: "NFT metadata is unavailable.",
          });
        }
        return;
      }
      try {
        const info = normalizeNftInfo(await contract.nftInfo(index));
        if (!cancelled) {
          setSelectedPublicNft({ info, loading: false, error: null });
          if (info?.blockIdx >= 1 && info.blockIdx <= MAX_BLOCKS) {
            setSelectedBlock(info.blockIdx);
          }
        }
      } catch {
        if (!cancelled) {
          setSelectedPublicNft({
            info: null,
            loading: false,
            error: "Unable to read this NFT from Polygon.",
          });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    activeCollectionKey,
    desiredTokenId,
    getCollectionReadContract,
    COLLECTIONMeta.maxSupply,
  ]);

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
    const fromProps =
      displayedChapter.chapterId === 1 && Array.isArray(blockPricesProp)
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
  }, [blockPricesProp, displayedChapter.chapterId, livePrices, fallbackPrices]);

  const normalizedMintCounts = React.useMemo(() => {
    const fromProps =
      displayedChapter.chapterId === 1 && Array.isArray(blockMintCountsProp)
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
  }, [
    blockMintCountsProp,
    displayedChapter.chapterId,
    liveMinted,
    fallbackMinted,
  ]);

  const blockEntries = React.useMemo(
    () =>
      normalizedNames.map((name, index) => {
        const folder = safeBlockFolder(name);
        const currentPrice = normalizedPrices[index];
        const minted = normalizedMintCounts[index];
        const basePrice = Number.isFinite(liveBasePrices[index])
          ? liveBasePrices[index]
          : displayedChapter.chapterId === 1 &&
              typeof BASE_PRICES[folder] === "number"
            ? BASE_PRICES[folder]
            : null;
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
    [
      displayedChapter.chapterId,
      normalizedNames,
      normalizedPrices,
      normalizedMintCounts,
      liveBasePrices,
    ],
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
      maxTickets:
        displayedChapterSnapshot?.totalCap == null
          ? null
          : Number(displayedChapterSnapshot.totalCap),
      ticketMinted:
        displayedChapterSnapshot?.totalMinted == null
          ? null
          : Number(displayedChapterSnapshot.totalMinted),
      biggiMinted: COLLECTIONMeta.biggiMinted ?? null,
      paused: COLLECTIONMeta.paused ?? null,
      metadataConfiguredCount: COLLECTIONMeta.configuredCount ?? null,
      metadataFullyConfigured: COLLECTIONMeta.fullyConfigured ?? null,
      rewardMatrixConsistent: COLLECTIONMeta.rewardMatrixConsistent ?? null,
      chapterActive: displayedChapterSnapshot?.active ?? false,
      publicUnlocked: displayedChapterSnapshot?.publicUnlocked ?? false,
    }),
    [COLLECTIONMeta, displayedChapterSnapshot],
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
        label: "VRF COLLECTION",
        description: [
          "VRF collection blocks with current Polygon prices and mint counts.",
        ],
      },
      {
        label: "PUBLIC COLLECTION",
        description: [
          "Public NFTs use the paired VRF block price and their preconfigured metadata.",
        ],
      },
      {
        label: "CHAPTERS",
        description: [
          "Only one chapter may be available at a time.",
          "Progress and availability come from Polygon mainnet.",
        ],
      },
      {
        label: "FUTURE COLLECTIONS",
        description: [
          "Preview deployed but inactive chapter pairs in release order.",
        ],
      },
    ],
    [],
  );

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
            comingSoon={isFutureChapter}
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
      isFutureChapter,
    ],
  );

  const renderChapterSwitcher = React.useCallback(
    () => (
      <nav
        className="collection-grid__chapter-switcher"
        aria-label="Collection chapters"
      >
        <div className="collection-grid__chapter-switcher-heading">
          <span>Next collections</span>
          <strong>{displayedChapter.seriesName}</strong>
        </div>
        <div className="collection-grid__chapter-switcher-buttons">
          {isFutureChapter ? (
            <button
              type="button"
              className="collection-grid__chapter-button collection-grid__chapter-button--original"
              onClick={() => setSelectedChapterId(1)}
            >
              Back to Original
            </button>
          ) : null}
          {CORE_CHAPTERS.slice(1).map((chapter) => (
            <button
              type="button"
              className={`collection-grid__chapter-button${displayedChapter.chapterId === chapter.chapterId ? " is-active" : ""}`}
              key={chapter.chapterId}
              onClick={() => {
                setOpenBlock(null);
                setSelectedChapterId(chapter.chapterId);
              }}
              aria-pressed={displayedChapter.chapterId === chapter.chapterId}
            >
              {chapter.displayName}
            </button>
          ))}
        </div>
      </nav>
    ),
    [displayedChapter, isFutureChapter],
  );

  const renderCOLLECTIONTwo = React.useCallback(
    () => (
      <COLLECTION2Panel
        renderBlockCardsGrid={renderBlockCardsGrid}
        blockEntries={blockEntries}
        desiredTokenId={desiredTokenId}
        selectedEntry={selectedEntry}
        selectedNftInfo={selectedPublicNft.info}
        selectedNftLoading={selectedPublicNft.loading}
        selectedNftError={selectedPublicNft.error}
        COLLECTIONTotals={COLLECTIONTotals}
        onTokenIdChange={setDesiredTokenId}
        renderChapterSwitcher={renderChapterSwitcher}
      />
    ),
    [
      renderBlockCardsGrid,
      blockEntries,
      desiredTokenId,
      selectedEntry,
      selectedPublicNft,
      COLLECTIONTotals,
      renderChapterSwitcher,
    ],
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
        renderChapterSwitcher={renderChapterSwitcher}
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
      renderChapterSwitcher,
    ],
  );

  const activePanel =
    effectiveActive === "COLLECTION2"
      ? renderCOLLECTIONTwo()
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
            <h2 className="collection-grid__title">
              {activeSectionMeta.title}
            </h2>
            <p className="collection-grid__subtitle">
              {activeSectionMeta.subtitle}
            </p>
            <span className="collection-grid__pill collection-grid__pill--outline">
              Chapter {displayedChapter.chapterId}:{" "}
              {displayedChapter.displayName}
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
                VRF Collection
              </button>
              <button
                type="button"
                className={`collection-grid__tab${effectiveActive === "COLLECTION2" ? " is-active" : ""}`}
                onClick={() => handleSwitchCOLLECTION("COLLECTION2")}
              >
                Public Collection
              </button>
              <button
                type="button"
                className={`collection-grid__tab${effectiveActive === "chapterSeries" ? " is-active" : ""}`}
                onClick={() => handleSwitchCOLLECTION("chapterSeries")}
              >
                Chapters
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
                    const isMinted = modalKey && modalMintedKeys.has(modalKey);
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
