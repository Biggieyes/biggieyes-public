import * as React from "react";
import { ethers } from "ethers";
import "./UserPanel.css";
import { useWeb3 } from "../../providers/Web3Provider";
import { useContracts } from "../../providers/ContractsProvider";
import { getFrontendSnapshotLiteActive } from "../../utils/contract";

const DEPLOY_BLOCK = 27105642;
const DEFAULT_MAX_SUPPLY = 550;

const FALLBACK_STATS = {
  ticketPrice: null,
  ticketPriceWei: null,
  totalMinted: null,
  ticketsMinted: null,
  maxSupply: null,
  rewardPool: null,
  claimable: null,
  biggiBalance: null,
  nativeBalance: null,
};

const STAT_LABELS = [
  { key: "totalMinted", label: "Minted", icon: "MINT" },
  { key: "maxSupply", label: "Max Supply", icon: "MAX" },
  { key: "ticketsMinted", label: "Tickets Minted", icon: "TIX" },
  { key: "ticketsLeft", label: "Tickets Left", icon: "LEFT" },
  { key: "rewardPool", label: "Reward Pool", icon: "POOL" },
  { key: "mintVolume", label: "Mint Volume", icon: "VOL" },
  { key: "tokenPrice", label: "Token Price", icon: "PRICE" },
  { key: "sharePercent", label: "Reward Share", icon: "SHARE" },
];

function truncateAddress(address) {
  if (!address) return "--";
  const value = String(address);
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatNumber(value, options = {}) {
  if (value == null || Number.isNaN(Number(value))) return "--";
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  });
  return formatter.format(Number(value));
}

async function callFirst(contract, candidates = []) {
  if (!contract) return null;
  for (const name of candidates) {
    const fn = contract?.[name];
    if (typeof fn === "function") {
      try {
        const result = await fn();
        if (result != null) return result;
      } catch {
        // ignore and try next
      }
    }
  }
  return null;
}

function useItemsKey(items = []) {
  return React.useMemo(() => {
    const ids = items
      .filter((item) => item && !item.isTicket)
      .map((item) => String(item.tokenId || item.id || ""))
      .filter(Boolean)
      .sort();
    return JSON.stringify(ids);
  }, [items]);
}

async function resolveHeldTokenIds({ address, items, mainContract }) {
  const explicitIds = (items || [])
    .filter((item) => item && !item.isTicket)
    .map((item) => ethers.BigNumber.from(item.tokenId));
  if (explicitIds.length || !address || !mainContract) {
    return explicitIds;
  }

  const latest = await mainContract.provider.getBlockNumber();
  const fromBlock = DEPLOY_BLOCK;

  const toFilter = mainContract.filters.Transfer(null, address, null);
  const fromFilter = mainContract.filters.Transfer(address, null, null);
  const [toLogs, fromLogs] = await Promise.all([
    mainContract.queryFilter(toFilter, fromBlock, latest),
    mainContract.queryFilter(fromFilter, fromBlock, latest),
  ]);

  const allLogs = [...toLogs, ...fromLogs].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    return a.logIndex - b.logIndex;
  });

  const owned = new Set();
  const me = String(address).toLowerCase();

  for (const log of allLogs) {
    const from = String(log.args?.from ?? log.args?.[0] ?? "").toLowerCase();
    const to = String(log.args?.to ?? log.args?.[1] ?? "").toLowerCase();
    const tokenId = (log.args?.tokenId ?? log.args?.[2])?.toString?.() || "";
    if (!tokenId) continue;
    if (to === me) owned.add(tokenId);
    if (from === me) owned.delete(tokenId);
  }

  const output = [];
  for (const tokenId of owned) {
    try {
      const isTicket =
        typeof mainContract.isTicket === "function"
          ? await mainContract.isTicket(tokenId)
          : false;
      if (!isTicket) output.push(ethers.BigNumber.from(tokenId));
    } catch {
      output.push(ethers.BigNumber.from(tokenId));
    }
  }
  return output;
}

