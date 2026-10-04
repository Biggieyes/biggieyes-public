import * as React from "react";
import * as ethers from "ethers";
import {
  BarChart3,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  CirclePause,
  Coins,
  ExternalLink,
  Gift,
  Image as ImageIcon,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Timer,
  Wallet,
} from "lucide-react";
import TokenREWARDSService from "../../services/tokenRewardsService";
import COLLECTIONREWARDSService from "../../services/collectionRewardsService";
import NFTREWARDSService from "../../services/nftRewardsService";
import useTokenREWARDS from "../../hooks/useTokenRewards";
import useCOLLECTIONREWARDS from "../../hooks/useCollectionRewards";
import useNFTREWARDS from "../../hooks/useNFTRewards";
import useTokenRewardsReader from "../../hooks/useTokenRewardsReader";
import useNftRewardsReader from "../../hooks/useNftRewardsReader";
import useREWARDSReader from "../../hooks/useRewardsReader";
import { ADDR, CORE_CHAPTERS } from "@/shared/utils/addresses.js";
import {
  getROProvider,
  getSignerProvider,
  ABI_REWARDS_READER,
} from "@/shared/utils/contract";
import { explorerBaseFor } from "@/config/chains.js";
import {
  formatNativeDisplay,
  formatTokenDisplay,
  isRealAddress,
} from "@/features/tokenomics/utils/amountFormatting.js";
import PanelInfoModal from "@/components/common/PanelInfoModal";
import PanelInfoButton from "@/components/common/PanelInfoButton";
import COLLECTIONREWARDSSection from "./Rewards/CollectionRewards/COLLECTIONREWARDSSection";
import NftREWARDSTab from "./Rewards/NFTRewards/tabs/NftREWARDSTab";
import useWeeklyCountdown from "../../hooks/useWeeklyCountdown";
import FullscreenPanel from "../../components/common/FullscreenPanel";
import REWARDSBlockSummary from "./REWARDSBlockSummary.jsx";
import { buildRewardClaimPayload } from "@/shared/utils/assetIdentity.js";
import "./REWARDSPanel.css";
import "../../styles/biggi-token.skin.css";
import "../../styles/panel-buttons.css";

const TAB_ORDER = [
  { id: "token", label: "BIGGI CLAIMS", icon: Coins },
  { id: "COLLECTION", label: "COLLECTION PRIZES", icon: Layers3 },
  { id: "nft", label: "NFT PRIZES", icon: ImageIcon },
];

const SECTION_META = {
  token: {
    title: "BIGGI HOLDER REWARDS",
    subtitle:
      "Eligible BiggiEyes NFTs earn weighted weekly BIGGI rewards. Review your wallet and claim from one place.",
    accent: "#ffe800",
    accentSoft: "rgba(255, 232, 0, 0.22)",
    accentGlow: "rgba(255, 232, 0, 0.38)",
  },
  COLLECTION: {
    title: "COLLECTION REWARDS",
    subtitle:
      "Check block, orange, and rainbow collection rewards in one view and claim each unlocked collection drop from the same panel.",
    accent: "#5ddcff",
    accentSoft: "rgba(93, 220, 255, 0.22)",
    accentGlow: "rgba(93, 220, 255, 0.38)",
  },
  nft: {
    title: "NFT REWARDS",
    subtitle:
      "Review live NFT reward events, wallet assignments, metadata, and claim status directly from the Polygon contracts.",
    accent: "#b584ff",
    accentSoft: "rgba(181, 132, 255, 0.22)",
    accentGlow: "rgba(181, 132, 255, 0.38)",
  },
};

const DEFAULT_EXPLORER_BASE = "https://polygonscan.com";
const explorerBaseForChain = (chainId) =>
  explorerBaseFor(chainId) || DEFAULT_EXPLORER_BASE;

const DEFAULT_NFT_SUMMARY = {
  events: [],
  rewards: [],
  userRewards: [],
  totalEventsCreated: 0,
  totalRewardsCreated: 0,
  totalClaimed: 0,
  totalAssigned: 0,
  rewardsTruncated: false,
  contractAddress: ADDR.NFT_REWARDS,
};

const formatDecimal = (value, digits = 2) => {
  if (value === null || value === undefined || value === "") return "\u2014";
  try {
    const candidate = (() => {
      try {
        return Number(ethers.formatUnits(value, 18));
      } catch {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      }
    })();
    if (!Number.isFinite(candidate)) {
      return "\u2014";
    }
    return candidate.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch {
    return "\u2014";
  }
};

const formatRewardToken = (
  value,
  digits = 2,
  symbol = "BIGGI",
  decimals = 18,
) => {
  const formatted = formatTokenDisplay(value, decimals, digits, symbol);
  return formatted === "--" ? "\u2014" : formatted;
};

const formatRewardNative = (value, digits = 2) => {
  const formatted = formatNativeDisplay(value, digits);
  return formatted === "--" ? "\u2014" : formatted;
};

const formatInteger = (value) => {
  if (value === null || value === undefined || value === "") return "\u2014";
  if (typeof value === "bigint") return value.toLocaleString();
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) return String(value);
  return Math.round(candidate).toLocaleString();
};

const shortAddress = (value) => {
  if (!isRealAddress(value)) return "\u2014";
  const normalized = String(value);
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
};

const formatUriDisplay = (uri) => {
  if (!uri) return "\u2014";
  const str = String(uri);
  if (str.length <= 46) return str;
  return `${str.slice(0, 40)}...`;
};

const SectionHeader = ({ label, accent = "#ffe800" }) => (
  <div
    className="rewards-grid__section-header"
    style={{ "--section-accent": accent }}
  >
    <span className="rewards-grid__section-title">{label}</span>
    <span className="rewards-grid__section-line" />
  </div>
);

