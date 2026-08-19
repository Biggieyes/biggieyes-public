import * as React from "react";
import copy from "clipboard-copy";
import { formatEther, formatUnits } from "ethers";
import { useWeb3 } from "@/providers/Web3Provider";
import { useContracts } from "@/providers/ContractsProvider";
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

const ACTIVITY_MAX = 5;

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
  rewardPool = null,
  mintVolumeMatic = null,
  compact = false,
}) {
  const { account, chainId, connectMetaMask, isConnecting, provider } =
    useWeb3();
  const contracts = useContracts();
  const activeAccount = account || walletAddress || address || "";
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
  const [overview, setOverview] = React.useState({
    loading: false,
    error: null,
    native: null,
    biggi: null,
    totalTokens: null,
    tickets: null,
    nfts: null,
    updatedAt: null,
  });

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
  const connectionPct = connected ? 100 : 0;
  const referralPct = referralLink ? 100 : 0;

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
    const sourceItems = Array.isArray(myNFTs) && myNFTs.length ? myNFTs : items;
    const list = Array.isArray(sourceItems) ? sourceItems : [];
    const filtered = list.filter((item) => item && !item.isPending);
    const sorted = filtered.slice().sort((a, b) => {
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
  }, [myNFTs, items]);

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
    if (!activeAccount) {
      setOverview((prev) => ({
        ...prev,
        native: null,
        biggi: null,
        totalTokens: null,
        tickets: null,
        nfts: null,
        updatedAt: null,
        error: null,
      }));
      return;
    }
    setOverview((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const balanceProvider = provider || contracts?._effectiveROProvider?.();
      const collections = contracts?.chapterCollectionsRead?.() || [];
      const ticketHub = contracts?.ticketHubRead?.();
      const token = contracts?.tokenRead?.();

      let native = null;
      if (balanceProvider?.getBalance) {
        const bal = await balanceProvider
          .getBalance(activeAccount)
          .catch(() => null);
        if (bal != null) native = formatEther(bal);
      }

      let biggi = null;
      if (token?.balanceOf) {
        const [bal, dec] = await Promise.all([
          token.balanceOf(activeAccount).catch(() => null),
          token.decimals?.().catch(() => 18),
        ]);
        if (bal != null) {
          biggi = formatUnits(bal, dec ?? 18);
        }
      }

      let totalTokens = null;
      if (collections.length) {
        const balances = await Promise.all(
          collections.map(({ contract }) =>
            contract?.balanceOf?.(activeAccount).catch(() => 0n),
          ),
        );
        totalTokens = balances.reduce(
          (sum, balance) => sum + Number(balance || 0),
          0,
        );
      }

      let tickets = null;
      if (ticketHub?.balanceOf) {
        const balance = await ticketHub
          .balanceOf(activeAccount)
          .catch(() => null);
        if (balance != null) tickets = Number(balance);
      }

      const nfts = totalTokens;

      setOverview({
        loading: false,
        error: null,
        native,
        biggi,
        totalTokens,
        tickets,
        nfts,
        updatedAt: Date.now(),
      });
    } catch (err) {
      setOverview((prev) => ({
        ...prev,
        loading: false,
        error: err,
      }));
    }
  }, [activeAccount, provider, contracts]);

  React.useEffect(() => {
    refreshOverview();
  }, [refreshOverview, chainId, activeAccount]);

  const buildTxLink = React.useCallback(
    (hash, chainIdOverride) => {
      if (!hash) return "";
      const base = explorerBaseFor(chainIdOverride || chainId);
      return base ? `${base}/tx/${hash}` : "";
    },
    [chainId],
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
    Number.isFinite(Number(overview.tickets)) && Number(overview.tickets) > 0;
  const hasNFTs =
    Number.isFinite(Number(overview.nfts)) && Number(overview.nfts) > 0;
  const claimableValue = Number(claimable);
  const claimableKnown = Number.isFinite(claimableValue);
  const canClaim =
    connected &&
    (claimableKnown ? claimableValue > 0 : hasNFTs || previewItems.length > 0);
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
              chainId: txStatus.chainId || chainId || null,
              ts: Date.now(),
            },
          ]
        : [];
  const ticketPriceLabel =
    ticketPrice != null ? formatNative(ticketPrice, 4) : "--";
  const claimableLabel = claimableKnown ? formatToken(claimableValue, 4) : "--";
  const rewardPoolLabel =
    rewardPool != null ? formatNative(rewardPool, 4) : "--";
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
  const claimLabel = isClaiming ? "Claiming..." : "Claim rewards";
  const mintDisabled = !connected || actionBusy || typeof onMint !== "function";
  const redeemDisabled =
    !connected || actionBusy || !canRedeem || typeof onRedeem !== "function";
  const claimDisabled =
    !connected || actionBusy || !canClaim || typeof onClaim !== "function";
  const lastUpdatedLabel = overview.updatedAt
    ? new Date(overview.updatedAt).toLocaleTimeString()
    : "--";

  return (
    <div className={`user-panel${compact ? " user-panel--compact" : ""}`}>
      <section className="user-panel__surface">
        <header className="user-panel__header">
          <div className="user-panel__headline">
            <h2 className="user-panel__title">User Panel</h2>
            <p className="user-panel__subtitle">
              Personal cockpit for wallet health, quick actions, referrals, and
              portfolio diagnostics. Monitor balances, execute key flows, and
              verify core contract shortcuts without jumping across multiple
              tabs.
            </p>
          </div>
          <div className="user-panel__header-actions">
            <button
              type="button"
              className="user-panel__btn user-panel__btn--accent"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {connected ? "Wallet connected" : "Connect wallet"}
            </button>
            <PanelInfoButton
              className="panel-info-btn--transparent"
              onClick={() => setInfoOpen(true)}
              ariaLabel="User panel buttons info"
            />
          </div>
        </header>

        <div className="user-panel__hero">
          <div className="user-panel__hero-grid">
            <div className="user-panel__hero-card">
              <span className="user-panel__hero-label">Wallet status</span>
              <span className="user-panel__hero-value">
                {connected ? "Connected" : "Disconnected"}
              </span>
              <span className="user-panel__hero-hint">
                {connected ? shortAddress(activeAccount) : "Connect to begin"}
              </span>
            </div>
            <div className="user-panel__hero-card">
              <span className="user-panel__hero-label">Network</span>
              <span className="user-panel__hero-value">
                {chainNameFor(chainId)}
              </span>
              <span className="user-panel__hero-hint">
                Chain ID: {chainId || "--"}
              </span>
            </div>
            <div className="user-panel__hero-card">
              <span className="user-panel__hero-label">NFTs owned</span>
              <span className="user-panel__hero-value">
                {overview.nfts != null
                  ? formatValue(overview.nfts, 0)
                  : overview.totalTokens != null
                    ? formatValue(overview.totalTokens, 0)
                    : "--"}
              </span>
              <span className="user-panel__hero-hint">
                {hasNFTs ? "Collected & revealed" : "No NFTs yet"}
              </span>
            </div>
            <div className="user-panel__hero-card">
              <span className="user-panel__hero-label">Tickets</span>
              <span className="user-panel__hero-value">
                {overview.tickets != null
                  ? formatValue(overview.tickets, 0)
                  : "--"}
              </span>
              <span className="user-panel__hero-hint">
                {canRedeem ? "Redeem ready" : "No tickets"}
              </span>
            </div>
          </div>

          <div className="user-panel__quick-actions">
            <button
              type="button"
              className="user-panel__btn user-panel__btn--ghost"
              onClick={handleCopy}
              disabled={!referralLink}
            >
              {copied ? "Copied" : "Copy referral"}
            </button>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--ghost"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {connected ? "Refresh connection" : "Connect MetaMask"}
            </button>
          </div>
        </div>

        <div className="user-panel__visuals">
          <div className="user-panel__card user-panel__card--visual">
            <div className="user-panel__card-head">
              <h3>Connection health</h3>
              <span className="user-panel__chip">
                {connected ? "Online" : "Offline"}
              </span>
            </div>
            <div className="user-panel__visual-body">
              <div
                className="user-panel__chart-ring"
                style={{ "--pct": connectionPct }}
              >
                <div className="user-panel__chart-ring-center">
                  <strong>{connectionPct}%</strong>
                  <span>Status</span>
                </div>
              </div>
              <div className="user-panel__visual-meta">
                <div>
                  <span className="user-panel__meta-label">Wallet</span>
                  <span className="user-panel__meta-value">
                    {connected ? shortAddress(activeAccount) : "--"}
                  </span>
                </div>
                <div className="user-panel__meta-bar">
                  <span style={{ width: `${connectionPct}%` }} />
                </div>
                <div>
                  <span className="user-panel__meta-label">Network</span>
                  <span className="user-panel__meta-value">
                    {chainNameFor(chainId)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="user-panel__card user-panel__card--visual">
            <div className="user-panel__card-head">
              <h3>Referral readiness</h3>
              <span className="user-panel__chip user-panel__chip--cyan">
                {referralLink ? "Active" : "Locked"}
              </span>
            </div>
            <div className="user-panel__visual-body">
              <div
                className="user-panel__chart-ring user-panel__chart-ring--cyan"
                style={{ "--pct": referralPct }}
              >
                <div className="user-panel__chart-ring-center">
                  <strong>{referralPct}%</strong>
                  <span>Link</span>
                </div>
              </div>
              <div className="user-panel__visual-meta">
                <div>
                  <span className="user-panel__meta-label">Referral link</span>
                  <span className="user-panel__meta-value">
                    {referralLink ? "Generated" : "Not set"}
                  </span>
                </div>
                <div className="user-panel__meta-bar user-panel__meta-bar--cyan">
                  <span style={{ width: `${referralPct}%` }} />
                </div>
                <div>
                  <span className="user-panel__meta-label">Copy status</span>
                  <span className="user-panel__meta-value">
                    {copied ? "Copied" : "Ready"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="user-panel__grid user-panel__grid--primary">
          <div className="user-panel__card">
            <h3>Action center</h3>
            <p className="user-panel__muted">
              Fast mint, redeem, and claim with live status.
            </p>
            <div className="user-panel__statline">
              <span>Ticket price</span>
              <strong>{ticketPriceLabel}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Claimable</span>
              <strong>{claimableLabel}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Weekly pool</span>
              <strong>{rewardPoolLabel}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Mint volume</span>
              <strong>{mintVolumeLabel}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Minted supply</span>
              <strong>{supplyLabel}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Tickets left</span>
              <strong>{ticketsLeftLabel}</strong>
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
              className={
                actionBusy ? "user-panel__alert" : "user-panel__status"
              }
            >
              {statusText}
            </div>
            {latestTxLink ? (
              <a
                className="user-panel__link"
                href={latestTxLink}
                target="_blank"
                rel="noreferrer"
              >
                View latest transaction
              </a>
            ) : (
              <div className="user-panel__muted">Latest tx: --</div>
            )}
          </div>

          <div className="user-panel__card">
            <h3>Holdings</h3>
            <p className="user-panel__muted">
              Quick snapshot of balances and redeem readiness.
            </p>
            <div className="user-panel__statline">
              <span>POL balance</span>
              <strong>{formatNative(overview.native, 4)}</strong>
            </div>
            <div className="user-panel__statline">
              <span>BIGGI balance</span>
              <strong>{formatToken(overview.biggi, 4)}</strong>
            </div>
            <div className="user-panel__statline">
              <span>NFTs across chapters</span>
              <strong>
                {overview.totalTokens != null
                  ? formatValue(overview.totalTokens, 0)
                  : "--"}
              </strong>
            </div>
            <div className="user-panel__statline">
              <span>Tickets</span>
              <strong>
                {overview.tickets != null
                  ? formatValue(overview.tickets, 0)
                  : "--"}
              </strong>
            </div>
            <div
              className={canRedeem ? "user-panel__status" : "user-panel__alert"}
            >
              {connected
                ? canRedeem
                  ? "Redeem ready: use the Redeem button in Action Center."
                  : "No ticket to redeem yet."
                : "Connect wallet to see balances."}
            </div>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--ghost user-panel__btn--wide"
              onClick={refreshOverview}
              disabled={!connected || overview.loading}
            >
              {overview.loading ? "Refreshing..." : "Refresh balances"}
            </button>
            <div className="user-panel__muted">
              Last update: {lastUpdatedLabel}
            </div>
          </div>

          <div className="user-panel__card user-panel__card--community">
            <h3>Community Center</h3>
            <p className="user-panel__muted">
              Wallet-specific community event rewards and voting status from the
              Polygon mainnet Community Center.
            </p>
            <div className="user-panel__statline">
              <span>Contract</span>
              <ExplorerLink
                address={communitySnapshot.address}
                chainId={ADDR.CHAIN_ID || chainId}
                label={shortAddress(communitySnapshot.address)}
              />
            </div>
            <div className="user-panel__statline">
              <span>Status</span>
              <strong>
                {communitySnapshot.configured
                  ? communitySnapshot.paused
                    ? "Paused"
                    : "Live"
                  : "Missing"}
              </strong>
            </div>
            <div className="user-panel__statline">
              <span>Events tracked</span>
              <strong>{formatValue(communitySnapshot.eventsCount, 0)}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Assigned events</span>
              <strong>
                {formatValue(communitySnapshot.assignedEvents, 0)}
              </strong>
            </div>
            <div className="user-panel__statline">
              <span>Claimable events</span>
              <strong>
                {formatValue(communitySnapshot.claimableEvents, 0)}
              </strong>
            </div>
            <div className="user-panel__statline">
              <span>Claimable POL</span>
              <strong>{communityClaimableLabel}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Assigned POL</span>
              <strong>{communityAssignedLabel}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Pool / locked</span>
              <strong>
                {communityPoolLabel} / {communityLockedLabel}
              </strong>
            </div>
            <div className="user-panel__statline">
              <span>Live polls</span>
              <strong>{formatValue(communitySnapshot.livePolls, 0)}</strong>
            </div>
            <div
              className={
                communitySnapshot.claimableEvents > 0
                  ? "user-panel__status"
                  : "user-panel__alert"
              }
            >
              {!connected
                ? "Connect wallet to see Community Center assignments."
                : communityError
                  ? "Community snapshot fallback is active."
                  : communitySnapshot.claimableEvents > 0
                    ? "Community prize is ready to claim in Community Center."
                    : "No community prize claimable for this wallet right now."}
            </div>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--ghost user-panel__btn--wide"
              onClick={refreshCommunitySnapshot}
              disabled={communityLoading}
            >
              {communityLoading ? "Refreshing..." : "Refresh Community Center"}
            </button>
          </div>

          <div className="user-panel__card">
            <h3>Recent activity</h3>
            <p className="user-panel__muted">
              Latest on-chain actions and confirmations.
            </p>
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
                      <div className="user-panel__activity-main">
                        <span className="user-panel__activity-type">
                          {formatTxType(item?.type)}
                        </span>
                        <span className="user-panel__activity-stage">
                          {formatTxStage(item?.stage)}
                        </span>
                      </div>
                      <div className="user-panel__activity-meta">
                        <span>{timeLabel}</span>
                        {link ? (
                          <a
                            className="user-panel__activity-link"
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Tx
                          </a>
                        ) : (
                          <span>--</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="user-panel__muted">
                No activity yet. Mint or redeem to begin.
              </div>
            )}
          </div>

          <div className="user-panel__card">
            <h3>Your NFTs</h3>
            <p className="user-panel__muted">
              Latest minted NFTs and tickets in your wallet.
            </p>
            {previewItems.length ? (
              <div className="user-panel__nft-grid">
                {previewItems.map((item, idx) => (
                  <div
                    key={item?.tokenId || item?.id || `nft-${idx}`}
                    className="user-panel__nft-item"
                  >
                    <img
                      className="user-panel__nft-image"
                      src={item?.image || "/images/Biggi.png"}
                      alt={item?.meta?.name || "NFT"}
                      loading="lazy"
                    />
                    <span className="user-panel__nft-id">
                      #{item?.tokenId ?? "--"}
                    </span>
                    <span className="user-panel__nft-tag">
                      {item?.isTicket ? "Ticket" : "NFT"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="user-panel__alert">
                No NFTs yet. Mint a ticket to get started.
              </div>
            )}
          </div>

          <div className="user-panel__card">
            <h3>Wallet</h3>
            <div className="user-panel__statline">
              <span>Address</span>
              <strong>{connected ? shortAddress(activeAccount) : "--"}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Network</span>
              <strong>{chainNameFor(chainId)}</strong>
            </div>
            <div className="user-panel__statline">
              <span>Explorer</span>
              <ExplorerLink
                address={activeAccount}
                chainId={chainId}
                label={connected ? "Open wallet" : "--"}
              />
            </div>
          </div>

          <div className="user-panel__card">
            <h3>Referral</h3>
            <p className="user-panel__muted">
              Share your referral link to track verified community invites.
            </p>
            <div className="user-panel__statline">
              <input
                type="text"
                readOnly
                value={referralLink || "Connect wallet to generate link"}
                style={{ width: "100%" }}
              />
            </div>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--ghost user-panel__btn--wide"
              onClick={handleCopy}
              disabled={!referralLink}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          <div className="user-panel__card">
            <h3>Contracts</h3>
            <div className="user-panel__grid user-panel__grid--secondary">
              {contractLinks.map((item) => (
                <div key={item.label} className="user-panel__statline">
                  <span>{item.label}</span>
                  <ExplorerLink
                    address={item.address}
                    chainId={chainId}
                    label={shortAddress(item.address)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="user-panel__grid user-panel__grid--stats">
          <div className="user-panel__stat-card">
            <span className="user-panel__stat-icon">Chain</span>
            <div>
              <span className="user-panel__stat-label">Chain ID</span>
              <span className="user-panel__stat-value">{chainId || "--"}</span>
            </div>
          </div>
          <div className="user-panel__stat-card">
            <span className="user-panel__stat-icon">Wallet</span>
            <div>
              <span className="user-panel__stat-label">Status</span>
              <span className="user-panel__stat-value">
                {connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div className="user-panel__stat-card">
            <span className="user-panel__stat-icon">Referral</span>
            <div>
              <span className="user-panel__stat-label">Link</span>
              <span className="user-panel__stat-value">
                {referralLink ? "Active" : "Locked"}
              </span>
            </div>
          </div>
          <div className="user-panel__stat-card">
            <span className="user-panel__stat-icon">Core</span>
            <div>
              <span className="user-panel__stat-label">Contracts</span>
              <span className="user-panel__stat-value">
                {contractLinks.length}
              </span>
            </div>
          </div>
        </div>

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
