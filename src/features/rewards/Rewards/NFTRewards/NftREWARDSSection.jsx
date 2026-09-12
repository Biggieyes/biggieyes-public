import * as React from "react";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EVENT_KIND_LABELS = {
  0: "Undefined",
  1: "Character",
  2: "Manual",
  3: "Mystery",
};

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value?.toString?.() ?? value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  try {
    return BigInt(value.toString()) > 0n;
  } catch {
    return Boolean(value);
  }
};

const isAssigned = (address) =>
  Boolean(address) && String(address).toLowerCase() !== ZERO_ADDRESS;

const isConfiguredAddress = (address) =>
  Boolean(address) && String(address).toLowerCase() !== ZERO_ADDRESS;

const getEventState = (event) => {
  if (asNumber(event.kind) === 3) {
    if (event.finished) return { label: "Draw completed", tone: "is-claimed" };
    if (event.randomnessRequested) {
      return { label: "VRF pending", tone: "is-pending" };
    }
    return { label: "Awaiting VRF", tone: "is-open" };
  }
  // V1 leaves finished=false on manual/character events, but assigns at creation.
  return [1, 2].includes(asNumber(event.kind))
    ? { label: "Assigned", tone: "is-open" }
    : { label: "Created", tone: "is-pending" };
};

function PageControls({ label, page, pages, disabled, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="nft-rewards__pagination" aria-label={`${label} pages`}>
      <span>
        {label}: {page + 1} / {pages}
      </span>
      <button
        type="button"
        className="biggi-btn"
        title={`Newer ${label.toLowerCase()}`}
        aria-label={`Newer ${label.toLowerCase()}`}
        disabled={disabled || page === 0}
        onClick={() => onChange?.(page - 1)}
      >
        <span aria-hidden="true">&larr;</span>
      </button>
      <button
        type="button"
        className="biggi-btn"
        title={`Older ${label.toLowerCase()}`}
        aria-label={`Older ${label.toLowerCase()}`}
        disabled={disabled || page >= pages - 1}
        onClick={() => onChange?.(page + 1)}
      >
        <span aria-hidden="true">&rarr;</span>
      </button>
    </nav>
  );
}