function REWARDSPanel({
  compact = false,
  walletAddress = "",
  provider = null,
  items = [],
  blockNames = [],
  claimable = null,
  onClaim,
  autoOpenInfo = false,
  onActiveSectionChange,
}) {
  const [activeTab, setActiveTab] = React.useState("token");
  const [claimPreview, setClaimPreview] = React.useState(null);
  const [claimPreviewError, setClaimPreviewError] = React.useState(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [claiming, setClaiming] = React.useState(false);
  const [claimMessage, setClaimMessage] = React.useState("");
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [diagramInfoOpen, setDiagramInfoOpen] = React.useState(false);
  const [blockSummaryOpen, setBlockSummaryOpen] = React.useState(false);
  const [explorerBase, setExplorerBase] = React.useState(DEFAULT_EXPLORER_BASE);
  const autoInfoOpened = React.useRef(false);
  const activeSectionMeta = SECTION_META[activeTab] || SECTION_META.token;

  React.useEffect(() => {
    onActiveSectionChange?.(activeSectionMeta);
  }, [activeSectionMeta, onActiveSectionChange]);

  React.useEffect(() => {
    if (autoOpenInfo && !autoInfoOpened.current) {
      setInfoOpen(true);
      autoInfoOpened.current = true;
    }
  }, [autoOpenInfo]);
  const [COLLECTIONClaiming, setCOLLECTIONClaiming] = React.useState({
    block: null,
    orange: null,
    rainbow: false,
  });
  const [COLLECTIONClaimFeedback, setCOLLECTIONClaimFeedback] =
    React.useState(null);
  const collectionClaimLock = React.useRef(false);
  const [nftClaimingId, setNftClaimingId] = React.useState(null);
  const [nftClaimFeedback, setNftClaimFeedback] = React.useState(null);
  const nftClaimLock = React.useRef(false);
  const [collectionBalance, setCollectionBalance] = React.useState(null);
  const [collectionRewardsChapterId, setCollectionRewardsChapterId] =
    React.useState(CORE_CHAPTERS[0]?.chapterId ?? 1);
  const collectionRewardsChapter = React.useMemo(
    () =>
      CORE_CHAPTERS.find(
        (chapter) => chapter.chapterId === collectionRewardsChapterId,
      ) || CORE_CHAPTERS[0],
    [collectionRewardsChapterId],
  );
  const collectionRewardsMain = collectionRewardsChapter?.main || ADDR.MAIN;

  const infoItems = React.useMemo(
    () => [
      {
        label: "BIGGI CLAIMS",
        description: [
          "Shows your current BIGGI holder reward and the NFTs contributing to it.",
          "The claim button stays unavailable until the wallet and Polygon data are ready.",
        ],
      },
      {
        label: "COLLECTION PRIZES",
        description: [
          "Block, orange, and rainbow COLLECTION REWARDS with claim actions.",
          "Updates after redeem/claim.",
        ],
      },
      {
        label: "NFT PRIZES",
        description: [
          "Live NFT reward events, assigned wallets, metadata, and claim status.",
          "Claims mint the assigned ERC-721 reward from NFTRewards.",
        ],
      },
      {
        label: "REFRESH STATS",
        description: [
          "Pulls the latest on-chain values and updates the panels.",
          "Use if you just minted or redeemed.",
        ],
      },
    ],
    [],
  );

  const diagramInfoItems = React.useMemo(
    () => [
      {
        label: "Read layer",
        description:
          "REWARDS readers provide read-only snapshots and feed UI stats without sending transactions.",
      },
      {
        label: "Write layer",
        description:
          "Claim transactions are signed by the wallet and executed against TOKEN, COLLECTION, and NFT reward contracts.",
      },
      {
        label: "Value flow",
        description:
          "BIGGI token and native POL rewards flow from reward pools to the wallet; NFT rewards flow as minted/distributed NFT outputs.",
      },
    ],
    [],
  );

  const {
    readerAddresses,
    loading: readerLoading,
    error: readerError,
  } = useREWARDSReader(walletAddress);
  const collectionRewardsAddr =
    readerAddresses?.collectionRewards || ADDR.COLLECTION_REWARDS;
  const tokenRewardsAddr = readerAddresses?.tokenRewards || ADDR.TOKEN_REWARDS;
  const nftRewardsAddr = readerAddresses?.nftRewards || ADDR.NFT_REWARDS;

  const {
    displayed: weeklyDisplayed,
    loading: weeklyLoading,
    syncWeeklyInfo,
  } = useWeeklyCountdown();

  const readProvider = React.useMemo(() => {
    if (provider) return provider;
    try {
      return getROProvider();
    } catch (err) {
      console.warn("REWARDSPanel: read-only provider unavailable", err);
      return null;
    }
  }, [provider]);

  const refreshCollectionBalance = React.useCallback(async () => {
    if (!readProvider || !collectionRewardsAddr) return;
    try {
      const bn = await readProvider.getBalance(collectionRewardsAddr);
      const num = Number(ethers.formatEther(bn ?? 0n));
      setCollectionBalance(Number.isFinite(num) ? num : null);
    } catch (err) {
      console.warn("REWARDSPanel: failed to read collection balance", err);
      setCollectionBalance(null);
    }
  }, [readProvider, collectionRewardsAddr]);

  const writeProvider = React.useMemo(() => {
    if (provider) return provider;
    if (!walletAddress) return null;
    try {
      return getSignerProvider();
    } catch {
      return null;
    }
  }, [provider, walletAddress]);

  const tokenRewardsReaderAddr = ADDR.TOKEN_REWARDS_READER;
  const nftRewardsReaderAddr = ADDR.NFT_REWARDS_READER;
  const collectionRewardsReaderAddr =
    readerAddresses?.reader ||
    ADDR.COLLECTION_REWARDS_READER ||
    ADDR.BIGGI_REWARDS_READER;

  const {
    data: tokenStatsRaw,
    loading: tokenLoading,
    error: tokenReadError,
    refresh: refreshTokenStats,
  } = useTokenREWARDS(readProvider, tokenRewardsAddr);
  const {
    data: tokenStatsReader,
    loading: tokenReaderLoading,
    error: tokenReaderError,
    refresh: refreshTokenReader,
  } = useTokenRewardsReader(readProvider, tokenRewardsReaderAddr);
  const {
    data: COLLECTIONStats,
    loading: collectionLoading,
    error: collectionError,
    refresh: refreshCOLLECTIONStats,
  } = useCOLLECTIONREWARDS(
    walletAddress,
    readProvider,
    collectionRewardsAddr,
    collectionRewardsMain,
  );
  const {
    data: nftSummary,
    loading: nftLoading,
    error: nftError,
    refresh: refreshNftStats,
    setRewardPage: setNftRewardPage,
    setEventPage: setNftEventPage,
  } = useNFTREWARDS(readProvider, nftRewardsAddr, walletAddress);
  const { data: nftReader, refresh: refreshNftReader } = useNftRewardsReader(
    readProvider,
    nftRewardsReaderAddr,
  );
  const nftConsistencyError = React.useMemo(
    () =>
      nftReader?.contractAddress &&
      nftReader.contractAddress.toLowerCase() !== nftRewardsAddr?.toLowerCase()
        ? new Error("NFT Rewards reader points to a different contract.")
        : null,
    [nftReader?.contractAddress, nftRewardsAddr],
  );

  const tokenStats = tokenStatsReader || tokenStatsRaw;
  const tokenDataLoading = !tokenStats && (tokenLoading || tokenReaderLoading);
  const tokenDataError = tokenStats
    ? null
    : tokenReaderError || tokenReadError;
  const tokenClaimsPaused =
    tokenStatsRaw?.paused === true || tokenStatsReader?.paused === true;
  const rewardClaimPayload = React.useMemo(
    () =>
      buildRewardClaimPayload(items, {
        maxSupply: 550,
        primaryCollectionAddress:
          tokenStats?.mainNFT ||
          tokenStats?.main ||
          ADDR.COLLECTION_VRF ||
          ADDR.MAIN,
        allowedCollectionAddresses: [
          tokenStats?.mainNFT,
          tokenStats?.main2NFT,
          tokenStats?.main,
          tokenStats?.main2,
          ...CORE_CHAPTERS.flatMap((chapter) => [chapter.main, chapter.main2]),
        ],
      }),
    [items, tokenStats],
  );

  React.useEffect(() => {
    let cancelled = false;
    const detectExplorerBase = async () => {
      const prov = provider || readProvider;
      if (!prov?.getNetwork) {
        setExplorerBase(DEFAULT_EXPLORER_BASE);
        return;
      }
      try {
        const net = await prov.getNetwork();
        if (cancelled) return;
        setExplorerBase(explorerBaseForChain(net?.chainId));
      } catch (err) {
        console.warn(
          "REWARDSPanel: network detection failed, using default explorer",
          err,
        );
        if (!cancelled) setExplorerBase(DEFAULT_EXPLORER_BASE);
      }
    };
    detectExplorerBase();
    return () => {
      cancelled = true;
    };
  }, [provider, readProvider]);

  React.useEffect(() => {
    syncWeeklyInfo();
  }, [syncWeeklyInfo]);

  React.useEffect(() => {
    refreshCollectionBalance();
  }, [refreshCollectionBalance]);

  const tokenService = React.useMemo(() => {
    if (!readProvider || !tokenRewardsAddr) return null;
    try {
      return new TokenREWARDSService(tokenRewardsAddr, readProvider);
    } catch (err) {
      console.error("REWARDSPanel: token service init failed", err);
      return null;
    }
  }, [readProvider, tokenRewardsAddr]);
  const COLLECTIONService = React.useMemo(() => {
    if (!readProvider) return null;
    try {
      return new COLLECTIONREWARDSService(
        collectionRewardsAddr,
        readProvider,
        collectionRewardsMain,
      );
    } catch (err) {
      console.error("REWARDSPanel: COLLECTION service init failed", err);
      return null;
    }
  }, [readProvider, collectionRewardsAddr, collectionRewardsMain]);

  const eligibleTokenIds = React.useMemo(() => {
    return rewardClaimPayload.tokenIds;
  }, [rewardClaimPayload]);

  const loadClaimPreview = React.useCallback(
    async (signal = {}) => {
      if (!eligibleTokenIds.length) {
        if (!signal.aborted) {
          setClaimPreview(null);
          setClaimPreviewError(null);
          setPreviewLoading(false);
        }
        return;
      }
      if (!tokenService) {
        if (!signal.aborted) {
          setClaimPreview(null);
          setClaimPreviewError(new Error("Claim preview service unavailable."));
          setPreviewLoading(false);
        }
        return;
      }
      setPreviewLoading(true);
      setClaimPreviewError(null);
      try {
        const useCollectionAware =
          rewardClaimPayload.shouldUseCollectionAware &&
          typeof tokenService?.claimablePreviewFor === "function";
        const [units, amount] = useCollectionAware
          ? await tokenService.claimablePreviewFor(
              rewardClaimPayload.collections,
              eligibleTokenIds,
            )
          : await tokenService.claimablePreview(eligibleTokenIds);
        if (signal.aborted) return;
        const decimals =
          Number(
            tokenStats?.tokenMeta?.decimals_ ?? tokenStats?.tokenDecimals ?? 18,
          ) || 18;
        setClaimPreview({
          units: units?.toString?.() ?? "0",
          amount: amount ? ethers.formatUnits(amount, decimals) : "0",
        });
      } catch (err) {
        console.error("REWARDSPanel claim preview failed", err);
        if (!signal.aborted) {
          setClaimPreview(null);
          setClaimPreviewError(err);
        }
      } finally {
        if (!signal.aborted) setPreviewLoading(false);
      }
    },
    [eligibleTokenIds, rewardClaimPayload, tokenService, tokenStats],
  );

  React.useEffect(() => {
    const signal = { aborted: false };
    loadClaimPreview(signal);
    return () => {
      signal.aborted = true;
    };
  }, [loadClaimPreview]);

  React.useEffect(() => {
    setCOLLECTIONClaimFeedback(null);
    setCOLLECTIONClaiming({ block: null, orange: null, rainbow: false });
  }, [collectionRewardsChapterId, walletAddress]);

  React.useEffect(() => {
    setNftClaimFeedback(null);
    setNftClaimingId(null);
  }, [walletAddress]);

  const canClaimCOLLECTION = React.useMemo(
    () =>
      Boolean(
        walletAddress &&
        !collectionLoading &&
        !collectionError &&
        COLLECTIONStats?.budget?.resolved &&
        COLLECTIONStats?.claimsEnabled === true &&
        writeProvider &&
        typeof writeProvider.getSigner === "function" &&
        COLLECTIONService,
      ),
    [
      walletAddress,
      writeProvider,
      COLLECTIONService,
      collectionLoading,
      collectionError,
      COLLECTIONStats,
    ],
  );

  const canClaimNft = React.useMemo(
    () =>
      Boolean(
        walletAddress &&
        readProvider &&
        nftRewardsAddr &&
        writeProvider &&
        typeof writeProvider.getSigner === "function",
      ),
    [walletAddress, readProvider, nftRewardsAddr, writeProvider],
  );

  const handleRefresh = React.useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        refreshTokenStats(),
        refreshTokenReader(),
        refreshCOLLECTIONStats(),
        refreshNftStats(),
        refreshNftReader(),
        loadClaimPreview(),
        refreshCollectionBalance(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    refreshTokenStats,
    refreshTokenReader,
    refreshCOLLECTIONStats,
    refreshNftStats,
    refreshNftReader,
    loadClaimPreview,
    refreshCollectionBalance,
    refreshing,
  ]);

  const handleClaim = React.useCallback(async () => {
    if (!onClaim) return;
    if (tokenClaimsPaused) {
      setClaimMessage("Weekly BIGGI claims are temporarily paused.");
      return;
    }
    setClaiming(true);
    setClaimMessage("");
    try {
      const result = await onClaim();
      setClaimMessage(
        result?.status === "confirmed"
          ? "Claim confirmed."
          : result?.status === "cancelled"
            ? "Claim cancelled in wallet."
            : result?.status === "failed"
              ? "Claim failed. Check wallet activity before retrying."
              : "No claim transaction was confirmed.",
      );
    } catch (err) {
      console.error("REWARDSPanel claim failed", err);
      setClaimMessage("Claim failed, check console.");
    } finally {
      setClaiming(false);
    }
  }, [onClaim, tokenClaimsPaused]);

  const tokenSymbol =
    tokenStats?.tokenMeta?.symbol_ ??
    tokenStats?.tokenMeta?.symbol ??
    tokenStats?.tokenSymbol ??
    "BIGGI";
  const tokenDecimals =
    Number(
      tokenStats?.tokenMeta?.decimals_ ?? tokenStats?.tokenDecimals ?? 18,
    ) || 18;

  const handleClaimBlockReward = React.useCallback(
    async (blockIdx) => {
      if (collectionClaimLock.current) return;
      if (!canClaimCOLLECTION || !COLLECTIONService) return;
      collectionClaimLock.current = true;
      setCOLLECTIONClaimFeedback(null);
      setCOLLECTIONClaiming((prev) => ({ ...prev, block: blockIdx }));
      try {
        const signer = await writeProvider.getSigner();
        COLLECTIONService.connectWithSigner(signer, walletAddress);
        await COLLECTIONService.claimBlockRewardFor(
          collectionRewardsMain,
          blockIdx,
        );
        setCOLLECTIONClaimFeedback({
          tone: "success",
          text: `Block ${blockIdx} request submitted.`,
        });
        await handleRefresh();
      } catch (err) {
        console.error("REWARDSPanel COLLECTION block claim failed", err);
        setCOLLECTIONClaimFeedback({
          tone: "error",
          text: "Block claim failed. Check the console.",
        });
      } finally {
        collectionClaimLock.current = false;
        setCOLLECTIONClaiming((prev) => ({ ...prev, block: null }));
      }
    },
    [
      canClaimCOLLECTION,
      COLLECTIONService,
      collectionRewardsMain,
      writeProvider,
      walletAddress,
      handleRefresh,
    ],
  );

  const handleClaimOrangeReward = React.useCallback(
    async (mainId) => {
      if (collectionClaimLock.current) return;
      if (!canClaimCOLLECTION || !COLLECTIONService) return;
      collectionClaimLock.current = true;
      setCOLLECTIONClaimFeedback(null);
      setCOLLECTIONClaiming((prev) => ({ ...prev, orange: mainId }));
      try {
        const signer = await writeProvider.getSigner();
        COLLECTIONService.connectWithSigner(signer, walletAddress);
        await COLLECTIONService.claimOrangeRewardFor(
          collectionRewardsMain,
          mainId,
        );
        setCOLLECTIONClaimFeedback({
          tone: "success",
          text: `Orange reward for Main ID ${mainId} submitted.`,
        });
        await handleRefresh();
      } catch (err) {
        console.error("REWARDSPanel COLLECTION orange claim failed", err);
        setCOLLECTIONClaimFeedback({
          tone: "error",
          text: "Orange claim failed. Check the console.",
        });
      } finally {
        collectionClaimLock.current = false;
        setCOLLECTIONClaiming((prev) => ({ ...prev, orange: null }));
      }
    },
    [
      canClaimCOLLECTION,
      COLLECTIONService,
      collectionRewardsMain,
      writeProvider,
      walletAddress,
      handleRefresh,
    ],
  );

  const handleClaimRainbowReward = React.useCallback(async () => {
    if (collectionClaimLock.current) return;
    if (!canClaimCOLLECTION || !COLLECTIONService) return;
    collectionClaimLock.current = true;
    setCOLLECTIONClaimFeedback(null);
    setCOLLECTIONClaiming((prev) => ({ ...prev, rainbow: true }));
    try {
      const signer = await writeProvider.getSigner();
      COLLECTIONService.connectWithSigner(signer, walletAddress);
      await COLLECTIONService.claimRainbowRewardFor(collectionRewardsMain);
      setCOLLECTIONClaimFeedback({
        tone: "success",
        text: "Rainbow reward submitted.",
      });
      await handleRefresh();
    } catch (err) {
      console.error("REWARDSPanel COLLECTION rainbow claim failed", err);
      setCOLLECTIONClaimFeedback({
        tone: "error",
        text: "Rainbow claim failed. Check the console.",
      });
    } finally {
      collectionClaimLock.current = false;
      setCOLLECTIONClaiming((prev) => ({ ...prev, rainbow: false }));
    }
  }, [
    canClaimCOLLECTION,
    COLLECTIONService,
    collectionRewardsMain,
    writeProvider,
    walletAddress,
    handleRefresh,
  ]);

  const handleClaimNftReward = React.useCallback(
    async (rewardId) => {
      if (nftClaimLock.current) return;
      if (nftLoading || nftError || nftConsistencyError) return;
      if (!canClaimNft) {
        setNftClaimFeedback({
          tone: "error",
          text: "Connect the assigned wallet on Polygon before claiming.",
        });
        return;
      }
      const normalizedRewardId = Number(rewardId);
      if (!Number.isSafeInteger(normalizedRewardId) || normalizedRewardId < 1) {
        setNftClaimFeedback({ tone: "error", text: "Invalid reward ID." });
        return;
      }

      setNftClaimFeedback(null);
      nftClaimLock.current = true;
      setNftClaimingId(normalizedRewardId);
      try {
        const service = new NFTREWARDSService(nftRewardsAddr, readProvider);
        const signer = await writeProvider.getSigner();
        await service.claimForWallet(normalizedRewardId, signer, walletAddress);
        setNftClaimFeedback({
          tone: "success",
          text: `NFT reward #${normalizedRewardId} claimed successfully.`,
        });
        await Promise.all([refreshNftStats(), refreshNftReader()]);
      } catch (error) {
        console.error("REWARDSPanel NFT reward claim failed", error);
        setNftClaimFeedback({
          tone: "error",
          text:
            error?.shortMessage ||
            error?.reason ||
            error?.message ||
            "NFT reward claim failed.",
        });
      } finally {
        nftClaimLock.current = false;
        setNftClaimingId(null);
      }
    },
    [
      canClaimNft,
      nftLoading,
      nftError,
      nftConsistencyError,
      nftRewardsAddr,
      readProvider,
      refreshNftReader,
      refreshNftStats,
      walletAddress,
      writeProvider,
    ],
  );

  const heroCards = React.useMemo(() => {
    const symbol = tokenSymbol;

    const formatTokenValue = (raw, digits = 2) => {
      return formatRewardToken(raw, digits, symbol, tokenDecimals);
    };

    return [
      {
        label: "Reward per unit",
        value: tokenStats
          ? formatTokenValue(tokenStats.unitReward, 4)
          : "\u2014",
        hint: "Applied to your NFT weights",
        tone: "token",
      },
      {
        label: "Distributed this week",
        value: tokenStats
          ? formatTokenValue(tokenStats.distributedThisWeek, 2)
          : "\u2014",
        hint: `Week ${tokenStats?.currentWeek ?? "\u2014"}`,
        tone: "token",
      },
      {
        label: "Rewards remaining",
        value: tokenStats
          ? formatTokenValue(tokenStats.remainingCap, 2)
          : "\u2014",
        hint: "Available under the reward cap",
        tone: "token",
      },
      {
        label: "Distributed total",
        value: tokenStats
          ? formatTokenValue(tokenStats.totalDistributed, 2)
          : "\u2014",
        hint: "Confirmed since launch",
        tone: "token",
      },
    ];
  }, [tokenDecimals, tokenSymbol, tokenStats]);

  const tokenStatusGrid = React.useMemo(() => {
    const weightsRaw = tokenStats?.blockWeights;
    if (!weightsRaw || !weightsRaw.length) return [];
    const weights = weightsRaw.length === 11 ? weightsRaw.slice(1) : weightsRaw;
    const toNumber = (value) => {
      if (value == null) return null;
      if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
      if (typeof value === "bigint") return Number(value);
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      try {
        const asString =
          typeof value?.toString === "function"
            ? value.toString()
            : String(value);
        const parsed = Number(asString);
        return Number.isFinite(parsed) ? parsed : null;
      } catch {
        return null;
      }
    };
    const parsed = weights.map(toNumber);
    const max = parsed.reduce(
      (acc, val) => (Number.isFinite(val) && val > acc ? val : acc),
      0,
    );
    const scale = max > 0 && max <= 10 ? 10 : 1;
    return parsed.map((weight, idx) => ({
      id: idx + 1,
      label: blockNames[idx] || `Block ${idx + 1}`,
      value: Number.isFinite(weight) ? weight * scale : "-",
    }));
  }, [blockNames, tokenStats]);

  const claimAmountLabel = !walletAddress
    ? "\u2014"
    : claimable != null
      ? formatRewardToken(claimable, 4, tokenSymbol, tokenDecimals)
      : claimPreview?.amount != null
        ? formatRewardToken(
            claimPreview.amount,
            4,
            tokenSymbol,
            tokenDecimals,
          )
        : previewLoading
          ? "Syncing..."
          : "\u2014";

  const claimAmountConfirmedZero = React.useMemo(() => {
    const value = claimable ?? claimPreview?.amount;
    if (value == null || value === "") return false;
    if (typeof value === "bigint") return value === 0n;
    const parsed = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(parsed) && parsed === 0;
  }, [claimPreview?.amount, claimable]);

  const COLLECTIONStatus = React.useMemo(() => {
    if (!COLLECTIONStats) return [];
    const rainbowClaimed = Boolean(
      COLLECTIONStats.rainbowClaimed ??
      COLLECTIONStats.rainbowRewardClaimedGlobal,
    );
    return [
      {
        label: "Block winners",
        value: formatInteger(COLLECTIONStats.blockWinnersCount),
        tone: "is-available",
      },
      {
        label: "Orange winners",
        value: formatInteger(COLLECTIONStats.orangeWinnersCount),
        tone: "is-available",
      },
      {
        label: "Rainbow claimed",
        value: rainbowClaimed ? "Completed" : "Pending",
        tone: rainbowClaimed ? "is-claimed" : "is-locked",
      },
    ];
  }, [COLLECTIONStats]);

  const nftData = React.useMemo(
    () => ({
      ...DEFAULT_NFT_SUMMARY,
      ...(nftSummary || {}),
      contractAddress:
        nftSummary?.contractAddress || DEFAULT_NFT_SUMMARY.contractAddress,
      readerAddress: nftRewardsReaderAddr,
    }),
    [nftSummary, nftRewardsReaderAddr],
  );

  const blockPaid = COLLECTIONStats?.blockPaid ?? [];
  const blockClaimability = COLLECTIONStats?.blockClaimability ?? [];
  const orangeMainIdPaid = COLLECTIONStats?.orangeMainIdPaid ?? [];
  const orangeClaimability = COLLECTIONStats?.orangeClaimability ?? [];
  const rainbowClaimed = Boolean(
    COLLECTIONStats?.rainbowClaimed ??
    COLLECTIONStats?.rainbowRewardClaimedGlobal,
  );
  const rainbowClaimability = COLLECTIONStats?.rainbowClaimability ?? {
    ok: null,
    reason: null,
    resolved: false,
  };
  const metadataRows = [
    { label: "Distributor", value: COLLECTIONStats?.distributor },
    { label: "VRF collection", value: COLLECTIONStats?.collection },
    { label: "Owner", value: COLLECTIONStats?.owner },
  ];

  const rewardsSource = React.useMemo(() => {
    const hasRewardsReader = Boolean(
      isRealAddress(readerAddresses?.reader) && ABI_REWARDS_READER?.length,
    );
    const hasTokenReader = isRealAddress(tokenRewardsReaderAddr);
    const hasNftReader = isRealAddress(nftRewardsReaderAddr);
    const hasReader = hasRewardsReader || hasTokenReader || hasNftReader;
    const activeLoading =
      activeTab === "token"
        ? tokenDataLoading
        : activeTab === "COLLECTION"
          ? collectionLoading
          : nftLoading;
    const activeError =
      activeTab === "token"
        ? tokenDataError
        : activeTab === "COLLECTION"
          ? collectionError
          : nftError || nftConsistencyError;
    if (readerLoading || activeLoading) {
      return { label: "Source: loading", tone: "dim" };
    }
    if (activeError) {
      return { label: "Source: unavailable", tone: "warn" };
    }
    if (readerError) return { label: "Source: fallback", tone: "warn" };
    return hasReader
      ? { label: "Source: reader", tone: "ok" }
      : { label: "Source: direct", tone: "warn" };
  }, [
    readerAddresses?.reader,
    activeTab,
    collectionError,
    collectionLoading,
    nftConsistencyError,
    nftError,
    nftLoading,
    readerLoading,
    readerError,
    tokenDataError,
    tokenDataLoading,
    tokenRewardsReaderAddr,
    nftRewardsReaderAddr,
  ]);

  const rewardsMainnetRows = React.useMemo(
    () => [
      {
        label: "Network",
        value: `Polygon mainnet / chainId ${ADDR.CHAIN_ID || 137}`,
        tone: "ok",
      },
      {
        label: "Data source",
        value: rewardsSource.label.replace("Source: ", ""),
        tone: rewardsSource.tone,
      },
    ],
    [rewardsSource.label, rewardsSource.tone],
  );

  const padTime = (value) => String(value).padStart(2, "0");

  const countdownText = React.useMemo(() => {
    const remaining = Math.max(0, weeklyDisplayed.remainingSeconds ?? 0);
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = Math.floor(remaining % 60);
    const parts = [days, hours, minutes, seconds].map(padTime);
    return `${parts[0]} : ${parts[1]} : ${parts[2]} : ${parts[3]}`;
  }, [weeklyDisplayed.remainingSeconds]);

  const claimAvailability = React.useMemo(() => {
    if (!walletAddress) {
      return {
        label: "Wallet required",
        tone: "wallet",
        detail: "Connect the wallet that holds your eligible NFTs.",
      };
    }
    if (tokenDataLoading || tokenLoading || previewLoading) {
      return {
        label: "Syncing rewards",
        tone: "syncing",
        detail: "Reading your NFT weights and current reward from Polygon.",
      };
    }
    if (tokenDataError || tokenReadError || claimPreviewError) {
      return {
        label: "Data unavailable",
        tone: "error",
        detail: "Reward data could not be confirmed. Refresh before claiming.",
      };
    }
    if (tokenClaimsPaused) {
      return {
        label: "Claims paused",
        tone: "paused",
        detail:
          "Your eligible NFTs remain tracked while weekly BIGGI claims are paused.",
      };
    }
    if (!eligibleTokenIds.length) {
      return {
        label: "No eligible NFTs",
        tone: "empty",
        detail: "No eligible BiggiEyes NFT is available in this wallet.",
      };
    }
    if (claimAmountConfirmedZero) {
      return {
        label: "Nothing to claim",
        tone: "empty",
        detail:
          "Your eligible NFTs are tracked, but this wallet has no BIGGI available in the current cycle.",
      };
    }
    return {
      label: "Ready to claim",
      tone: "ready",
      detail: "Your wallet and reward data are ready for a Polygon claim.",
    };
  }, [
    eligibleTokenIds.length,
    claimAmountConfirmedZero,
    claimPreviewError,
    previewLoading,
    tokenClaimsPaused,
    tokenDataError,
    tokenDataLoading,
    tokenLoading,
    tokenReadError,
    walletAddress,
  ]);

  const claimButtonLabel = (() => {
    if (tokenClaimsPaused) return "Weekly claims paused";
    if (claiming) return "Claiming BIGGI...";
    if (!walletAddress) return "Connect wallet first";
    if (tokenDataLoading || tokenLoading || previewLoading) {
      return "Checking rewards";
    }
    if (tokenDataError || tokenReadError || claimPreviewError) {
      return "Claim unavailable";
    }
    if (!eligibleTokenIds.length) return "No eligible NFTs";
    if (claimAmountConfirmedZero) return "Nothing to claim";
    return "Claim BIGGI rewards";
  })();

  const claimStatusIcons = {
    empty: CircleMinus,
    error: CircleAlert,
    paused: CirclePause,
    ready: CircleCheck,
    syncing: RefreshCw,
    wallet: Wallet,
  };
  const ClaimStatusIcon = claimStatusIcons[claimAvailability.tone] || Wallet;

  const heroSection = (
    <div
      className="biggi-hero rewards-panel__hero"
      aria-label="Token reward highlights"
    >
      {heroCards.map((card) => (
        <article
          className={`biggi-hero__stat tone-${card.tone || "token"}`}
          key={card.label}
        >
          <div className="biggi-hero__value">{card.value}</div>
          <div className="biggi-hero__label">{card.label}</div>
          {card.hint && <div className="biggi-hero__sub">{card.hint}</div>}
        </article>
      ))}
    </div>
  );

  const tokenTab = (
    <section
      id="rewards-tabpanel-token"
      role="tabpanel"
      aria-labelledby="rewards-tab-token"
      className="rewards-panel__section rewards-panel__section--token"
    >
      <section
        className={`rewards-holder__claim-center is-${claimAvailability.tone}`}
        aria-labelledby="holder-reward-title"
      >
        <div className="rewards-holder__claim-main">
          <div className="rewards-holder__eyebrow">
            <Gift size={17} aria-hidden />
            <span>Your weekly holder reward</span>
          </div>
          <div className="rewards-holder__claim-heading">
            <div>
              <span className="rewards-holder__amount-label" id="holder-reward-title">
                Available to claim
              </span>
              <strong className="rewards-holder__amount" aria-live="polite">
                {claimAmountLabel}
              </strong>
            </div>
            <span
              className={`rewards-holder__claim-status is-${claimAvailability.tone}`}
            >
              <ClaimStatusIcon
                size={16}
                aria-hidden
                className={
                  claimAvailability.tone === "syncing" ? "is-spinning" : ""
                }
              />
              {claimAvailability.label}
            </span>
          </div>
          <p className="rewards-holder__claim-detail">
            {claimAvailability.detail}
          </p>
          <div className="rewards-holder__actions">
            <button
              type="button"
              className="biggi-btn biggi-btn--accent rewards-holder__claim-button"
              disabled={
                !walletAddress ||
                !onClaim ||
                !eligibleTokenIds.length ||
                claimAmountConfirmedZero ||
                tokenClaimsPaused ||
                claiming ||
                tokenDataLoading ||
                tokenLoading ||
                Boolean(tokenDataError || tokenReadError || claimPreviewError)
              }
              onClick={handleClaim}
            >
              <Gift size={18} aria-hidden />
              {claimButtonLabel}
            </button>
            <button
              type="button"
              className="biggi-btn biggi-btn--ghost rewards-holder__refresh-button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh reward data"
            >
              <RefreshCw
                size={17}
                aria-hidden
                className={refreshing ? "is-spinning" : ""}
              />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
          {walletAddress &&
            (tokenDataError || tokenReadError || claimPreviewError) && (
            <div
              role="alert"
              className="rewards-grid__alert rewards-panel__alert"
            >
              Token rewards are unavailable. Refresh before claiming.
            </div>
          )}
          {claimMessage && (
            <div className="rewards-grid__alert rewards-panel__alert" role="status">
              {claimMessage}
            </div>
          )}
        </div>

        <dl className="rewards-holder__facts" aria-label="Your reward details">
          <div className="rewards-holder__fact">
            <dt>
              <Wallet size={16} aria-hidden /> Wallet
            </dt>
            <dd title={walletAddress || undefined}>
              {walletAddress ? shortAddress(walletAddress) : "Not connected"}
            </dd>
          </div>
          <div className="rewards-holder__fact">
            <dt>
              <ImageIcon size={16} aria-hidden /> Eligible NFTs
            </dt>
            <dd>
              {walletAddress ? formatInteger(eligibleTokenIds.length) : "\u2014"}
            </dd>
          </div>
          <div className="rewards-holder__fact">
            <dt>
              <BarChart3 size={16} aria-hidden /> Reward units
            </dt>
            <dd>
              {previewLoading
                ? "Syncing"
                : claimPreview?.units != null
                  ? formatInteger(claimPreview.units)
                  : "\u2014"}
            </dd>
          </div>
          <div className="rewards-holder__fact rewards-holder__fact--timer">
            <dt>
              <Timer size={16} aria-hidden /> Next reward cycle
            </dt>
            <dd>
              {tokenDataLoading || weeklyLoading
                ? "Syncing"
                : tokenDataError
                  ? "Unavailable"
                  : countdownText}
            </dd>
          </div>
        </dl>
      </section>

      <SectionHeader label="Reward activity" accent={SECTION_META.token.accent} />
      {heroSection}

      <SectionHeader label="NFT reward weights" accent="#5ddcff" />
      <section className="rewards-holder__weights" aria-labelledby="reward-weights-title">
        <div className="rewards-holder__weights-head">
          <div className="rewards-holder__weights-title">
            <BarChart3 size={20} aria-hidden />
            <div>
              <h3 id="reward-weights-title">Eye-color weights</h3>
              <p>Each eligible NFT contributes its eye-color weight every week.</p>
            </div>
          </div>
          <button
            type="button"
            className="biggi-btn biggi-btn--ghost"
            onClick={() => setBlockSummaryOpen(true)}
          >
            <BarChart3 size={17} aria-hidden />
            My NFT breakdown
          </button>
        </div>
        <div className="rewards-panel__status-grid rewards-holder__weight-grid">
          {tokenStatusGrid.length ? (
            tokenStatusGrid.map((status) => (
              <div key={status.id} className="rewards-panel__status">
                <span className="label">{status.label}</span>
                <span className="value">
                  {status.value === "-" ? "\u2014" : `${status.value}x`}
                </span>
              </div>
            ))
          ) : (
            <div className="rewards-panel__status">
              <span className="label">Weights</span>
              <span className="value">Syncing</span>
            </div>
          )}
        </div>
      </section>

      <details className="rewards-holder__technical">
        <summary>
          <span className="rewards-holder__technical-title">
            <ShieldCheck size={18} aria-hidden />
            Network and contract details
          </span>
          <ChevronRight className="rewards-holder__technical-chevron" size={18} aria-hidden />
        </summary>
        <div className="rewards-holder__technical-body">
          <section
            className="rewards-panel__mainnet-rail"
            aria-label="Rewards mainnet data"
          >
            {rewardsMainnetRows.map((row) => (
              <div
                className={`rewards-panel__mainnet-item rewards-panel__mainnet-item--${row.tone || "dim"}`}
                key={row.label}
              >
                <span className="rewards-panel__mainnet-label">{row.label}</span>
                <span className="rewards-panel__mainnet-value">{row.value}</span>
              </div>
            ))}
          </section>
          <div className="rewards-panel__address-grid">
            {[
              { label: "Token rewards", addr: tokenRewardsAddr },
              { label: "Token reader", addr: tokenRewardsReaderAddr },
              { label: "Collection rewards", addr: collectionRewardsAddr },
              { label: "Collection reader", addr: collectionRewardsReaderAddr },
              { label: "NFT rewards", addr: nftRewardsAddr },
              { label: "NFT reader", addr: nftRewardsReaderAddr },
              { label: "Core reader", addr: ADDR.MAIN_READER || ADDR.READER },
              { label: "Multicall", addr: ADDR.MULTICALL2 || ADDR.MULTICALL },
            ].map((row) => {
              const liveAddress = isRealAddress(row.addr);
              return (
                <div className="rewards-panel__address-row" key={row.label}>
                  <div>
                    <div className="label">{row.label}</div>
                    <div className="value">{shortAddress(row.addr)}</div>
                  </div>
                  {liveAddress ? (
                    <a
                      className="biggi-btn biggi-btn--ghost rewards-panel__address-btn"
                      href={`${explorerBase}/address/${row.addr}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={14} aria-hidden />
                      Explorer
                    </a>
                  ) : (
                    <span className="rewards-holder__not-configured">Unavailable</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </details>
    </section>
  );

  const COLLECTIONTab = (
    <section
      id="rewards-tabpanel-COLLECTION"
      role="tabpanel"
      aria-labelledby="rewards-tab-COLLECTION"
      className="rewards-panel__section"
    >
      <SectionHeader
        label="COLLECTION REWARDS"
        accent={SECTION_META.COLLECTION.accent}
      />
      <COLLECTIONREWARDSSection
        chapters={CORE_CHAPTERS}
        selectedChapterId={collectionRewardsChapterId}
        onChapterChange={setCollectionRewardsChapterId}
        rewardArtworkReady={collectionRewardsChapterId === 1}
        stats={COLLECTIONStats}
        loading={collectionLoading}
        error={collectionError}
        statusRows={COLLECTIONStatus}
        formatDecimal={formatDecimal}
        formatNativeAmount={formatRewardNative}
        collectionBalance={collectionBalance}
        blockPaid={blockPaid}
        blockClaimability={blockClaimability}
        orangeMainIdPaid={orangeMainIdPaid}
        orangeClaimability={orangeClaimability}
        rainbowClaimed={rainbowClaimed}
        rainbowClaimability={rainbowClaimability}
        canClaimCOLLECTION={canClaimCOLLECTION}
        walletAddress={walletAddress}
        claimState={COLLECTIONClaiming}
        onClaimBlockReward={handleClaimBlockReward}
        onClaimOrangeReward={handleClaimOrangeReward}
        onClaimRainbowReward={handleClaimRainbowReward}
        metadataRows={metadataRows}
        formatAddress={shortAddress}
        feedback={COLLECTIONClaimFeedback}
      />
    </section>
  );

  const nftTab = (
    <section
      id="rewards-tabpanel-nft"
      role="tabpanel"
      aria-labelledby="rewards-tab-nft"
      className="rewards-panel__section rewards-grid__section--nft"
    >
      <SectionHeader label="NFT REWARDS" accent={SECTION_META.nft.accent} />
      <NftREWARDSTab
        data={nftData}
        loading={nftLoading}
        error={nftError || nftConsistencyError}
        walletAddress={walletAddress}
        formatInteger={formatInteger}
        formatAddress={shortAddress}
        formatUriDisplay={formatUriDisplay}
        onOpenExplorer={(addr) => {
          const url = addr ? `${explorerBase}/address/${addr}` : null;
          if (!url || typeof window === "undefined") return;
          window.open(url, "_blank", "noopener,noreferrer");
        }}
        canClaim={canClaimNft}
        claimState={nftClaimingId}
        onClaimReward={handleClaimNftReward}
        feedback={nftClaimFeedback}
        onRewardPageChange={setNftRewardPage}
        onEventPageChange={setNftEventPage}
      />
    </section>
  );

  const renderTab = () => {
    if (activeTab === "COLLECTION") return COLLECTIONTab;
    if (activeTab === "nft") return nftTab;
    return tokenTab;
  };

  return (
    <section
      className={`rewards-grid biggi-skin${compact ? " is-compact" : ""}`}
      style={{
        "--rewards-active-accent": activeSectionMeta.accent,
        "--rewards-active-accent-soft": activeSectionMeta.accentSoft,
        "--rewards-active-accent-glow": activeSectionMeta.accentGlow,
      }}
    >
      <FullscreenPanel
        open={blockSummaryOpen}
        title="Block summary"
        onClose={() => setBlockSummaryOpen(false)}
        preventScroll
        containerStyle={{
          width: "min(1200px, 96vw)",
          maxHeight: "100%",
          background: "transparent",
          border: "none",
          boxShadow: "none",
          padding: 0,
        }}
        contentStyle={{
          padding: compact ? "12px" : "16px",
        }}
      >
        <REWARDSBlockSummary items={items} blockNames={blockNames} />
      </FullscreenPanel>
      <div className="rewards-grid__surface biggi-token-surface">
        <header className="rewards-grid__header biggi-header panel-header panel-header--rewards">
          <div className="rewards-grid__headline">
            <h2 className="rewards-grid__title">{activeSectionMeta.title}</h2>
            <p className="rewards-grid__subtitle">
              {activeSectionMeta.subtitle}
            </p>
          </div>
          <div className="rewards-panel__header-meta">
            <span
              className={`rewards-grid__pill rewards-panel__source-pill rewards-panel__source-pill--${rewardsSource.tone}`}
            >
              {rewardsSource.label}
            </span>
            <span className="rewards-grid__pill rewards-panel__source-pill">
              {tokenClaimsPaused
                ? "BIGGI claims: PAUSED"
                : tokenDataLoading || weeklyLoading
                  ? "Reward cycle: syncing"
                  : tokenStats?.currentWeek != null
                    ? `Reward cycle: week ${tokenStats.currentWeek}`
                    : "Reward cycle: unavailable"}
            </span>
          </div>
        </header>
        <PanelInfoModal
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          title="Rewards Panel"
          items={infoItems}
        />
        <PanelInfoModal
          open={diagramInfoOpen}
          onClose={() => setDiagramInfoOpen(false)}
          title="Rewards diagram info"
          items={diagramInfoItems}
        />
        <nav className="view-tabs rewards-panel__tabs" aria-label="Reward sections">
          <div className="rewards-panel__tab-list" role="tablist">
            {TAB_ORDER.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  id={`rewards-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`rewards-tabpanel-${tab.id}`}
                  className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <TabIcon size={16} aria-hidden />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="rewards-panel__tab-tools">
            <button
              type="button"
              className="rewards-panel__tool-button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh all reward data"
              aria-label={refreshing ? "Refreshing reward data" : "Refresh reward data"}
            >
              <RefreshCw
                size={17}
                aria-hidden
                className={refreshing ? "is-spinning" : ""}
              />
            </button>
            <PanelInfoButton
              onClick={() => setInfoOpen(true)}
              ariaLabel="Rewards panel information"
            />
          </div>
        </nav>
        {renderTab()}
        <details className="rewards-holder__explainer">
          <summary>
            <span>
              <ShieldCheck size={18} aria-hidden />
              How rewards move on-chain
            </span>
            <ChevronRight className="rewards-holder__technical-chevron" size={18} aria-hidden />
          </summary>
          <section className="rewards-grid__diagram-wrap">
            <PanelInfoButton
              className="rewards-grid__diagram-info-btn"
              onClick={() => setDiagramInfoOpen(true)}
              ariaLabel="Open rewards diagram info"
              title="Rewards diagram info"
            />
            <img
              className="rewards-grid__diagram-image"
              src="/images/schemas/rewards-flow-diagram.png?v=20260828"
              alt="Rewards diagram showing reward contracts, readers, and native or token flows to wallet claims."
              loading="lazy"
              decoding="async"
            />
          </section>
        </details>
      </div>
    </section>
  );
}

export default REWARDSPanel;
