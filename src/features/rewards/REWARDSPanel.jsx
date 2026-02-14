import * as React from "react";
import * as ethers from "ethers";
import TokenREWARDSService from "../../services/tokenRewardsService";
import COLLECTIONREWARDSService from "../../services/collectionRewardsService";
import useTokenREWARDS from "../../hooks/useTokenRewards";
import useCOLLECTIONREWARDS from "../../hooks/useCollectionRewards";
import useNFTREWARDS from "../../hooks/useNFTRewards";
import useTokenRewardsReader from "../../hooks/useTokenRewardsReader";
import useNftRewardsReader from "../../hooks/useNftRewardsReader";
import useREWARDSReader from "../../hooks/useRewardsReader";
import { ADDR } from "../../utils/addresses";
import { getROProvider, getSignerProvider, ABI_REWARDS_READER } from "@/shared/utils/contract";
import { explorerBaseFor } from "@/config/chains.js";
import PanelInfoModal from "@/components/common/PanelInfoModal";
import COLLECTIONREWARDSSection from "./Rewards/CollectionRewards/COLLECTIONREWARDSSection";
import NftREWARDSTab from "./Rewards/NFTRewards/tabs/NftREWARDSTab";
import useWeeklyCountdown from "../../hooks/useWeeklyCountdown";
import FullscreenPanel from "../../components/common/FullscreenPanel";
import REWARDSBlockSummary from "./REWARDSBlockSummary.jsx";
import "./REWARDSPanel.css";
import "../../styles/biggi-token.skin.css";

const TAB_ORDER = [
  { id: "token", label: "Token REWARDS" },
  { id: "COLLECTION", label: "COLLECTION REWARDS" },
  { id: "nft", label: "NFT REWARDS" },
];

const NFT_RANGE = Array.from({ length: 10 }, (_, idx) => idx + 1);
const DEFAULT_EXPLORER_BASE = "https://amoy.polygonscan.com";
const explorerBaseForChain = (chainId) =>
  explorerBaseFor(chainId) || DEFAULT_EXPLORER_BASE;

const DEFAULT_NFT_SUMMARY = {
  baseURIs: { character: null, leaderboard: null, mystery: null },
  characterClaimed: {},
  leaderboardClaimed: {},
  mysteryClaimed: {},
  totalMinted: 0,
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
  } catch (err) {
    return "\u2014";
  }
};

const formatInteger = (value) => {
  if (value === null || value === undefined || value === "") return "\u2014";
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) return String(value);
  return Math.round(candidate).toLocaleString();
};

