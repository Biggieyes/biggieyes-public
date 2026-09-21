import * as React from "react";
import copy from "clipboard-copy";
import { formatEther, formatUnits } from "ethers";
import { useWeb3 } from "@/providers/Web3Context.js";
import { useContracts } from "@/providers/ContractsContext.js";
import { chainNameFor, explorerBaseFor } from "@/config/chains.js";
import { ADDR } from "@/shared/utils/addresses";
import useCommunityCenterUserSnapshot from "@/hooks/useCommunityCenterUserSnapshot.js";
import {
  formatNativeDisplay,
  formatTokenDisplay,
  isRealAddress,
} from "@/features/tokenomics/utils/amountFormatting.js";
import PanelInfoModal from "@/components/common/PanelInfoModal";
import PanelInfoButton from "@/components/common/PanelInfoButton";
import "./USERPANEL.css";
import "../../styles/panel-buttons.css";

function shortAddress(addr) {
  if (!isRealAddress(addr)) return "--";
  const s = String(addr);
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

function ExplorerLink({ address, chainId, label }) {
  if (!isRealAddress(address)) return <span className="muted">--</span>;
  const base =
    explorerBaseFor(chainId || ADDR.CHAIN_ID || 137) ||
    "https://polygonscan.com";
  const href = `${base}/address/${address}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="user-panel__link"
    >
      {label || shortAddress(address)}
    </a>
  );
}

function formatValue(value, digits = 4) {
  if (value == null || value === "") return "--";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

function formatNative(value, digits = 4) {
  return formatNativeDisplay(value, digits);
}

function formatToken(value, digits = 4) {
  return formatTokenDisplay(value, 18, digits, "BIGGI");
}

function isNonNegativeAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  if (typeof value === "bigint") return value >= 0n;
  if (typeof value !== "string") return false;
  const normalized = value.trim().replace(/,/g, "");
  return /^\d+(?:\.\d+)?$/.test(normalized);
}

function isPositiveAmount(value) {
  if (!isNonNegativeAmount(value)) return false;
  if (typeof value === "number") return value > 0;
  if (typeof value === "bigint") return value > 0n;
  return /[1-9]/.test(value.replace(/[,.\s]/g, ""));
}

function formatIntegerValue(value) {
  if (value == null || !/^\d+$/.test(String(value))) return "--";
  try {
    return BigInt(value).toLocaleString("en-US");
  } catch {
    return "--";
  }
}

const ACTIVITY_MAX = 5;
const EMPTY_OVERVIEW = {
  loading: false,
  error: null,
  native: null,
  biggi: null,
  totalTokens: null,
  tickets: null,
  nfts: null,
  updatedAt: null,
};

function readCount(value) {
  if (value == null || !/^\d+$/.test(String(value))) {
    throw new Error("Missing or invalid integer response");
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("Integer response out of range");
  }
  return count;
}

function toBigIntSafe(value) {
  try {
    if (value == null) return null;
    if (typeof value === "bigint") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      return BigInt(Math.trunc(value));
    }
    if (typeof value === "string") {
      const s = value.trim();
      if (!s) return null;
      if (/^\d+$/.test(s)) return BigInt(s);
      if (/^0x[0-9a-f]+$/i.test(s)) return BigInt(s);
      return null;
    }
    if (typeof value?.toString === "function") {
      return toBigIntSafe(value.toString());
    }
  } catch {
    return null;
  }
  return null;
}

function formatTxType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "mint") return "Mint ticket";
  if (t === "redeem") return "Redeem";
  if (t === "claim") return "Claim rewards";
  return type ? String(type) : "Activity";
}

function formatTxStage(stage) {
  const s = String(stage || "").toLowerCase();
  if (s === "wallet") return "Confirm in wallet";
  if (s === "pending") return "Pending confirmation";
  if (s === "confirmed") return "Confirmed";
  return stage ? String(stage) : "Update";
}

export default function USERPANEL({
  autoOpenInfo = false,
  walletAddress = "",
  address = "",
  onConnect,
  onMint,
  onRedeem,
  onClaim,
  onRefreshClaimable,
  isMinting = false,
  isRedeeming = false,
  isClaiming = false,
  VRFPending = false,
  redeemMsg = "",
  actionStatusLabel = "",
  txStatus = null,
  txExplorerLink = "",
  myNFTs = [],
  items = null,
  ticketPrice = null,
  minted = null,
  maxSupply = null,
  ticketsLeft = null,
  claimable = null,
  rewardEntitlement = null,
  mintVolumeMatic = null,
  compact = false,
}) {
  const { account, chainId, connectMetaMask, isConnecting, provider } =
    useWeb3();
  const contracts = useContracts();
  const parentAccount = walletAddress || address || "";
  // AppCore owns the wallet-specific inventory and action callbacks. Prefer its
  // account so a lagging secondary Web3 context cannot hide valid reward data.
  const activeAccount = parentAccount || account || "";
  const mainnetChainId = Number(ADDR.CHAIN_ID || 137);
  const {
    snapshot: communitySnapshot,
    loading: communityLoading,
    error: communityError,
    refresh: refreshCommunitySnapshot,
  } = useCommunityCenterUserSnapshot({
    walletAddress: activeAccount,
    includePolls: true,
  });
  const handleConnect = onConnect || connectMetaMask;
  const [copied, setCopied] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const autoInfoOpened = React.useRef(false);
  const [activity, setActivity] = React.useState([]);
  const activityRef = React.useRef("");
  const overviewContext = React.useMemo(
    () => ({ activeAccount, chainId, provider, contracts }),
    [activeAccount, chainId, provider, contracts],
  );
  const [overviewSnapshot, setOverview] = React.useState(EMPTY_OVERVIEW);
  const overview =
    overviewSnapshot.context === overviewContext
      ? overviewSnapshot
      : { ...EMPTY_OVERVIEW, loading: Boolean(activeAccount) };
  const overviewRequestRef = React.useRef(0);

  React.useEffect(() => {
    if (autoOpenInfo && !autoInfoOpened.current) {
      setInfoOpen(true);
      autoInfoOpened.current = true;
    }
  }, [autoOpenInfo]);

  const infoItems = React.useMemo(
    () => [
      {
        label: "CONNECT WALLET",
        description: [
          "Connects your wallet to read balances, claims, and referrals.",
          "Required for redeem, claim, and on-chain actions.",
        ],
      },
      {
        label: "HOLDINGS SNAPSHOT",
        description: [
          "Shows your POL balance, BIGGI balance, and token counts.",
          "Highlights when a ticket is ready to redeem.",
        ],
      },
      {
        label: "ACTION CENTER",
        description: [
          "Quick buttons for mint, redeem, and claim actions.",
          "Shows ticket price, claimable preview, and live status.",
        ],
      },
      {
        label: "RECENT ACTIVITY",
        description: [
          "Tracks your latest on-chain actions.",
          "Links to the explorer when a transaction hash exists.",
        ],
      },
      {
        label: "NFT PREVIEW",
        description: [
          "Shows your latest NFTs or tickets at a glance.",
          "Newest items stay at the top.",
        ],
      },
      {
        label: "COMMUNITY CENTER",
        description: [
          "Shows wallet-specific event assignments and claimable community prizes.",
          "Uses the same mainnet Community Center contract as the community panel.",
        ],
      },
      {
        label: "COPY REFERRAL",
        description: [
          "Copies your referral link to share with friends.",
          "Links are generated from your connected wallet address.",
        ],
      },
      {
        label: "REFRESH CONNECTION",
        description: [
          "Re-checks wallet connection and network status.",
          "Use if the chain changes or wallet reconnects.",
        ],
      },
    ],
    [],
  );

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = activeAccount ? `${baseUrl}?ref=${activeAccount}` : "";
  const connected = Boolean(activeAccount);
  const walletItems = React.useMemo(() => {
    const sourceItems = Array.isArray(myNFTs) && myNFTs.length ? myNFTs : items;
    return Array.isArray(sourceItems)
      ? sourceItems.filter((item) => item && !item.isPending)
      : [];
  }, [items, myNFTs]);
  const inventorySummary = React.useMemo(
    () =>
      walletItems.reduce(
        (summary, item) => {
          if (item?.isTicket) summary.tickets += 1;
          else summary.nfts += 1;
          return summary;
        },
        { nfts: 0, tickets: 0 },
      ),
    [walletItems],
  );

  const handleCopy = React.useCallback(async () => {
    if (!referralLink) return;
    try {
      await copy(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [referralLink]);

  const callAction = React.useCallback(async (fn, label) => {
    if (typeof fn !== "function") return;
    try {
      await fn();
    } catch (err) {
      console.error(`UserPanel ${label} failed`, err);
    }
  }, []);

  const handleMint = React.useCallback(
    () => callAction(onMint, "mint"),
    [callAction, onMint],
  );
  const handleRedeem = React.useCallback(
    () => callAction(onRedeem, "redeem"),
    [callAction, onRedeem],
  );
  const handleClaim = React.useCallback(
    () => callAction(onClaim, "claim"),
    [callAction, onClaim],
  );

  const previewItems = React.useMemo(() => {
    if (!connected) return [];
    const sorted = walletItems.slice().sort((a, b) => {
      const aTicket = Boolean(a?.isTicket);
      const bTicket = Boolean(b?.isTicket);
      if (aTicket !== bTicket) return aTicket ? 1 : -1;
      const aId = toBigIntSafe(a?.tokenId);
      const bId = toBigIntSafe(b?.tokenId);
      if (aId != null && bId != null) {
        if (aId > bId) return -1;
        if (aId < bId) return 1;
        return 0;
      }
      return 0;
    });
    return sorted.slice(0, 4);
  }, [connected, walletItems]);

  React.useEffect(() => {
    if (!txStatus?.type) return;
    const key = `${txStatus.type}:${txStatus.stage || ""}:${txStatus.hash || ""}`;
    if (activityRef.current === key) return;
    activityRef.current = key;
    const nextEntry = {
      type: txStatus.type,
      stage: txStatus.stage || "",
      hash: txStatus.hash || "",
      chainId: txStatus.chainId || chainId || null,
      ts: Date.now(),
    };
    setActivity((prev) => {
      const merged = [nextEntry, ...prev];
      return merged.slice(0, ACTIVITY_MAX);
    });
  }, [txStatus, chainId]);

  const refreshOverview = React.useCallback(async () => {
    const requestId = ++overviewRequestRef.current;
    if (!activeAccount) {
      setOverview({ ...EMPTY_OVERVIEW, context: overviewContext });
      return;
    }
    setOverview({ ...EMPTY_OVERVIEW, context: overviewContext, loading: true });
    try {
      const failures = new Set();
      const safeFactory = (label, factory, fallback) => {
        try {
          if (typeof factory !== "function") throw new Error("Missing reader");
          const value = factory();
          if (value == null) throw new Error("Missing reader");
          return value;
        } catch {
          failures.add(label);
          return fallback;
        }
      };
      const balanceProvider =
        safeFactory("provider", contracts?._effectiveROProvider, null) ||
        provider;
      const network = await balanceProvider?.getNetwork?.();
      if (requestId !== overviewRequestRef.current) return;
      if (Number(network?.chainId) !== 137) {
        throw new Error("Polygon mainnet read provider unavailable");
      }
      const collections = safeFactory(
        "collections",
        contracts?.chapterCollectionsRead,
        [],
      );
      const ticketHub = safeFactory("tickets", contracts?.ticketHubRead, null);
      const token = safeFactory("BIGGI", contracts?.tokenRead, null);

      const nativePromise = (async () => {
        try {
          return formatEther(await balanceProvider.getBalance(activeAccount));
        } catch {
          failures.add("POL");
          return null;
        }
      })();

      const biggiPromise = (async () => {
        try {
          if (typeof token?.balanceOf !== "function" || typeof token?.decimals !== "function") {
            throw new Error("Missing token reader");
          }
          const [balance, decimals] = await Promise.all([
            Promise.resolve().then(() => token.balanceOf(activeAccount)),
            Promise.resolve().then(() => token.decimals()),
          ]);
          const digits = readCount(decimals);
          if (digits > 255) throw new Error("Invalid token decimals");
          return formatUnits(balance, digits);
        } catch {
          failures.add("BIGGI");
          return null;
        }
      })();

      const nftPromise = (async () => {
        if (!Array.isArray(collections) || !collections.length) {
          failures.add("NFTs");
          return null;
        }
        const balances = await Promise.all(
          collections.map(async (entry) => {
            const contract = entry?.contract;
            if (typeof contract?.balanceOf !== "function") {
              return { ok: false, value: 0n };
            }
            try {
              return {
                ok: true,
                value: readCount(await contract.balanceOf(activeAccount)),
              };
            } catch {
              return { ok: false, value: 0n };
            }
          }),
        );
        if (balances.some((result) => !result.ok)) {
          failures.add("NFTs");
          return null;
        }
        return readCount(
          balances.reduce((sum, result) => sum + result.value, 0),
        );
      })();

      const ticketPromise = (async () => {
        try {
          return readCount(await ticketHub.balanceOf(activeAccount));
        } catch {
          failures.add("tickets");
          return null;
        }
      })();

      const [native, biggi, totalTokens, tickets] = await Promise.all([
        nativePromise,
        biggiPromise,
        nftPromise,
        ticketPromise,
      ]);

      if (requestId !== overviewRequestRef.current) return;

      setOverview({
        context: overviewContext,
        loading: false,
        error:
          failures.size > 0
            ? new Error(`Incomplete reads: ${Array.from(failures).join(", ")}`)
            : null,
        native,
        biggi,
        totalTokens,
        tickets,
        nfts: totalTokens,
        updatedAt: Date.now(),
      });
    } catch (err) {
      if (requestId !== overviewRequestRef.current) return;
      setOverview({
        ...EMPTY_OVERVIEW,
        context: overviewContext,
        error: err,
      });
    }
  }, [activeAccount, provider, contracts, overviewContext]);

  React.useEffect(() => {
    refreshOverview();
    return () => {
      overviewRequestRef.current += 1;
    };
  }, [refreshOverview]);

  const buildTxLink = React.useCallback(
    (hash, chainIdOverride) => {
      if (!hash) return "";
      const base = explorerBaseFor(chainIdOverride || mainnetChainId);
      return base ? `${base}/tx/${hash}` : "";
    },
    [mainnetChainId],
  );

  const contractLinks = [
    { label: "Ticket Hub", address: ADDR.TICKET_HUB },
    { label: "Chapter 1 VRF", address: ADDR.MAIN },
    { label: "Token", address: ADDR.BIGGI },
    { label: "Token REWARDS", address: ADDR.TOKEN_REWARDS },
    { label: "Collection REWARDS", address: ADDR.COLLECTION_REWARDS },
    { label: "Community Center", address: ADDR.COMMUNITY_CENTER },
    { label: "VRF Router", address: ADDR.VRF_ROUTER },
  ];
  const canRedeem =
    (Number.isFinite(Number(overview.tickets)) &&
      Number(overview.tickets) > 0) ||
    inventorySummary.tickets > 0;
  const rewardAmount = rewardEntitlement?.amount ?? claimable;
  const rawRewardStatus = String(rewardEntitlement?.status || "").toLowerCase();
  const rewardStatus =
    rawRewardStatus === "inventory-unavailable"
      ? overview.loading
        ? "loading"
        : overview.nfts === 0
          ? "empty"
          : "error"
      : rawRewardStatus ||
        (!connected
          ? "disconnected"
          : isNonNegativeAmount(rewardAmount)
            ? isPositiveAmount(rewardAmount)
              ? "ready"
              : "empty"
            : "loading");
  const rewardLoading = rewardStatus === "loading";
  const rewardPaused =
    rewardStatus === "paused" || rewardEntitlement?.paused === true;
  const rewardError = rewardStatus === "error";
  const effectiveRewardAmount =
    rewardAmount == null && rewardStatus === "empty" && overview.nfts === 0
      ? 0
      : rewardAmount;
  const claimableKnown =
    connected &&
    !rewardLoading &&
    !rewardError &&
    rewardStatus !== "disconnected" &&
    isNonNegativeAmount(effectiveRewardAmount);
  const canClaim =
    connected &&
    claimableKnown &&
    isPositiveAmount(effectiveRewardAmount) &&
    !rewardPaused;
  const actionBusy = isMinting || isRedeeming || isClaiming || VRFPending;
  const statusText = (() => {
    if (actionStatusLabel) return actionStatusLabel;
    if (redeemMsg) return redeemMsg;
    if (VRFPending) return "Waiting for VRF reveal...";
    if (isRedeeming) return "Redeem transaction pending...";
    if (txStatus?.type === "mint") {
      if (txStatus?.stage === "wallet") return "Mint: confirm in wallet...";
      if (txStatus?.stage === "pending") return "Mint: pending confirmation...";
    }
    if (txStatus?.type === "claim") {
      if (txStatus?.stage === "wallet") return "Claim: confirm in wallet...";
      if (txStatus?.stage === "pending")
        return "Claim: pending confirmation...";
    }
    return connected
      ? "Ready for your next action."
      : "Connect wallet to start.";
  })();
  const latestTxLink =
    txExplorerLink ||
    (txStatus?.hash ? buildTxLink(txStatus.hash, txStatus.chainId) : "");
  const activityRows =
    activity.length > 0
      ? activity
      : txStatus?.type
        ? [
            {
              type: txStatus.type,
              stage: txStatus.stage || "",
              hash: txStatus.hash || "",
              chainId: txStatus.chainId || mainnetChainId,
              ts: Date.now(),
            },
          ]
        : [];
  const ticketPriceLabel =
    ticketPrice != null ? formatNative(ticketPrice, 4) : "--";
  const claimableLabel = claimableKnown
    ? formatToken(effectiveRewardAmount, 4)
    : "--";
  const eligibleNftsLabel =
    rewardEntitlement?.eligibleCount != null
      ? formatIntegerValue(rewardEntitlement.eligibleCount)
      : rewardStatus === "empty" && overview.nfts === 0
        ? "0"
        : "--";
  const rewardUnitsLabel = formatIntegerValue(rewardEntitlement?.units);
  const rewardStatusLabel = (() => {
    if (!connected || rewardStatus === "disconnected") return "Connect wallet";
    if (rewardLoading) return "Checking";
    if (rewardError) return "Unavailable";
    if (rewardPaused) return "Claims paused";
    if (rewardStatus === "empty") {
      return eligibleNftsLabel === "0" ? "No eligible NFTs" : "Nothing to claim";
    }
    return canClaim ? "Ready to claim" : "Up to date";
  })();
  const rewardStatusDetail = (() => {
    if (!connected) return "Connect your wallet to calculate holder rewards.";
    if (rewardLoading) return "Reading eligible NFTs and the current BIGGI preview.";
    if (rewardError) {
      return "Reward data could not be confirmed. Refresh before claiming.";
    }
    if (rewardPaused) {
      return "Eligible NFTs remain tracked while weekly BIGGI claims are paused.";
    }
    if (rewardStatus === "empty") {
      return eligibleNftsLabel === "0"
        ? "This wallet has no eligible BiggiEyes NFT."
        : "Eligible NFTs are tracked, but no BIGGI is claimable in this cycle.";
    }
    return "The on-chain reward preview is ready for this wallet.";
  })();
  const mintVolumeLabel =
    mintVolumeMatic != null ? formatNative(mintVolumeMatic, 4) : "--";
  const communityClaimableLabel = formatNative(
    communitySnapshot.claimableAmount,
    4,
  );
  const communityAssignedLabel = formatNative(
    communitySnapshot.assignedAmount,
    4,
  );
  const communityPoolLabel = formatNative(communitySnapshot.poolBalance, 4);
  const communityLockedLabel = formatNative(communitySnapshot.totalLocked, 4);
  const supplyLabel =
    minted != null && maxSupply != null
      ? `${formatValue(minted, 0)} / ${formatValue(maxSupply, 0)}`
      : "--";
  const ticketsLeftLabel =
    ticketsLeft != null ? formatValue(ticketsLeft, 0) : "--";
  const mintLabel = isMinting ? "Minting..." : "Mint ticket";
  const redeemLabel = VRFPending
    ? "VRF pending..."
    : isRedeeming
      ? "Redeeming..."
      : "Redeem ticket";
  const claimLabel = isClaiming
    ? "Claiming..."
    : rewardPaused
      ? "Claims paused"
      : rewardLoading
        ? "Checking rewards..."
        : rewardError
          ? "Claim unavailable"
          : claimableKnown && !isPositiveAmount(effectiveRewardAmount)
            ? "Nothing to claim"
            : "Claim rewards";
  const mintDisabled = !connected || actionBusy || typeof onMint !== "function";
  const redeemDisabled =
    !connected || actionBusy || !canRedeem || typeof onRedeem !== "function";
  const claimDisabled =
    !connected || actionBusy || !canClaim || typeof onClaim !== "function";
  const lastUpdatedLabel = overview.updatedAt
    ? new Date(overview.updatedAt).toLocaleTimeString()
    : "--";

  const refreshAll = React.useCallback(async () => {
    await Promise.allSettled([
      refreshOverview(),
      Promise.resolve().then(() => refreshCommunitySnapshot()),
      Promise.resolve().then(() => onRefreshClaimable?.()),
    ]);
  }, [refreshCommunitySnapshot, refreshOverview, onRefreshClaimable]);

  const nftCountLabel =
    overview.nfts != null
      ? formatValue(overview.nfts, 0)
      : overview.totalTokens != null
        ? formatValue(overview.totalTokens, 0)
        : connected && inventorySummary.nfts > 0
          ? formatValue(inventorySummary.nfts, 0)
          : "--";
  const ticketCountLabel =
    overview.tickets != null
      ? formatValue(overview.tickets, 0)
      : connected && inventorySummary.tickets > 0
        ? formatValue(inventorySummary.tickets, 0)
        : "--";
  const communityState = !communitySnapshot.configured
    ? "Missing"
    : communityLoading || communityError || communitySnapshot.paused == null
      ? "Unavailable"
    : communitySnapshot.paused
      ? "Paused"
      : "Live";
  const refreshing = overview.loading || communityLoading;

  return (
    <div className={`user-panel${compact ? " user-panel--compact" : ""}`}>
      <section className="user-panel__surface">
        <header className="user-panel__header">
          <div className="user-panel__headline">
            <h2 className="user-panel__title">User Panel</h2>
            <p className="user-panel__subtitle">
              Your wallet, collection, rewards, and recent activity in one
              place.
            </p>
          </div>
          <div className="user-panel__header-actions">
            <span
              className={`user-panel__connection ${
                connected ? "is-connected" : ""
              }`}
            >
              {connected ? shortAddress(activeAccount) : "Wallet disconnected"}
            </span>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--accent"
              onClick={connected ? refreshAll : handleConnect}
              disabled={isConnecting || refreshing}
            >
              {connected
                ? refreshing
                  ? "Refreshing..."
                  : "Refresh data"
                : isConnecting
                  ? "Connecting..."
                  : "Connect wallet"}
            </button>
            <PanelInfoButton
              className="panel-info-btn--transparent"
              onClick={() => setInfoOpen(true)}
              ariaLabel="User panel buttons info"
            />
          </div>
        </header>

        <div className="user-panel__balance-strip" aria-label="Wallet balances">
          <div className="user-panel__balance-item">
            <span>POL balance</span>
            <strong>{formatNative(overview.native, 4)}</strong>
            </div>
          <div className="user-panel__balance-item">
            <span>BIGGI balance</span>
            <strong>{formatToken(overview.biggi, 4)}</strong>
            </div>
          <div className="user-panel__balance-item">
            <span>NFTs owned</span>
            <strong>{nftCountLabel}</strong>
          </div>
          <div className="user-panel__balance-item">
            <span>Tickets</span>
            <strong>{ticketCountLabel}</strong>
          </div>
        </div>

        <div className="user-panel__workspace">
          <main className="user-panel__main">
            <section className="user-panel__section user-panel__section--actions">
              <div className="user-panel__section-head">
                <div>
                  <h3>Actions</h3>
                  <p>
                    Mint a ticket, redeem it through VRF, or claim BIGGI
                    rewards.
                  </p>
                </div>
                <span className="user-panel__badge">
                  {connected ? "Ready" : "Connect wallet"}
                  </span>
                </div>

              <div className="user-panel__key-metrics">
                <div>
              <span>Ticket price</span>
              <strong>{ticketPriceLabel}</strong>
            </div>
                <div>
              <span>Claimable</span>
              <strong>{claimableLabel}</strong>
            </div>
                <div>
                  <span>Eligible NFTs</span>
                  <strong>{eligibleNftsLabel}</strong>
                </div>
                <div>
                  <span>Reward status</span>
                  <strong>{rewardStatusLabel}</strong>
                </div>
            </div>

            <div className="user-panel__action-row">
              <button
                type="button"
                className="user-panel__btn user-panel__btn--accent"
                onClick={handleMint}
                disabled={mintDisabled}
              >
                {mintLabel}
              </button>
              <button
                type="button"
                className="user-panel__btn user-panel__btn--ghost"
                onClick={handleRedeem}
                disabled={redeemDisabled}
              >
                {redeemLabel}
              </button>
              <button
                type="button"
                className="user-panel__btn user-panel__btn--ghost"
                onClick={handleClaim}
                disabled={claimDisabled}
              >
                {claimLabel}
              </button>
            </div>

            <div
                className={`user-panel__message ${actionBusy ? "is-pending" : "is-ready"}`}
                aria-live="polite"
            >
                <span>{statusText}</span>
            {latestTxLink ? (
                  <a href={latestTxLink} target="_blank" rel="noreferrer">
                    View transaction
              </a>
                ) : null}
          </div>
            </section>

            <section className="user-panel__section">
              <div className="user-panel__section-head">
                <div>
                  <h3>Your collection</h3>
                  <p>Latest NFTs and tickets detected in your wallet.</p>
            </div>
                <span className="user-panel__badge">{nftCountLabel} NFTs</span>
            </div>

              {previewItems.length ? (
                <div className="user-panel__nft-grid">
                  {previewItems.map((item, idx) => (
                    <article
                      key={`${
                        item?.contractAddress || item?.chapterId || "wallet"
                      }:${
                        item?.collectionType ||
                        (item?.isTicket ? "ticket" : "nft")
                      }:${item?.tokenId ?? item?.id ?? idx}`}
                      className="user-panel__nft-item"
            >
                      <img
                        className="user-panel__nft-image"
                        src={item?.image || "/images/Biggi.png"}
                        alt={item?.meta?.name || "BIGGI NFT"}
                        loading="lazy"
                      />
                      <div>
                        <strong>#{item?.tokenId ?? "--"}</strong>
                        <span>{item?.isTicket ? "Ticket" : "NFT"}</span>
            </div>
                    </article>
                  ))}
            </div>
              ) : (
                <div className="user-panel__empty">
                  {connected
                    ? overview.loading
                      ? "Loading your collection..."
                      : overview.nfts == null || overview.tickets == null
                        ? "Collection data is temporarily unavailable."
                        : overview.nfts > 0 || overview.tickets > 0
                          ? "NFT previews are not available yet."
                          : "No NFTs detected yet. Mint a ticket to begin."
                    : "Connect your wallet to load your collection."}
          </div>
              )}
            </section>

            <section className="user-panel__section">
              <div className="user-panel__section-head">
                <div>
            <h3>Community Center</h3>
                  <p>
                    Community event assignments, POL prizes, and live votes.
            </p>
            </div>
                <span
                  className={`user-panel__badge ${
                    communityState === "Live" ? "is-live" : "is-warning"
                  }`}
                >
                  {communityState}
                </span>
            </div>

              <div className="user-panel__community-grid">
                <div>
                  <span>Claimable POL</span>
                  <strong>{communityClaimableLabel}</strong>
            </div>
                <div>
              <span>Assigned events</span>
              <strong>
                {formatValue(communitySnapshot.assignedEvents, 0)}
              </strong>
            </div>
                <div>
              <span>Assigned POL</span>
              <strong>{communityAssignedLabel}</strong>
            </div>
                <div>
              <span>Live polls</span>
              <strong>{formatValue(communitySnapshot.livePolls, 0)}</strong>
            </div>
              </div>

            <div
                className={`user-panel__message ${
                  communitySnapshot.claimableEvents > 0 ? "is-ready" : ""
                }`}
                aria-live="polite"
            >
                <span>
              {!connected
                    ? "Connect wallet to check community assignments."
                : communityLoading
                      ? "Loading community assignments..."
                : communityError || communitySnapshot.claimableEvents == null
                      ? "Community data is temporarily unavailable."
                  : communitySnapshot.claimableEvents > 0
                        ? "A community prize is ready to claim in Community Center."
                        : "No community prize is claimable right now."}
                </span>
            <button
              type="button"
                  className="user-panel__text-button"
              onClick={refreshCommunitySnapshot}
              disabled={communityLoading}
            >
                  {communityLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
            </section>
          </main>

          <aside className="user-panel__sidebar">
            <section className="user-panel__section">
              <div className="user-panel__section-head">
                <div>
                  <h3>Wallet</h3>
                  <p>Your active account and network.</p>
                </div>
              </div>
              <dl className="user-panel__rows">
                <div>
                  <dt>Address</dt>
                  <dd>{connected ? shortAddress(activeAccount) : "--"}</dd>
                </div>
                <div>
                  <dt>Network</dt>
                  <dd>{chainNameFor(mainnetChainId)}</dd>
                </div>
                <div>
                  <dt>Chain ID</dt>
                  <dd>{mainnetChainId}</dd>
                </div>
                <div>
                  <dt>Last update</dt>
                  <dd>{lastUpdatedLabel}</dd>
                </div>
              </dl>
              {overview.error ? (
                <div className="user-panel__inline-warning">
                  Some wallet balances could not be refreshed.
                </div>
              ) : null}
              <div className="user-panel__inline-actions">
                <ExplorerLink
                  address={activeAccount}
                  chainId={mainnetChainId}
                  label={connected ? "Open in explorer" : "--"}
                />
                <button
                  type="button"
                  className="user-panel__text-button"
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {connected ? "Reconnect" : "Connect"}
                </button>
              </div>
            </section>

            <section className="user-panel__section">
              <div className="user-panel__section-head">
                <div>
                  <h3>Rewards</h3>
                  <p>Verified BIGGI holder reward data for this wallet.</p>
                </div>
                <span
                  className={`user-panel__badge ${
                    rewardStatus === "ready"
                      ? "is-live"
                      : rewardPaused || rewardError
                        ? "is-warning"
                        : ""
                  }`}
                >
                  {rewardStatusLabel}
                </span>
              </div>
              <dl className="user-panel__rows">
                <div>
                  <dt>BIGGI claimable</dt>
                  <dd>{claimableLabel}</dd>
                </div>
                <div>
                  <dt>Eligible NFTs</dt>
                  <dd>{eligibleNftsLabel}</dd>
                </div>
                <div>
                  <dt>Reward units</dt>
                  <dd>{rewardUnitsLabel}</dd>
                </div>
                <div>
                  <dt>Claim status</dt>
                  <dd>{rewardStatusLabel}</dd>
                </div>
              </dl>
              <div
                className={`user-panel__reward-note is-${rewardStatus}`}
                role={rewardError ? "alert" : "status"}
              >
                {rewardStatusDetail}
              </div>
            </section>

            <section className="user-panel__section">
              <div className="user-panel__section-head">
                <div>
                  <h3>Referral</h3>
                  <p>Share your wallet-linked referral URL.</p>
                </div>
              </div>
              <div className="user-panel__referral">
                <input
                  type="text"
                  readOnly
                  aria-label="Referral link"
                  value={referralLink || "Connect wallet to generate link"}
                />
                <button
                  type="button"
                  className="user-panel__btn user-panel__btn--ghost"
                  onClick={handleCopy}
                  disabled={!referralLink}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </section>

            <section className="user-panel__section">
              <div className="user-panel__section-head">
                <div>
            <h3>Recent activity</h3>
                  <p>Your latest action in this session.</p>
                </div>
              </div>
            {activityRows.length ? (
              <div className="user-panel__activity-list">
                {activityRows.map((item, idx) => {
                  const link = item?.hash
                    ? buildTxLink(item.hash, item.chainId)
                    : "";
                  const timeLabel = item?.ts
                    ? new Date(item.ts).toLocaleTimeString()
                    : "--";
                  return (
                    <div
                      key={`${item?.type || "activity"}-${item?.hash || idx}`}
                      className="user-panel__activity-row"
                    >
                        <div>
                          <strong>{formatTxType(item?.type)}</strong>
                          <span>{formatTxStage(item?.stage)}</span>
                      </div>
                        <div>
                        <span>{timeLabel}</span>
                        {link ? (
                            <a href={link} target="_blank" rel="noreferrer">
                            Tx
                          </a>
                          ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
                <div className="user-panel__empty">
                  No activity in this session.
              </div>
            )}
            </section>
          </aside>
          </div>

        <details className="user-panel__details">
          <summary>
            <span>Protocol details</span>
            <small>Supply, community accounting, and verified contracts</small>
          </summary>
          <div className="user-panel__details-content">
            <section>
              <h3>Mint and reward metrics</h3>
              <dl className="user-panel__rows">
                <div>
                  <dt>Mint volume</dt>
                  <dd>{mintVolumeLabel}</dd>
              </div>
                <div>
                  <dt>Holder reward status</dt>
                  <dd>{rewardStatusLabel}</dd>
              </div>
                <div>
                  <dt>Minted supply</dt>
                  <dd>{supplyLabel}</dd>
          </div>
                <div>
                  <dt>Tickets left</dt>
                  <dd>{ticketsLeftLabel}</dd>
            </div>
              </dl>
            </section>
            <section>
              <h3>Community accounting</h3>
              <dl className="user-panel__rows">
                <div>
                  <dt>Events tracked</dt>
                  <dd>{formatValue(communitySnapshot.eventsCount, 0)}</dd>
            </div>
                <div>
                  <dt>Claimable events</dt>
                  <dd>{formatValue(communitySnapshot.claimableEvents, 0)}</dd>
            </div>
                <div>
                  <dt>Pool / locked</dt>
                  <dd>
                    {communityPoolLabel} / {communityLockedLabel}
                  </dd>
          </div>
                <div>
                  <dt>Contract</dt>
                  <dd>
                    <ExplorerLink
                      address={communitySnapshot.address}
                      chainId={mainnetChainId}
                      label={shortAddress(communitySnapshot.address)}
              />
                  </dd>
            </div>
              </dl>
            </section>
            <section className="user-panel__contracts">
              <h3>Core contracts</h3>
              <div>
              {contractLinks.map((item) => (
                  <div key={item.label}>
                  <span>{item.label}</span>
                  <ExplorerLink
                    address={item.address}
                    chainId={mainnetChainId}
                    label={shortAddress(item.address)}
                  />
                </div>
              ))}
            </div>
            </section>
          </div>
        </details>

        <PanelInfoModal
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          title="User Panel"
          items={infoItems}
        />
      </section>
    </div>
  );
}
