import * as React from "react";
import {
  BLOCK_INDICES,
  ORANGE_MAIN_IDS,
} from "../../../../services/collectionRewardsService";
import { ADDR } from "../../../../utils/addresses";

const FEEDBACK_CLASS = {
  success: "is-success",
  error: "is-error",
};
const WAITING_VALUE = "--";

const thumbnailPath = (segments) => {
  return `/images/${segments.join("/")}`;
};

const orangeThumbnailsForId = (mainId) => {
  if (mainId == null || mainId < 1) return [];
  const folder = `page${mainId}`;
  return Array.from({ length: 10 }, (_, idx) =>
    thumbnailPath(["rewards", "orange", folder, `${idx + 1}.png`]),
  );
};

const blockThumbnailsForId = (blockId) => {
  if (blockId == null || blockId < 1 || blockId > 9) return [];
  const folder = `page${blockId}`;
  const base = (blockId - 1) * 10;
  return Array.from({ length: 10 }, (_, idx) =>
    thumbnailPath(["rewards", "block", folder, `${base + idx + 1}.png`]),
  );
};

const rainbowThumbnails = () =>
  Array.from({ length: 10 }, (_, idx) =>
    thumbnailPath(["rewards", "rainbow", `${idx + 1}.png`]),
  );

const renderThumbnailPlate = (paths = [], label = "Preview") => {
  if (!paths.length) {
    return <span className="rewards-panel__claim-placeholder">{label}</span>;
  }
  return (
    <div className="rewards-panel__claim-thumbnail-row" aria-label={label}>
      {paths.map((src) => (
        <img
          key={src}
          src={src}
          alt={`${label} preview`}
          loading="React.lazy"
          width="56"
          height="56"
        />
      ))}
    </div>
  );
};