const shortAddress = (value) => {
  if (!value) return "\u2014";
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
  rewardPool = null,
  onClaim,
}) {
  const [activeTab, setActiveTab] = React.useState("token");
  const [claimPreview, setClaimPreview] = React.useState(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [claiming, setClaiming] = React.useState(false);
  const [claimMessage, setClaimMessage] = React.useState("");
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [blockSummaryOpen, setBlockSummaryOpen] = React.useState(false);
  const [explorerBase, setExplorerBase] = React.useState(DEFAULT_EXPLORER_BASE);
  const [COLLECTIONClaiming, setCOLLECTIONClaiming] = React.useState({
    block: null,
    orange: null,
    rainbow: false,
  });
  const [COLLECTIONClaimFeedback, setCOLLECTIONClaimFeedback] =
    React.useState(null);
  const [collectionBalance, setCollectionBalance] = React.useState(null);

  const infoItems = React.useMemo(
    () => [
      {
        label: "TOKEN",
        description: [
          "Token REWARDS pools, your claim preview, and weekly block weights.",
          "Reads from TokenRewards + Reader contracts.",
        ],
      },
      {
        label: "COLLECTION",
        description: [
          "Block, orange, and rainbow COLLECTION REWARDS with claim actions.",
          "Updates after redeem/claim.",
        ],
      },
      {
        label: "NFT",
        description: [
          "NFT reward ranks, eligibility, and claim status.",
          "Uses NFTRewards + Reader helpers for snapshot data.",
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
    error: weeklyError,
    isClaiming: weeklyIsClaiming,
    claimSuccess: weeklyClaimSuccess,
    syncWeeklyInfo,
    handleClaim: weeklyHandleClaim,
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

  const { data: tokenStatsRaw, refresh: refreshTokenStats } =
    useTokenREWARDS(readProvider, tokenRewardsAddr);
  const { data: tokenStatsReader, refresh: refreshTokenReader } =
    useTokenRewardsReader(readProvider, tokenRewardsReaderAddr);
  const { data: COLLECTIONStats, refresh: refreshCOLLECTIONStats } =
    useCOLLECTIONREWARDS(walletAddress, readProvider, collectionRewardsAddr);
  const { data: nftSummary, refresh: refreshNftStats } =
    useNFTREWARDS(readProvider, nftRewardsAddr);
  const { data: nftReader, refresh: refreshNftReader } =
    useNftRewardsReader(readProvider, nftRewardsReaderAddr);

  const tokenStats = tokenStatsReader || tokenStatsRaw;

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
      );
    } catch (err) {
      console.error("REWARDSPanel: COLLECTION service init failed", err);
      return null;
    }
  }, [readProvider, collectionRewardsAddr]);

  const eligibleTokenIds = React.useMemo(() => {
    return (items || [])
      .filter((token) => token && token.tokenId && !token.isTicket)
      .map((token) => {
        try {
          return BigInt(String(token.tokenId));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }, [items]);

  const loadClaimPreview = React.useCallback(
    async (signal = {}) => {
      if (!tokenService) {
        setClaimPreview(null);
        setPreviewLoading(false);
        return;
      }
      if (!eligibleTokenIds.length) {
        if (!signal.aborted) {
          setClaimPreview(null);
          setPreviewLoading(false);
        }
        return;
      }
      setPreviewLoading(true);
      try {
        const [units, amount] =
          await tokenService.claimablePreview(eligibleTokenIds);
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
        if (!signal.aborted) setClaimPreview(null);
      } finally {
        if (!signal.aborted) setPreviewLoading(false);
      }
    },
    [eligibleTokenIds, tokenService, tokenStats],
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
  }, [walletAddress]);

  const canClaimCOLLECTION = React.useMemo(
    () =>
      Boolean(
        walletAddress &&
          writeProvider &&
          typeof writeProvider.getSigner === "function" &&
          COLLECTIONService,
      ),
    [walletAddress, writeProvider, COLLECTIONService],
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
    refreshing,
  ]);

  const handleClaim = React.useCallback(async () => {
    if (!onClaim) return;
    setClaiming(true);
    setClaimMessage("");
    try {
      await onClaim();
      setClaimMessage("Claim submitted. Watch your wallet for confirmation.");
    } catch (err) {
      console.error("REWARDSPanel claim failed", err);
      setClaimMessage("Claim failed, check console.");
    } finally {
      setClaiming(false);
    }
  }, [onClaim]);

  const tokenSymbol =
    tokenStats?.tokenMeta?.symbol_ ??
    tokenStats?.tokenMeta?.symbol ??
    tokenStats?.tokenSymbol ??
    "BIGGI";

  const handleClaimBlockReward = React.useCallback(
    async (blockIdx) => {
      if (!canClaimCOLLECTION || !COLLECTIONService) return;
      setCOLLECTIONClaimFeedback(null);
      setCOLLECTIONClaiming((prev) => ({ ...prev, block: blockIdx }));
      try {
        const signer = await writeProvider.getSigner();
        COLLECTIONService.connectWithSigner(signer);
        await COLLECTIONService.claimBlockReward(blockIdx);
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
        setCOLLECTIONClaiming((prev) => ({ ...prev, block: null }));
      }
    },
    [canClaimCOLLECTION, COLLECTIONService, writeProvider, handleRefresh],
  );

  const handleClaimOrangeReward = React.useCallback(
    async (mainId) => {
      if (!canClaimCOLLECTION || !COLLECTIONService) return;
      setCOLLECTIONClaimFeedback(null);
      setCOLLECTIONClaiming((prev) => ({ ...prev, orange: mainId }));
      try {
        const signer = await writeProvider.getSigner();
        COLLECTIONService.connectWithSigner(signer);
        await COLLECTIONService.claimOrangeReward(mainId);
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
        setCOLLECTIONClaiming((prev) => ({ ...prev, orange: null }));
      }
    },
    [canClaimCOLLECTION, COLLECTIONService, writeProvider, handleRefresh],
  );

  const handleClaimRainbowReward = React.useCallback(async () => {
    if (!canClaimCOLLECTION || !COLLECTIONService) return;
    setCOLLECTIONClaimFeedback(null);
    setCOLLECTIONClaiming((prev) => ({ ...prev, rainbow: true }));
    try {
      const signer = await writeProvider.getSigner();
      COLLECTIONService.connectWithSigner(signer);
      await COLLECTIONService.claimRainbowReward();
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
      setCOLLECTIONClaiming((prev) => ({ ...prev, rainbow: false }));
    }
  }, [canClaimCOLLECTION, COLLECTIONService, writeProvider, handleRefresh]);

  const heroCards = React.useMemo(() => {
    const symbol = tokenSymbol;
    const previewAmount = claimPreview?.amount;
    const previewUnits = claimPreview?.units;

    const formatTokenValue = (raw, digits = 2) => {
      if (raw === null || raw === undefined || raw === "") return "\u2014";
      return formatDecimal(raw, digits);
    };

    return [
      {
        label: "Token pool",
        value: tokenStats
          ? `${formatTokenValue(tokenStats.REWARDSCap, 0)} ${symbol}`
          : "--",
        hint: "Treasury cap",
        tone: "token",
      },
      {
        label: "Unit reward",
        value: tokenStats
          ? `${formatTokenValue(tokenStats.unitReward, 4)} ${symbol}`
          : "\u2014",
        hint: "Per block weight",
        tone: "token",
      },
      {
        label: "Distributed total",
        value: tokenStats
          ? `${formatTokenValue(tokenStats.totalDistributed, 2)} ${symbol}`
          : "\u2014",
        hint: "Since launch",
        tone: "token",
      },
      {
        label: "This week",
        value: tokenStats
          ? `${formatTokenValue(tokenStats.distributedThisWeek, 2)} ${symbol}`
          : "\u2014",
        hint: `Week ${tokenStats?.currentWeek ?? "\u2014"}`,
        tone: "native",
      },
      {
        label: "My preview",
        value: previewAmount
          ? `${formatTokenValue(previewAmount, 4)} ${symbol}`
          : "\u2014",
        hint: previewUnits
          ? `${formatInteger(previewUnits)} units tracked`
          : "Sync to compute",
        tone: "token",
      },
    ];
  }, [tokenSymbol, tokenStats, claimPreview]);

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
          typeof value?.toString === "function" ? value.toString() : String(value);
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
      label: `Block ${idx + 1}`,
      value: Number.isFinite(weight) ? weight * scale : "-",
    }));
  }, [tokenStats]);

  const claimableLabel = walletAddress
    ? claimable != null
      ? `${formatDecimal(claimable, 4)} ${tokenSymbol}`
      : "Syncing..."
    : "Connect wallet";
  const claimPreviewLabel = claimPreview?.amount
    ? `${formatDecimal(claimPreview.amount, 4)} ${tokenSymbol} / ${claimPreview.units} units`
    : "No tokens tracked yet.";

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
      ...(nftReader || {}),
      baseURIs: {
        ...DEFAULT_NFT_SUMMARY.baseURIs,
        ...(nftSummary?.baseURIs || {}),
      },
      contractAddress:
        nftReader?.contractAddress ||
        nftSummary?.contractAddress ||
        DEFAULT_NFT_SUMMARY.contractAddress,
    }),
    [nftSummary, nftReader],
  );

  const blockPaid = COLLECTIONStats?.blockPaid ?? [];
  const orangeMainIdPaid = COLLECTIONStats?.orangeMainIdPaid ?? [];
  const rainbowClaimed = Boolean(
    COLLECTIONStats?.rainbowClaimed ??
      COLLECTIONStats?.rainbowRewardClaimedGlobal,
  );
  const claimedOrange = Boolean(COLLECTIONStats?.claimedOrange);
  const metadataRows = [
    { label: "Distributor", value: COLLECTIONStats?.distributor },
    { label: "Eyes main", value: COLLECTIONStats?.main },
    { label: "Owner", value: COLLECTIONStats?.owner },
  ];

  const rewardsSource = React.useMemo(() => {
    const hasRewardsReader = Boolean(
      readerAddresses?.reader && ABI_REWARDS_READER?.length,
    );
    const hasTokenReader = Boolean(tokenRewardsReaderAddr);
    const hasNftReader = Boolean(nftRewardsReaderAddr);
    const hasReader = hasRewardsReader || hasTokenReader || hasNftReader;
    if (readerLoading) return { label: "Source: loading", tone: "dim" };
    if (readerError) return { label: "Source: fallback", tone: "warn" };
    return hasReader
      ? { label: "Source: reader", tone: "ok" }
      : { label: "Source: direct", tone: "warn" };
  }, [
    readerAddresses?.reader,
    readerLoading,
    readerError,
    tokenRewardsReaderAddr,
    nftRewardsReaderAddr,
  ]);

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
      <article
        className="biggi-hero__stat rewards-panel__countdown-tile"
        key="weekly-countdown"
      >
        <div className="rewards-panel__countdown-title">Next claim window</div>
        <div className="rewards-panel__countdown-value" aria-live="polite">
          {countdownText}
        </div>
        <div className="rewards-panel__countdown-meta">
          {weeklyDisplayed.status === "claimable"
            ? "Claim open"
            : "Claim pending"}
        </div>
      </article>
    </div>
  );

  const tokenTab = (
    <section className="rewards-panel__section">
      <SectionHeader label="Token REWARDS" accent="#ffe800" />
      {heroSection}
      <SectionHeader label="Claims & rails" accent="#9b7bff" />
      <div className="rewards-panel__grid">
        <article className="biggi-card biggi-card--y rewards-panel__card">
          <div className="biggi-card__glow" aria-hidden />
          <div className="biggi-card__header">
            <div className="biggi-card__heading">
              <h3>Claim preview</h3>
              <p>Live pull from TokenREWARDS with your tracked tokens.</p>
            </div>
            <span className="biggi-accent-chip">
              <span className="label">Tracked</span>
              <span className="value">{eligibleTokenIds.length}</span>
            </span>
          </div>
          <div className="biggi-card__body">
            <div className="rewards-panel__stat-trio">
              <div className="rewards-panel__stat">
                <span className="label">Claimable now</span>
                <span className="value">{claimableLabel}</span>
              </div>
              <div className="rewards-panel__stat">
                <span className="label">Preview</span>
                <span className="value">
                  {previewLoading ? "Syncing preview..." : claimPreviewLabel}
                </span>
              </div>
              <div className="rewards-panel__stat">
                <span className="label">Remaining pool</span>
                <span className="value">
                  {tokenStats
                    ? `${formatDecimal(tokenStats.remainingCap, 2)} ${tokenSymbol}`
                    : "--"}
                </span>
              </div>
            </div>
            <div className="rewards-panel__cta-row">
              <button
                type="button"
                className="biggi-btn biggi-btn--accent"
                disabled={!walletAddress || !onClaim || claiming}
                onClick={handleClaim}
              >
                {claiming
                  ? "Claiming..."
                  : walletAddress
                    ? "Claim REWARDS"
                    : "Connect wallet to claim"}
              </button>
              <button
                type="button"
                className="biggi-btn biggi-btn--ghost"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh stats"}
              </button>
            </div>
            {claimMessage && (
              <div className="rewards-grid__alert rewards-panel__alert">
                {claimMessage}
              </div>
            )}
          </div>
        </article>

        <article className="biggi-card biggi-card--c rewards-panel__card">
          <div className="biggi-card__glow" aria-hidden />
          <div className="biggi-card__header">
            <div className="biggi-card__heading">
              <h3>Block weights</h3>
              <p>Weekly unit weights pulled from the contract.</p>
            </div>
          </div>
          <div className="rewards-panel__status-grid">
            {tokenStatusGrid.length ? (
              tokenStatusGrid.map((status) => (
                <div key={status.id} className="rewards-panel__status">
                  <span className="label">{status.label}</span>
                  <span className="value">{status.value}</span>
                </div>
              ))
            ) : (
              <div className="rewards-panel__status">
                <span className="label">Loading</span>
                <span className="value">--</span>
              </div>
            )}
          </div>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              className="biggi-btn biggi-btn--ghost"
              onClick={() => setBlockSummaryOpen(true)}
            >
              Open block summary
            </button>
          </div>
        </article>

        <article className="biggi-card biggi-card--v rewards-panel__card">
          <div className="biggi-card__glow" aria-hidden />
          <div className="biggi-card__header">
            <div className="biggi-card__heading">
              <h3>Contracts</h3>
              <p>Explorer shortcuts for all reward rails.</p>
            </div>
          </div>
          <div className="rewards-panel__address-grid">
            {[
              { label: "Token REWARDS", addr: tokenRewardsAddr },
              { label: "COLLECTION REWARDS", addr: collectionRewardsAddr },
              { label: "NFT REWARDS", addr: nftRewardsAddr },
            ].map((row) => (
              <div className="rewards-panel__address-row" key={row.label}>
                <div>
                  <div className="label">{row.label}</div>
                  <div className="value">{shortAddress(row.addr)}</div>
                </div>
                <button
                  type="button"
                  className="biggi-btn biggi-btn--ghost rewards-panel__address-btn"
                  onClick={() => {
                    const url = row.addr
                      ? `${explorerBase}/address/${row.addr}`
                      : null;
                    if (!url || typeof window === "undefined") return;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  Explorer
                </button>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );

  const COLLECTIONTab = (
    <section className="rewards-panel__section">
      <SectionHeader label="COLLECTION REWARDS" accent="#ffe800" />
      <COLLECTIONREWARDSSection
        stats={COLLECTIONStats}
        statusRows={COLLECTIONStatus}
        formatDecimal={formatDecimal}
        rewardPool={rewardPool}
        collectionBalance={collectionBalance}
        blockPaid={blockPaid}
        orangeMainIdPaid={orangeMainIdPaid}
        rainbowClaimed={rainbowClaimed}
        claimedOrange={claimedOrange}
        canClaimCOLLECTION={canClaimCOLLECTION}
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
    <section className="rewards-panel__section rewards-grid__section--nft">
      <SectionHeader label="NFT REWARDS" accent="#27d9d2" />
      <NftREWARDSTab
        data={nftData}
        range={NFT_RANGE}
        formatInteger={formatInteger}
        formatAddress={shortAddress}
        formatUriDisplay={formatUriDisplay}
        onOpenExplorer={(addr) => {
          const url = addr ? `${explorerBase}/address/${addr}` : null;
          if (!url || typeof window === "undefined") return;
          window.open(url, "_blank", "noopener,noreferrer");
        }}
        emptyRanks={{ 1: false, 2: false, 3: false }}
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
            <h2 className="rewards-grid__title">Biggi REWARDS</h2>
            <p className="rewards-grid__subtitle">
              Token, COLLECTION and NFT claims are grouped by contract. The
              token view highlights pool stats and your personal claim preview.
            </p>
          </div>
          <div className="rewards-panel__header-meta">
            <span
              className={`rewards-grid__pill rewards-panel__source-pill rewards-panel__source-pill--${rewardsSource.tone}`}
            >
              {rewardsSource.label}
            </span>
            {readerAddresses?.reader ? (
              <span className="rewards-grid__pill rewards-panel__source-pill rewards-panel__source-pill--mono">
                Reader: {shortAddress(readerAddresses.reader)}
              </span>
            ) : null}
            {tokenRewardsReaderAddr ? (
              <span className="rewards-grid__pill rewards-panel__source-pill rewards-panel__source-pill--mono">
                TokenReader: {shortAddress(tokenRewardsReaderAddr)}
              </span>
            ) : null}
            {nftRewardsReaderAddr ? (
              <span className="rewards-grid__pill rewards-panel__source-pill rewards-panel__source-pill--mono">
                NftReader: {shortAddress(nftRewardsReaderAddr)}
              </span>
            ) : null}
            {tokenRewardsAddr ? (
              <span className="rewards-grid__pill rewards-panel__source-pill rewards-panel__source-pill--mono">
                Token: {shortAddress(tokenRewardsAddr)}
              </span>
            ) : null}
          </div>
        </header>
        <PanelInfoModal
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          title="Rewards Panel"
          items={infoItems}
        />
        <div className="view-tabs rewards-panel__tabs" role="tablist">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            className="tab-button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh stats"}
          </button>
          <button
            type="button"
            className="panel-info-btn biggi-btn biggi-btn--ghost"
            onClick={() => setInfoOpen(true)}
            aria-label="REWARDS buttons info"
          >
            <span>i</span>
          </button>
        </div>
        {renderTab()}
      </div>
    </section>
  );
}

export default REWARDSPanel;
