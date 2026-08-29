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

const getEventState = (event, rewards) => {
  if (asNumber(event.kind) === 3) {
    if (event.finished) return { label: "Completed", tone: "is-claimed" };
    if (event.randomnessRequested) {
      return { label: "VRF pending", tone: "is-pending" };
    }
    return { label: "Awaiting VRF", tone: "is-open" };
  }
  const start = asNumber(event.rewardStartId);
  const end = start + asNumber(event.rewardCount);
  const assigned = rewards.some(
    (reward) =>
      reward.rewardId >= start &&
      reward.rewardId < end &&
      isAssigned(reward.assigned),
  );
  return assigned
    ? { label: "Assigned", tone: "is-open" }
    : { label: "Created", tone: "is-pending" };
};

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
    mainContract = null,
    VRFRouter = null,
    vrfRouter = null,
    registry = null,
    owner = null,
    name = null,
    symbol = null,
    mysteryRetryDelay = null,
  } = data || {};

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
    () => [...userRewards].sort((a, b) => b.rewardId - a.rewardId),
    [userRewards],
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
    { label: "NFT Rewards", value: contractAddress },
    { label: "Core main", value: mainContract },
    { label: "VRF router", value: routerAddress },
    { label: "Series registry", value: registry },
    { label: "Owner", value: owner },
  ].filter((row) => isConfiguredAddress(row.value));

  return (
    <section className="rewards-panel__section rewards-panel__section--nft nft-rewards">
      <div className="nft-rewards__container">
        <div className="nft-rewards__summary">
          <article className="nft-rewards__summary-card">
            <span className="nft-rewards__summary-label">Rewards created</span>
            <strong className="nft-rewards__summary-value">
              {formatCount(totalRewardsCreated)}
            </strong>
            <span className="nft-rewards__summary-hint">
              On-chain reward records
            </span>
          </article>
          <article className="nft-rewards__summary-card">
            <span className="nft-rewards__summary-label">NFTs claimed</span>
            <strong className="nft-rewards__summary-value">
              {formatCount(totalClaimed)}
            </strong>
            <span className="nft-rewards__summary-hint">
              {rewardsTruncated ? "Within loaded records" : "Minted by claim"}
            </span>
          </article>
          <article className="nft-rewards__summary-card">
            <span className="nft-rewards__summary-label">Reward events</span>
            <strong className="nft-rewards__summary-value">
              {formatCount(totalEventsCreated)}
            </strong>
            <span className="nft-rewards__summary-hint">
              Manual and VRF mystery
            </span>
          </article>
          <article className="nft-rewards__summary-card">
            <span className="nft-rewards__summary-label">My unclaimed</span>
            <strong className="nft-rewards__summary-value">
              {walletAddress ? formatCount(unclaimedForUser) : "--"}
            </strong>
            <span className="nft-rewards__summary-hint">
              {walletAddress
                ? "Assigned to connected wallet"
                : "Connect wallet"}
            </span>
          </article>
        </div>

        {error ? (
          <div className="nft-rewards__notice is-error" role="alert">
            NFT Rewards data could not be read from Polygon. Try refresh.
          </div>
        ) : null}
        {loading ? (
          <div className="nft-rewards__notice" role="status">
            Syncing NFT Rewards from Polygon...
          </div>
        ) : null}
        {rewardsTruncated ? (
          <div className="nft-rewards__notice" role="status">
            Showing the latest 500 reward records. Use the indexed event history for a complete archive.
          </div>
        ) : null}
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
                  No NFT reward is assigned to this wallet.
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
                          {EVENT_KIND_LABELS[asNumber(reward.kind)] ||
                            "Unknown"}
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
                          claimState === reward.rewardId
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
                <h3>Contract wiring</h3>
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
            {sortedEvents.length === 0 ? (
              <div className="nft-rewards__empty">
                No NFT reward event has been created yet.
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
                    const state = getEventState(event, rewards);
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
                No reward record exists yet.
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
                      <td>
                        {EVENT_KIND_LABELS[asNumber(reward.kind)] || "Unknown"}
                      </td>
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