function useUserPanelData({
  address,
  items,
  ticketPriceProp,
  mintedProp,
  maxSupplyProp,
  ticketsLeftProp,
  claimableProp,
  rewardPoolProp,
  nativeBalanceProp,
  biggiBalanceProp,
  tokenPriceProp,
  mintVolumeProp,
  sharePercentProp,
}) {
  const { provider, ensureChain } = useWeb3();
  const contracts = useContracts();
  const itemsKey = useItemsKey(items);

  const [chainStats, setChainStats] = React.useState(FALLBACK_STATS);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchOnChainData = React.useCallback(async () => {
    if (!contracts) return;
    setLoading(true);
    setError(null);

    let mounted = true;
    const nextState = { ...FALLBACK_STATS };

    try {
      const reader = contracts.readerRead?.();
      if (reader) {
        const snapshot = await getFrontendSnapshotLiteActive(reader);
        nextState.ticketPriceWei = snapshot?.[0] ?? null;
        nextState.ticketPrice = snapshot?.[0]
          ? Number(ethers.utils.formatEther(snapshot[0]))
          : null;
        nextState.ticketsMinted =
          snapshot?.[1] != null ? Number(snapshot[1]) : null;
        nextState.totalMinted =
          snapshot?.[2] != null ? Number(snapshot[2]) : null;
      }
    } catch (err) {
      console.error("UserPanel: reader snapshot failed", err);
      setError((prev) => prev || "Unable to load supply snapshot.");
    }

    try {
      const liquidity = contracts.liqRO?.();
      if (liquidity) {
        const reward = await callFirst(liquidity, [
          "currentWeekPool",
          "weeklyPool",
          "rewardPool",
        ]);
        if (reward) {
          nextState.rewardPool = Number(ethers.utils.formatEther(reward));
        }
      }
    } catch (err) {
      console.error("UserPanel: reward pool fetch failed", err);
    }

    if (address) {
      try {
        const main = contracts.mainRead?.();
        const heldIds = await resolveHeldTokenIds({
          address,
          items,
          mainContract: main,
        });

        const liquidity = contracts.liqRO?.();
        if (liquidity && heldIds.length) {
          const [, amount] = await liquidity.claimablePreview(heldIds);
          nextState.claimable = Number(ethers.utils.formatEther(amount));
        } else if (heldIds.length === 0) {
          nextState.claimable = 0;
        }
      } catch (err) {
        console.error("UserPanel: claimable preview failed", err);
      }

      try {
        const token = contracts.tokenRead?.();
        if (token) {
          const balance = await token.balanceOf(address);
          nextState.biggiBalance = Number(ethers.utils.formatEther(balance));
        }
      } catch (err) {
        console.error("UserPanel: token balance failed", err);
      }

      try {
        if (provider) {
          const nativeBal = await provider.getBalance(address);
          nextState.nativeBalance = Number(ethers.utils.formatEther(nativeBal));
        }
      } catch (err) {
        console.error("UserPanel: native balance failed", err);
      }
    }

    if (mounted) {
      setChainStats(nextState);
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [contracts, address, items, provider]);

  React.useEffect(() => {
    fetchOnChainData();
  }, [fetchOnChainData, itemsKey]);

  const summary = React.useMemo(() => {
    const maxSupply =
      maxSupplyProp ?? chainStats.maxSupply ?? DEFAULT_MAX_SUPPLY;
    const totalMinted = mintedProp ?? chainStats.totalMinted;
    const ticketsMinted = chainStats.ticketsMinted;
    const ticketsLeft =
      ticketsLeftProp ??
      (maxSupply != null && ticketsMinted != null
        ? Math.max(0, maxSupply - ticketsMinted)
        : null);

    return {
      ticketPrice: ticketPriceProp ?? chainStats.ticketPrice,
      ticketPriceWei: chainStats.ticketPriceWei,
      totalMinted,
      maxSupply,
      ticketsMinted,
      ticketsLeft,
      rewardPool: rewardPoolProp ?? chainStats.rewardPool,
      claimable: claimableProp ?? chainStats.claimable,
      biggiBalance: biggiBalanceProp ?? chainStats.biggiBalance,
      nativeBalance: nativeBalanceProp ?? chainStats.nativeBalance,
      tokenPrice: tokenPriceProp ?? null,
      mintVolume: mintVolumeProp ?? null,
      sharePercent: sharePercentProp ?? null,
    };
  }, [
    chainStats,
    ticketPriceProp,
    mintedProp,
    maxSupplyProp,
    ticketsLeftProp,
    claimableProp,
    rewardPoolProp,
    biggiBalanceProp,
    nativeBalanceProp,
    tokenPriceProp,
    mintVolumeProp,
    sharePercentProp,
  ]);

  return {
    summary,
    loading,
    error,
    refresh: fetchOnChainData,
    ensureChain,
  };
}

export default function UserPanel({
  address = "",
  onConnect,
  onMint,
  onClaim,
  ticketPrice: ticketPriceProp,
  minted: mintedProp,
  maxSupply: maxSupplyProp,
  ticketsLeft: ticketsLeftProp,
  claimable: claimableProp,
  rewardPool: rewardPoolProp,
  nativeBalance: nativeBalanceProp,
  biggiBalance: biggiBalanceProp,
  mintVolumeMatic,
  sharePercent,
  tokenPrice,
  liquidityPool,
  galleryUrl,
  dexUrl,
  items = [],
  compact = false,
}) {
  const { account, connectMetaMask, isConnecting, ensureChain } = useWeb3();
  const contracts = useContracts();
  const [actionStatus, setActionStatus] = React.useState("");
  const [isMinting, setIsMinting] = React.useState(false);
  const [isClaiming, setIsClaiming] = React.useState(false);

  const { summary, loading, error, refresh } = useUserPanelData({
    address,
    items,
    ticketPriceProp,
    mintedProp,
    maxSupplyProp,
    ticketsLeftProp,
    claimableProp,
    rewardPoolProp,
    nativeBalanceProp,
    biggiBalanceProp,
    mintVolumeProp: mintVolumeMatic,
    sharePercentProp: sharePercent,
    tokenPriceProp: tokenPrice,
  });

  const nonTicketIds = React.useMemo(
    () =>
      items
        .filter((item) => item && !item.isTicket)
        .map((item) => ethers.BigNumber.from(item.tokenId)),
    [items],
  );

  const ticketsHeld = React.useMemo(
    () => items.filter((item) => item && item.isTicket).length,
    [items],
  );

  const hasWallet = Boolean(address);

  const ticketPriceLabel =
    summary.ticketPrice != null
      ? `${formatNumber(summary.ticketPrice, { maximumFractionDigits: 4 })} POL`
      : "--";

  const claimableLabel =
    summary.claimable != null
      ? `${formatNumber(summary.claimable, { maximumFractionDigits: 4 })} BIGGI`
      : "--";

  const mintedPercent = React.useMemo(() => {
    if (
      summary.maxSupply &&
      summary.totalMinted != null &&
      summary.maxSupply > 0
    ) {
      return Math.min(
        100,
        Math.max(0, (summary.totalMinted / summary.maxSupply) * 100),
      );
    }
    return null;
  }, [summary.totalMinted, summary.maxSupply]);

  const rewardCoveragePercent = React.useMemo(() => {
    if (
      summary.rewardPool != null &&
      summary.rewardPool > 0 &&
      summary.claimable != null
    ) {
      return Math.min(
        100,
        Math.max(0, (summary.claimable / summary.rewardPool) * 100),
      );
    }
    if (summary.claimable === 0) return 0;
    return null;
  }, [summary.rewardPool, summary.claimable]);

  const heroStats = React.useMemo(() => {
    const ticketsLeftValue =
      summary.ticketsLeft ??
      (summary.maxSupply != null && summary.ticketsMinted != null
        ? Math.max(0, summary.maxSupply - summary.ticketsMinted)
        : null);

    return [
      {
        key: "wallet",
        label: "Wallet",
        value: hasWallet ? truncateAddress(address) : "Not connected",
        hint: hasWallet
          ? `${formatNumber(nonTicketIds.length)} NFTs / ${formatNumber(ticketsHeld)} tickets`
          : "Connect to manage assets",
      },
      {
        key: "claimable",
        label: "Claimable",
        value: claimableLabel,
        hint: summary.claimable ? "Ready to harvest" : "Accruing weekly",
      },
      {
        key: "ticketPrice",
        label: "Ticket Price",
        value: ticketPriceLabel,
        hint: "Polygon Amoy",
      },
      {
        key: "rewardPool",
        label: "Reward Pool",
        value:
          summary.rewardPool != null
            ? `${formatNumber(summary.rewardPool, { maximumFractionDigits: 2 })} BIGGI`
            : "--",
        hint: "Current weekly pool",
      },
      {
        key: "ticketsLeft",
        label: "Tickets Left",
        value: formatNumber(ticketsLeftValue),
        hint: "Until supply cap",
      },
    ];
  }, [
    address,
    hasWallet,
    nonTicketIds.length,
    ticketsHeld,
    summary.claimable,
    summary.rewardPool,
    summary.ticketsLeft,
    summary.maxSupply,
    summary.ticketsMinted,
    ticketPriceLabel,
    claimableLabel,
  ]);

  const handleConnect = React.useCallback(async () => {
    if (onConnect) {
      await onConnect();
      return;
    }
    await connectMetaMask();
  }, [connectMetaMask, onConnect]);

  const handleMint = React.useCallback(async () => {
    if (isMinting) return;
    setActionStatus("");
    setIsMinting(true);
    try {
      if (onMint) {
        await onMint();
      } else {
        await ensureChain?.(80002);
        const main = contracts.mainWrite?.();
        if (!main) throw new Error("Main contract unavailable");

        let value = summary.ticketPriceWei;
        if (!value) {
          const reader = contracts.readerRead?.();
          if (reader) {
            const snapshot = await getFrontendSnapshotLiteActive(reader);
            value = snapshot?.[0];
          }
        }
        if (!value) throw new Error("Ticket price unavailable");
        const tx = await main.mintTicket({ value });
        await tx.wait();
      }
      await refresh();
      setActionStatus("Mint successful.");
    } catch (err) {
      console.error("UserPanel: mint failed", err);
      setActionStatus(err?.message || "Mint failed.");
    } finally {
      setIsMinting(false);
    }
  }, [
    onMint,
    ensureChain,
    contracts,
    summary.ticketPriceWei,
    refresh,
    isMinting,
  ]);

  const handleClaim = React.useCallback(async () => {
    if (isClaiming) return;
    setActionStatus("");
    setIsClaiming(true);
    try {
      const tokenIds =
        nonTicketIds.length > 0
          ? nonTicketIds
          : await resolveHeldTokenIds({
              address,
              items,
              mainContract: contracts.mainRead?.(),
            });

      if (!tokenIds.length) {
        throw new Error("No eligible NFTs to claim.");
      }

      if (onClaim) {
        await onClaim(tokenIds);
      } else {
        await ensureChain?.(80002);
        const liquidity = contracts.liqRW?.();
        if (!liquidity) throw new Error("Rewards contract unavailable");
        const tx = await liquidity.claim(tokenIds);
        await tx.wait();
      }

      await refresh();
      setActionStatus("Rewards claimed.");
    } catch (err) {
      console.error("UserPanel: claim failed", err);
      setActionStatus(err?.message || "Claim failed.");
    } finally {
      setIsClaiming(false);
    }
  }, [
    onClaim,
    ensureChain,
    contracts,
    nonTicketIds,
    address,
    items,
    refresh,
    isClaiming,
  ]);

  const handleRefresh = React.useCallback(async () => {
    setActionStatus("");
    await refresh();
  }, [refresh]);

  const statCards = React.useMemo(() => {
    return STAT_LABELS.map(({ key, label, icon }) => {
      let value;
      switch (key) {
        case "totalMinted":
          value = formatNumber(summary.totalMinted);
          break;
        case "maxSupply":
          value = formatNumber(summary.maxSupply);
          break;
        case "ticketsMinted":
          value = formatNumber(summary.ticketsMinted);
          break;
        case "ticketsLeft":
          value = formatNumber(
            summary.ticketsLeft ??
              (summary.maxSupply != null && summary.ticketsMinted != null
                ? Math.max(0, summary.maxSupply - summary.ticketsMinted)
                : null),
          );
          break;
        case "rewardPool":
          value =
            summary.rewardPool != null
              ? `${formatNumber(summary.rewardPool, { maximumFractionDigits: 2 })} BIGGI`
              : "--";
          break;
        case "mintVolume":
          value =
            mintVolumeMatic != null
              ? `${formatNumber(mintVolumeMatic, { maximumFractionDigits: 2 })} POL`
              : "--";
          break;
        case "tokenPrice":
          value =
            tokenPrice != null
              ? `${formatNumber(tokenPrice, { maximumFractionDigits: 4 })} POL`
              : "--";
          break;
        case "sharePercent":
          value =
            sharePercent != null
              ? `${formatNumber(sharePercent, { maximumFractionDigits: 2 })}%`
              : "--";
          break;
        default:
          value = "--";
      }
      return { key, label, icon, value };
    });
  }, [summary, mintVolumeMatic, tokenPrice, sharePercent]);

  return (
    <section className={`user-panel${compact ? " user-panel--compact" : ""}`}>
      <div className="user-panel__surface">
        <header className="user-panel__header panel-header panel-header--user">
          <div>
            <h2 className="user-panel__title">User Control Center</h2>
            <p className="user-panel__subtitle">
              Track your holdings, mint new tickets, and harvest weekly rewards
              directly from the smart contracts.
            </p>
          </div>
          <div className="user-panel__header-actions">
            <button
              type="button"
              className="user-panel__btn user-panel__btn--ghost"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--accent"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting
                ? "Connecting..."
                : hasWallet
                  ? "Wallet Connected"
                  : "Connect Wallet"}
            </button>
          </div>
        </header>

        <div className="user-panel__hero">
          <div className="user-panel__hero-grid">
            {heroStats.map(({ key, label, value, hint }) => (
              <article key={key} className="user-panel__hero-card">
                <span className="user-panel__hero-label">{label}</span>
                <div className="user-panel__hero-value">{value}</div>
                <span className="user-panel__hero-hint">{hint}</span>
              </article>
            ))}
          </div>
          <div className="user-panel__quick-actions">
            <button
              type="button"
              className="user-panel__btn user-panel__btn--ghost"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--accent"
              onClick={handleMint}
              disabled={isMinting}
            >
              {isMinting ? "Minting..." : "Mint Ticket"}
            </button>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--accent"
              onClick={handleClaim}
              disabled={
                isClaiming ||
                summary.claimable == null ||
                summary.claimable === 0
              }
            >
              {isClaiming
                ? "Claiming..."
                : summary.claimable
                  ? "Claim Rewards"
                  : "Nothing to Claim"}
            </button>
          </div>
        </div>

        <div className="user-panel__visuals">
          <article className="user-panel__card user-panel__card--visual">
            <div className="user-panel__card-head">
              <h3>Mint Progress</h3>
              <span className="user-panel__chip">Live</span>
            </div>
            <div className="user-panel__visual-body">
              <div
                className="user-panel__chart-ring"
                style={{ ["--pct"]: mintedPercent != null ? mintedPercent : 0 }}
                aria-label="Minted vs max supply"
              >
                <div className="user-panel__chart-ring-center">
                  <strong>
                    {mintedPercent != null
                      ? `${formatNumber(mintedPercent, { maximumFractionDigits: 1 })}%`
                      : "--"}
                  </strong>
                  <span>Minted</span>
                </div>
              </div>
              <div className="user-panel__visual-meta">
                <div>
                  <span className="user-panel__meta-label">Total Minted</span>
                  <span className="user-panel__meta-value">
                    {formatNumber(summary.totalMinted)}
                  </span>
                </div>
                <div>
                  <span className="user-panel__meta-label">Max Supply</span>
                  <span className="user-panel__meta-value">
                    {formatNumber(summary.maxSupply)}
                  </span>
                </div>
                <div className="user-panel__meta-bar">
                  <span
                    style={{
                      width: `${mintedPercent != null ? mintedPercent : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </article>

          <article className="user-panel__card user-panel__card--visual">
            <div className="user-panel__card-head">
              <h3>Rewards Snapshot</h3>
              <span className="user-panel__chip user-panel__chip--cyan">
                BIGGI
              </span>
            </div>
            <div className="user-panel__visual-body">
              <div
                className="user-panel__chart-ring user-panel__chart-ring--cyan"
                style={{
                  ["--pct"]:
                    rewardCoveragePercent != null ? rewardCoveragePercent : 0,
                }}
                aria-label="Claimable vs pool"
              >
                <div className="user-panel__chart-ring-center">
                  <strong>
                    {rewardCoveragePercent != null
                      ? `${formatNumber(rewardCoveragePercent, { maximumFractionDigits: 1 })}%`
                      : "--"}
                  </strong>
                  <span>Claimable share</span>
                </div>
              </div>
              <div className="user-panel__visual-meta">
                <div>
                  <span className="user-panel__meta-label">Reward Pool</span>
                  <span className="user-panel__meta-value">
                    {summary.rewardPool != null
                      ? `${formatNumber(summary.rewardPool, { maximumFractionDigits: 2 })} BIGGI`
                      : "--"}
                  </span>
                </div>
                <div>
                  <span className="user-panel__meta-label">Claimable</span>
                  <span className="user-panel__meta-value">
                    {claimableLabel}
                  </span>
                </div>
                <div className="user-panel__meta-bar user-panel__meta-bar--cyan">
                  <span
                    style={{
                      width: `${rewardCoveragePercent != null ? rewardCoveragePercent : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </article>
        </div>

        {error && <div className="user-panel__alert">{error}</div>}

        {actionStatus && (
          <div className="user-panel__status">{actionStatus}</div>
        )}

        <div className="user-panel__grid user-panel__grid--primary">
          <article className="user-panel__card user-panel__card--wallet">
            <h3>Wallet Overview</h3>
            <dl className="user-panel__list">
              <div>
                <dt>Address</dt>
                <dd>
                  {hasWallet ? truncateAddress(address) : "Not connected"}
                </dd>
              </div>
              <div>
                <dt>Native Balance</dt>
                <dd>
                  {summary.nativeBalance != null
                    ? `${formatNumber(summary.nativeBalance, { maximumFractionDigits: 4 })} POL`
                    : "--"}
                </dd>
              </div>
              <div>
                <dt>BIGGI Balance</dt>
                <dd>
                  {summary.biggiBalance != null
                    ? `${formatNumber(summary.biggiBalance, { maximumFractionDigits: 4 })} BIGGI`
                    : "--"}
                </dd>
              </div>
              <div>
                <dt>NFTs Held</dt>
                <dd>{formatNumber(nonTicketIds.length)}</dd>
              </div>
              <div>
                <dt>Tickets Held</dt>
                <dd>{formatNumber(ticketsHeld)}</dd>
              </div>
            </dl>
            <div className="user-panel__links">
              {galleryUrl && (
                <a href={galleryUrl} target="_blank" rel="noreferrer">
                  View Gallery
                </a>
              )}
              {dexUrl && (
                <a href={dexUrl} target="_blank" rel="noreferrer">
                  Buy on DEX
                </a>
              )}
            </div>
          </article>

          <article className="user-panel__card">
            <h3>Mint Ticket</h3>
            <p className="user-panel__muted">
              Mint price updates directly from the contract. Make sure you are
              on the Polygon Amoy network.
            </p>
            <div className="user-panel__statline">
              <span>Current Price</span>
              <strong>{ticketPriceLabel}</strong>
            </div>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--accent user-panel__btn--wide"
              onClick={handleMint}
              disabled={isMinting}
            >
              {isMinting ? "Minting..." : "Mint Ticket"}
            </button>
          </article>

          <article className="user-panel__card">
            <h3>Claim Rewards</h3>
            <p className="user-panel__muted">
              Weekly reward accrual is based on non-ticket NFTs. Connect your
              wallet to preview the current payout.
            </p>
            <div className="user-panel__statline">
              <span>Claimable</span>
              <strong>{claimableLabel}</strong>
            </div>
            <button
              type="button"
              className="user-panel__btn user-panel__btn--accent user-panel__btn--wide"
              onClick={handleClaim}
              disabled={
                isClaiming ||
                summary.claimable == null ||
                summary.claimable === 0
              }
            >
              {isClaiming
                ? "Claiming..."
                : summary.claimable
                  ? "Claim Rewards"
                  : "Nothing to Claim"}
            </button>
          </article>
        </div>

        <div className="user-panel__grid user-panel__grid--stats">
          {statCards.map(({ key, label, icon, value }) => (
            <article key={key} className="user-panel__stat-card">
              <span className="user-panel__stat-icon" aria-hidden="true">
                {icon}
              </span>
              <div>
                <span className="user-panel__stat-label">{label}</span>
                <span className="user-panel__stat-value">{value}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="user-panel__grid user-panel__grid--secondary">
          <article className="user-panel__card">
            <h3>Liquidity & Treasury</h3>
            <dl className="user-panel__list">
              <div>
                <dt>Liquidity Pool</dt>
                <dd>{liquidityPool ?? "--"}</dd>
              </div>
              <div>
                <dt>Next Reward Share</dt>
                <dd>
                  {sharePercent != null
                    ? `${formatNumber(sharePercent, { maximumFractionDigits: 2 })}%`
                    : "--"}
                </dd>
              </div>
              <div>
                <dt>Mint Volume</dt>
                <dd>
                  {mintVolumeMatic != null
                    ? `${formatNumber(mintVolumeMatic, { maximumFractionDigits: 2 })} POL`
                    : "--"}
                </dd>
              </div>
            </dl>
          </article>

          <article className="user-panel__card">
            <h3>Your Activity</h3>
            <ul className="user-panel__list user-panel__list--bullets">
              <li>
                {summary.totalMinted != null && summary.maxSupply != null
                  ? `You are sharing ${formatNumber(summary.totalMinted)} minted NFTs out of ${formatNumber(summary.maxSupply)} supply.`
                  : "Supply snapshot pending..."}
              </li>
              <li>
                {summary.rewardPool != null
                  ? `Current weekly reward pool is ${formatNumber(summary.rewardPool, { maximumFractionDigits: 2 })} BIGGI.`
                  : "Reward pool not available yet."}
              </li>
              <li>
                {nonTicketIds.length
                  ? `Eligible NFTs detected: ${nonTicketIds.length}.`
                  : "Hold a Biggi NFT to start earning rewards."}
              </li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