function CollectionRewardsSection({
  stats = null,
  statusRows = [],
  formatDecimal,
  rewardPool = null,
  blockPaid = [],
  orangeMainIdPaid = [],
  rainbowClaimed = false,
  claimedOrange = false,
  canClaimCollection = false,
  claimState = { block: null, orange: null, rainbow: false },
  onClaimBlockReward,
  onClaimOrangeReward,
  onClaimRainbowReward,
  metadataRows = [],
  formatAddress,
  feedback,
}) {
  const hasStats = Boolean(stats);
  const blockStatusesLoaded = blockPaid.length === BLOCK_INDICES.length;
  const orangeStatusesLoaded =
    orangeMainIdPaid.length === ORANGE_MAIN_IDS.length;
  const blockClaimedCount = blockPaid.filter(Boolean).length;
  const orangeClaimedCount = orangeMainIdPaid.filter(Boolean).length;
  const formatValue =
    typeof formatDecimal === "function"
      ? formatDecimal
      : (value, digits = 2) =>
          value == null
            ? WAITING_VALUE
            : Number.isFinite(Number(value))
              ? Number(value).toLocaleString(undefined, {
                  minimumFractionDigits: digits,
                  maximumFractionDigits: digits,
                })
              : String(value);
  const formattedMetadata = metadataRows.length
    ? metadataRows
    : [
        {
          label: "Distributor",
          value: stats?.distributor ?? ADDR.COLLECTION_REWARDS,
        },
        { label: "Eyes main", value: stats?.main },
        { label: "Owner", value: stats?.owner },
      ];

  const formatAddressValue = (value) => {
    if (!value) return WAITING_VALUE;
    if (typeof formatAddress === "function") return formatAddress(value);
    return value;
  };

  const collectionStatRows = [
    {
      label: "Block reward",
      value: hasStats
        ? `${formatValue(stats.blockReward, 3)} POL`
        : WAITING_VALUE,
    },
    {
      label: "Orange reward",
      value: hasStats
        ? `${formatValue(stats.orangeReward, 3)} POL`
        : WAITING_VALUE,
    },
    {
      label: "Rainbow reward",
      value: hasStats
        ? `${formatValue(stats.rainbowReward, 3)} POL`
        : WAITING_VALUE,
    },
    {
      label: "Native pool",
      value:
        rewardPool != null
          ? `${formatValue(rewardPool, 2)} POL`
          : WAITING_VALUE,
    },
  ];

  const blockBadgeLabel = blockStatusesLoaded
    ? `${Math.max(BLOCK_INDICES.length - blockClaimedCount, 0)} open / ${blockClaimedCount} claimed`
    : "Syncing...";
  const orangeBadgeLabel = orangeStatusesLoaded
    ? `${Math.max(ORANGE_MAIN_IDS.length - orangeClaimedCount, 0)} open / ${orangeClaimedCount} claimed`
    : "Syncing...";
  const rainbowBadgeLabel = rainbowClaimed ? "Claimed" : "1 drop";

  return (
    <section className="rewards-panel__section rewards-panel__section--collection">
      <div className="collection-claims-stack">
        <div className="collection-claims-top">
          <article className="biggi-card biggi-card--y rewards-panel__card rewards-panel__card--summary">
            <div className="biggi-card__glow" aria-hidden />
            <div className="biggi-card__header">
              <div className="biggi-card__heading">
                <h3>Collection rewards</h3>
                <p>Live terms from CollectionRewards.</p>
              </div>
            </div>
            <div className="biggi-card__body">
              <div className="rewards-panel__stat-trio collection-stats-grid">
                {collectionStatRows.map((row) => (
                  <div className="rewards-panel__stat" key={row.label}>
                    <span className="label">{row.label}</span>
                    <span className="value">{row.value}</span>
                  </div>
                ))}
              </div>
              {!hasStats && (
                <div className="rewards-grid__loading">
                  <span className="rewards-grid__spinner" />
                  <span>Loading rewards configuration</span>
                </div>
              )}
              <ul className="rewards-grid__info-list">
                <li>Block winners share the same reward amount each round.</li>
                <li>
                  Orange winners and the Rainbow drop are minted once per block
                  window.
                </li>
              </ul>
            </div>
          </article>

          <article className="biggi-card biggi-card--c rewards-panel__card rewards-panel__card--rainbow">
            <div className="biggi-card__glow" aria-hidden />
            <div className="biggi-card__header">
              <div className="biggi-card__heading">
                <h3>Rainbow drop</h3>
                <p>Unlocks when block 10 is complete.</p>
              </div>
              <span className="rewards-panel__chip">{rainbowBadgeLabel}</span>
            </div>
            <div className="biggi-card__body">
              <div className="rewards-panel__claim-list">
                <div className="rewards-panel__claim-row">
                  <div className="rewards-panel__claim-plate">
                    {renderThumbnailPlate(
                      rainbowThumbnails(),
                      "Rainbow preview",
                    )}
                  </div>
                  <div className="rewards-panel__claim-info">
                    <div className="label">Rainbow reward</div>
                    <div
                      className={`pill ${rainbowClaimed ? "is-claimed" : "is-available"}`}
                    >
                      {rainbowClaimed ? "Paid" : "Open"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="biggi-btn biggi-btn--ghost"
                    onClick={onClaimRainbowReward}
                    disabled={
                      rainbowClaimed ||
                      claimState.rainbow ||
                      !canClaimCollection
                    }
                  >
                    {claimState.rainbow ? "Sending..." : "Claim"}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>

        <article className="biggi-card biggi-card--c rewards-panel__card rewards-panel__card--claims">
          <div className="biggi-card__glow" aria-hidden />
          <div className="biggi-card__header">
            <div className="biggi-card__heading">
              <h3>Claim collection rewards</h3>
              <p>Direct calls to CollectionRewards contract.</p>
            </div>
          </div>
          <div className="biggi-card__body">
            <div className="collection-claims-layout collection-claims-layout--two">
              <div className="collection-table collection-table--block">
                <div className="collection-table__header">
                  <div>
                    <div className="collection-table__title">Block rewards</div>
                    <small>Claim if you hold all 10 Main IDs in a block.</small>
                  </div>
                  <span className="rewards-panel__chip">{blockBadgeLabel}</span>
                </div>
                <div className="rewards-panel__claim-list">
                  {BLOCK_INDICES.map((blockIdx) => {
                    const idx = blockIdx - 1;
                    const paid = blockPaid[idx];
                    const available = blockStatusesLoaded && !paid;
                    const statusLabel = blockStatusesLoaded
                      ? paid
                        ? "Paid"
                        : "Open"
                      : "Loading...";
                    const blockThumbs = blockThumbnailsForId(blockIdx);
                    return (
                      <div
                        key={`block-${blockIdx}`}
                        className="rewards-panel__claim-row"
                      >
                        <div className="rewards-panel__claim-plate">
                          {renderThumbnailPlate(
                            blockThumbs,
                            `Block ${blockIdx}`,
                          )}
                        </div>
                        <div className="rewards-panel__claim-info">
                          <div className="label">Block {blockIdx}</div>
                          <div
                            className={`pill ${paid ? "is-claimed" : "is-available"}`}
                          >
                            {statusLabel}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="biggi-btn biggi-btn--ghost"
                          onClick={() => onClaimBlockReward?.(blockIdx)}
                          disabled={
                            !available ||
                            claimState.block === blockIdx ||
                            !canClaimCollection
                          }
                        >
                          {claimState.block === blockIdx
                            ? "Sending..."
                            : "Claim"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="collection-table collection-table--orange">
                <div className="collection-table__header">
                  <div>
                    <div className="collection-table__title">Orange drop</div>
                    <small>Each Main ID (1-10) can mint once.</small>
                  </div>
                  <span className="rewards-panel__chip">
                    {orangeBadgeLabel}
                  </span>
                </div>
                <div className="rewards-panel__claim-list">
                  {ORANGE_MAIN_IDS.map((mainId) => {
                    const idx = mainId - 1;
                    const paid = orangeMainIdPaid[idx];
                    const statusLabel = paid
                      ? "Paid"
                      : claimedOrange
                        ? "Already claimed"
                        : "Open";
                    const disabled =
                      paid ||
                      claimedOrange ||
                      claimState.orange === mainId ||
                      !canClaimCollection;
                    const orangeThumbs = orangeThumbnailsForId(mainId);
                    return (
                      <div
                        key={`orange-${mainId}`}
                        className="rewards-panel__claim-row"
                      >
                        <div className="rewards-panel__claim-plate">
                          {renderThumbnailPlate(
                            orangeThumbs,
                            `Main ID ${mainId}`,
                          )}
                        </div>
                        <div className="rewards-panel__claim-info">
                          <div className="label">Main ID {mainId}</div>
                          <div
                            className={`pill ${paid ? "is-claimed" : "is-available"}`}
                          >
                            {statusLabel}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="biggi-btn biggi-btn--ghost"
                          onClick={() => onClaimOrangeReward?.(mainId)}
                          disabled={disabled}
                        >
                          {claimState.orange === mainId
                            ? "Sending..."
                            : "Claim"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rewards-panel__meta">
              {formattedMetadata.map((row) => (
                <div className="row" key={row.label}>
                  <span className="label">{row.label}</span>
                  <span className="value" title={row.value || ""}>
                    {formatAddressValue(row.value)}
                  </span>
                </div>
              ))}
            </div>

            {feedback && (
              <div
                className={`rewards-grid__alert ${FEEDBACK_CLASS[feedback.tone] ?? ""}`.trim()}
              >
                {feedback.text}
              </div>
            )}
          </div>
        </article>
      </div>

      <div className="rewards-panel__status-grid rewards-panel__status-grid--collection">
        {statusRows.length ? (
          statusRows.map((status) => (
            <div key={status.label} className="rewards-panel__status">
              <span className="label">{status.label}</span>
              <span className={`value ${status.tone ?? ""}`.trim()}>
                {status.value}
              </span>
            </div>
          ))
        ) : (
          <div className="rewards-panel__status">
            <span className="label">Waiting</span>
            <span className="value">{WAITING_VALUE}</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default CollectionRewardsSection;