function NftREWARDSSection({
  data,
  loading = false,
  error = null,
  walletAddress,
  formatInteger,
  formatAddress,
  formatUriDisplay,
  onOpenExplorer,
  canClaim = false,
  claimState = null,
  onClaimReward,
  feedback = null,
  onRewardPageChange,
  onEventPageChange,
}) {
  const {
    events = [],
    rewards = [],
    userRewards = [],
    totalEventsCreated = 0,
    totalRewardsCreated = 0,
    totalClaimed = 0,
    rewardsTruncated = false,
    contractAddress = null,
    VRFRouter = null,
    vrfRouter = null,
    owner = null,
    pendingOwner = null,
    readerAddress = null,
    version = null,
    name = null,
    symbol = null,
    mysteryRetryDelay = null,
    rewardPage = 0,
    rewardPages = 1,
    eventPage = 0,
    eventPages = 1,
    firstRewardId,
    lastRewardId,
  } = data || {};
  const unavailable = loading || Boolean(error);
  const emptyState = loading
    ? "Loading on-chain records..."
    : "On-chain records unavailable.";
  const errorLabel =
    error?.message === "NFT Rewards requires Polygon mainnet (137)."
      ? "Switch to Polygon mainnet (137) and refresh NFT Rewards."
      : error?.message === "NFT Rewards reader points to a different contract."
        ? "NFT Rewards contract and reader do not match. Claims are disabled."
        : "NFT Rewards data could not be read from Polygon. Try refresh.";

  const formatCount = (value) =>
    typeof formatInteger === "function"
      ? formatInteger(value ?? 0)
      : String(value ?? 0);
  const formatContract = (address) =>
    typeof formatAddress === "function"
      ? formatAddress(address)
      : address || "--";
  const formatUri = (uri) =>
    typeof formatUriDisplay === "function"
      ? formatUriDisplay(uri)
      : uri || "Not set";
  const sortedEvents = React.useMemo(
    () => [...events].sort((a, b) => b.eventId - a.eventId),
    [events],
  );
  const sortedRewards = React.useMemo(
    () => [...rewards].sort((a, b) => b.rewardId - a.rewardId),
    [rewards],
  );
  const sortedUserRewards = React.useMemo(
    () =>
      userRewards
        .filter(
          (reward) =>
            walletAddress &&
            String(reward.assigned || "").toLowerCase() ===
              walletAddress.toLowerCase(),
        )
        .sort((a, b) => b.rewardId - a.rewardId),
    [userRewards, walletAddress],
  );
  const unclaimedForUser = sortedUserRewards.filter(
    (reward) => !reward.isClaimed,
  ).length;
  const routerAddress = VRFRouter || vrfRouter;
  const retrySeconds = asNumber(mysteryRetryDelay);
  const retryLabel = retrySeconds
    ? `${Math.floor(retrySeconds / 60)} min`
    : "--";
  const wiringRows = [
    {
      label: version === 2 ? "NFT Rewards V2" : "NFT Rewards",
      value: contractAddress,
    },
    { label: "Reader", value: readerAddress },
    {
      label: version === 2 ? "VRF router (immutable)" : "VRF router",
      value: routerAddress,
    },
    { label: "Owner", value: owner },
    { label: "Pending owner", value: pendingOwner },
  ].filter((row) => isConfiguredAddress(row.value));

  return (
    <section className="rewards-panel__section rewards-panel__section--nft nft-rewards">
      <div className="nft-rewards__container">
        <div className="nft-rewards__summary">
          <article className="nft-rewards__summary-card">
            <span className="nft-rewards__summary-label">Rewards created</span>
            <strong className="nft-rewards__summary-value">
              {unavailable ? "--" : formatCount(totalRewardsCreated)}
            </strong>
            <span className="nft-rewards__summary-hint">
              On-chain reward records
            </span>
          </article>
          <article className="nft-rewards__summary-card">
            <span className="nft-rewards__summary-label">NFTs claimed</span>
            <strong className="nft-rewards__summary-value">
              {unavailable ? "--" : formatCount(totalClaimed)}
            </strong>
            <span className="nft-rewards__summary-hint">
              {rewardsTruncated ? "Within loaded records" : "Minted by claim"}
            </span>
          </article>
          <article className="nft-rewards__summary-card">
            <span className="nft-rewards__summary-label">Reward events</span>
            <strong className="nft-rewards__summary-value">
              {unavailable ? "--" : formatCount(totalEventsCreated)}
            </strong>
            <span className="nft-rewards__summary-hint">
              On-chain event records
            </span>
          </article>
          <article className="nft-rewards__summary-card">
            <span className="nft-rewards__summary-label">My unclaimed</span>
            <strong className="nft-rewards__summary-value">
              {walletAddress && !unavailable
                ? formatCount(unclaimedForUser)
                : "--"}
            </strong>
            <span className="nft-rewards__summary-hint">
              {walletAddress
                ? rewardsTruncated
                  ? "Within loaded records"
                  : "Assigned to connected wallet"
                : "Connect wallet"}
            </span>
          </article>
        </div>

        {error ? (
          <div className="nft-rewards__notice is-error" role="alert">
            {errorLabel}
          </div>
        ) : null}
        {loading ? (
          <div className="nft-rewards__notice" role="status">
            Syncing NFT Rewards from Polygon...
          </div>
        ) : null}
        {rewardsTruncated && !unavailable ? (
          <div className="nft-rewards__notice" role="status">
            Reward records #{firstRewardId ?? "--"} - #{lastRewardId ?? "--"} of{" "}
            {formatCount(totalRewardsCreated)}.
          </div>
        ) : null}
        <PageControls
          label="Rewards"
          page={rewardPage}
          pages={rewardPages}
          disabled={unavailable || claimState !== null}
          onChange={onRewardPageChange}
        />
        {feedback ? (
          <div
            className={`nft-rewards__notice ${feedback.tone === "error" ? "is-error" : "is-success"}`}
            role="status"
          >
            {feedback.text}
          </div>
        ) : null}

        <div className="nft-rewards__layout">
          <article className="biggi-card biggi-card--v rewards-panel__card nft-rewards__card">
            <div className="biggi-card__header">
              <div className="biggi-card__heading">
                <h3>My NFT rewards</h3>
                <p>Only rewards assigned on-chain to the connected wallet.</p>
              </div>
            </div>
            <div className="biggi-card__body">
              {!walletAddress ? (
                <div className="nft-rewards__empty">
                  Connect a wallet to check assignments.
                </div>
              ) : sortedUserRewards.length === 0 ? (
                <div className="nft-rewards__empty">
                  {unavailable
                    ? emptyState
                    : rewardsTruncated
                      ? "No NFT reward is assigned to this wallet in these records."
                      : "No NFT reward is assigned to this wallet."}
                </div>
              ) : (
                <div className="nft-rewards__claim-list">
                  {sortedUserRewards.map((reward) => (
                    <div
                      className="nft-rewards__claim-row"
                      key={reward.rewardId}
                    >
                      <div className="nft-rewards__claim-meta">
                        <strong>Reward #{reward.rewardId}</strong>
                        <span>
                          {EVENT_KIND_LABELS[reward.kind] || "Unknown"}
                          {reward.eventId ? ` / Event #${reward.eventId}` : ""}
                        </span>
                        <small title={reward.uri || undefined}>
                          {formatUri(reward.uri)}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="biggi-btn biggi-btn--primary"
                        disabled={
                          reward.isClaimed ||
                          !canClaim ||
                          unavailable ||
                          claimState !== null
                        }
                        onClick={() => onClaimReward?.(reward.rewardId)}
                      >
                        {reward.isClaimed
                          ? "Claimed"
                          : claimState === reward.rewardId
                            ? "Claiming..."
                            : "Claim NFT"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>

          <article className="biggi-card biggi-card--c rewards-panel__card nft-rewards__card">
            <div className="biggi-card__header">
              <div className="biggi-card__heading">
                <h3>Contract details</h3>
                <p>
                  {name || "Biggi Reward"}
                  {symbol ? ` (${symbol})` : ""} on Polygon mainnet.
                </p>
              </div>
            </div>
            <div className="biggi-card__body">
              <div className="nft-rewards__wiring-list">
                {wiringRows.map((row) => (
                  <div className="nft-rewards__wiring-row" key={row.label}>
                    <span>{row.label}</span>
                    <button
                      type="button"
                      className="nft-rewards__address-link"
                      title={row.value || undefined}
                      disabled={!row.value}
                      onClick={() => row.value && onOpenExplorer?.(row.value)}
                    >
                      {formatContract(row.value)}
                    </button>
                  </div>
                ))}
                <div className="nft-rewards__wiring-row">
                  <span>Mystery retry delay</span>
                  <strong>{retryLabel}</strong>
                </div>
              </div>
            </div>
          </article>
        </div>

        <article className="biggi-card biggi-card--y rewards-panel__card nft-rewards__table-card">
          <div className="biggi-card__header">
            <div className="biggi-card__heading">
              <h3>Reward events</h3>
              <p>Live event type, assignment range, and VRF state.</p>
            </div>
          </div>
          <div className="biggi-card__body">
            <PageControls
              label="Events"
              page={eventPage}
              pages={eventPages}
              disabled={unavailable || claimState !== null}
              onChange={onEventPageChange}
            />
            {sortedEvents.length === 0 ? (
              <div className="nft-rewards__empty">
                {unavailable
                  ? emptyState
                  : "No NFT reward event has been created yet."}
              </div>
            ) : (
              <table className="nft-rewards__table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Type</th>
                    <th>Rewards</th>
                    <th>Eligible</th>
                    <th>VRF request</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEvents.map((event) => {
                    const state = getEventState(event);
                    return (
                      <tr key={event.eventId}>
                        <td>#{event.eventId}</td>
                        <td>
                          {EVENT_KIND_LABELS[asNumber(event.kind)] || "Unknown"}
                        </td>
                        <td>
                          #{formatCount(event.rewardStartId)} - #
                          {formatCount(
                            asNumber(event.rewardStartId) +
                              Math.max(0, asNumber(event.rewardCount) - 1),
                          )}
                        </td>
                        <td>{formatCount(event.eligibleCount)}</td>
                        <td>
                          {hasValue(event.vrfRequestId)
                            ? event.vrfRequestId.toString()
                            : "--"}
                        </td>
                        <td>
                          <span className={`nft-rewards__pill ${state.tone}`}>
                            {state.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </article>

        <article className="biggi-card biggi-card--c rewards-panel__card nft-rewards__table-card">
          <div className="biggi-card__header">
            <div className="biggi-card__heading">
              <h3>Reward inventory</h3>
              <p>
                On-chain assignee, metadata URI, and claim state for each
                created reward.
              </p>
            </div>
          </div>
          <div className="biggi-card__body">
            {sortedRewards.length === 0 ? (
              <div className="nft-rewards__empty">
                {unavailable ? emptyState : "No reward record exists yet."}
              </div>
            ) : (
              <table className="nft-rewards__table">
                <thead>
                  <tr>
                    <th>Reward</th>
                    <th>Event</th>
                    <th>Type</th>
                    <th>Assigned to</th>
                    <th>Metadata</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRewards.map((reward) => (
                    <tr key={reward.rewardId}>
                      <td>#{reward.rewardId}</td>
                      <td>{reward.eventId ? `#${reward.eventId}` : "--"}</td>
                      <td>{EVENT_KIND_LABELS[reward.kind] || "Unknown"}</td>
                      <td title={reward.assigned || undefined}>
                        {isAssigned(reward.assigned)
                          ? formatContract(reward.assigned)
                          : "Awaiting assignment"}
                      </td>
                      <td
                        className="nft-rewards__uri-cell"
                        title={reward.uri || undefined}
                      >
                        {formatUri(reward.uri)}
                      </td>
                      <td>
                        <span
                          className={`nft-rewards__pill ${
                            reward.isClaimed
                              ? "is-claimed"
                              : isAssigned(reward.assigned)
                                ? "is-open"
                                : "is-pending"
                          }`}
                        >
                          {reward.isClaimed
                            ? "Claimed"
                            : isAssigned(reward.assigned)
                              ? "Assigned"
                              : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

export default NftREWARDSSection;
