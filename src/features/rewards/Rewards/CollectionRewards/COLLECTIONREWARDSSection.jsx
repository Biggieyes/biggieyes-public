import * as React from "react";
import {
  BLOCK_INDICES,
  ORANGE_MAIN_IDS,
} from "../../../../services/collectionRewardsService.js";
import { ADDR } from "@/shared/utils/addresses.js";
import { handleImageError } from "../../../../utils/images.ts";

const FEEDBACK_CLASS = {
  success: "is-success",
  error: "is-error",
};
const WAITING_VALUE = "--";
const CLAIM_REASON_LABELS = {
  block: {
    1: "Reward off",
    2: "Limit reached",
    3: "Invalid block",
    4: "Paid",
    5: "Already claimed",
    6: "Need full block",
    7: "Pool low",
  },
  orange: {
    1: "Reward off",
    2: "Limit reached",
    3: "Invalid Main ID",
    4: "Paid",
    5: "Need orange set",
    6: "Pool low",
  },
  rainbow: {
    1: "Reward off",
    2: "Paid",
    3: "Need block 10",
    4: "Pool low",
  },
};

const thumbnailPath = (segments) => {
  const originalPath = `/images/${segments.join("/")}`;
  const thumbRelative = segments.slice(1).join("/");
  const thumbPath = `/images/rewards-thumb/${thumbRelative}`.replace(
    /\.png$/i,
    ".jpg",
  );
  return {
    src: thumbPath,
    fallback: originalPath,
  };
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
      {paths.map((item, index) => {
        const src = typeof item === "string" ? item : item?.src;
        if (!src) return null;
        const fallback =
          typeof item === "string" ? undefined : item?.fallback || undefined;
        return (
          <img
            key={`${src}-${index}`}
            src={src}
            data-fallback-src={fallback}
            alt={`${label} preview`}
            loading="lazy"
            decoding="async"
            width={56}
            height={56}
            onError={handleImageError}
          />
        );
      })}
    </div>
  );
};

const getClaimReasonLabel = (kind, reason) => {
  if (reason == null) return "Locked";
  return CLAIM_REASON_LABELS[kind]?.[reason] || "Locked";
};

const resolveClaimPresentation = ({
  kind,
  paid = false,
  loading = false,
  canClaim = false,
  claimability = null,
}) => {
  if (loading) {
    return {
      label: "Loading...",
      tone: "is-loading",
      rowTone: "row-loading",
      disabled: true,
    };
  }
  if (paid) {
    return {
      label: "Paid",
      tone: "is-claimed",
      rowTone: "row-claimed",
      disabled: true,
    };
  }
  if (!canClaim) {
    return {
      label: "Wallet needed",
      tone: "is-locked",
      rowTone: "row-locked",
      disabled: true,
    };
  }
  if (claimability?.ok === false) {
    return {
      label: getClaimReasonLabel(kind, claimability.reason),
      tone: "is-locked",
      rowTone: "row-locked",
      disabled: true,
    };
  }
  if (claimability?.resolved === false) {
    return {
      label: "Check wallet",
      tone: "is-available",
      rowTone: "row-open",
      disabled: false,
    };
  }
  return {
    label: "Open",
    tone: "is-available",
    rowTone: "row-open",
    disabled: false,
  };
};

function COLLECTIONREWARDSSection({
  stats = null,
  statusRows = [],
  formatDecimal,
  formatNativeAmount,
  rewardPool = null,
  collectionBalance = null,
  blockPaid = [],
  blockClaimability = [],
  orangeMainIdPaid = [],
  orangeClaimability = [],
  rainbowClaimed = false,
  rainbowClaimability = { ok: null, reason: null, resolved: false },
  canClaimCOLLECTION = false,
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
  const orangeStatusesLoaded = orangeMainIdPaid.length === ORANGE_MAIN_IDS.length;
  const blockClaimedCount = blockPaid.filter(Boolean).length;
  const orangeClaimedCount = orangeMainIdPaid.filter(Boolean).length;
  const formatValue = typeof formatDecimal === "function"
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
  const formatNativeValue = (value, digits = 2) => {
    if (typeof formatNativeAmount === "function") {
      return formatNativeAmount(value, digits);
    }
    const formatted = formatValue(value, digits);
    return formatted === WAITING_VALUE ? WAITING_VALUE : `${formatted} POL`;
  };
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

  const COLLECTIONStatRows = [
    {
      label: "Block reward",
      value: hasStats
        ? formatNativeValue(stats.blockReward, 3)
        : WAITING_VALUE,
    },
    {
      label: "Orange reward",
      value: hasStats
        ? formatNativeValue(stats.orangeReward, 3)
        : WAITING_VALUE,
    },
    {
      label: "Rainbow reward",
      value: hasStats
        ? formatNativeValue(stats.rainbowReward, 3)
        : WAITING_VALUE,
    },
    {
      label: "Native pool",
      value:
        rewardPool != null
          ? formatNativeValue(rewardPool, 2)
          : WAITING_VALUE,
    },
    {
      label: "Contract balance",
      value:
        collectionBalance != null
          ? formatNativeValue(collectionBalance, 2)
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
  const rainbowPresentation = resolveClaimPresentation({
    kind: "rainbow",
    paid: rainbowClaimed,
    canClaim: canClaimCOLLECTION,
    claimability: rainbowClaimability,
  });

  return (
    <section className="rewards-panel__section rewards-panel__section--collection">
      <div className="collection-claims-stack">
        <div className="collection-claims-top">
          <article className="biggi-card biggi-card--y rewards-panel__card rewards-panel__card--summary">
            <div className="biggi-card__glow" aria-hidden />
            <div className="biggi-card__header">
              <div className="biggi-card__heading">
                <h3>COLLECTION REWARDS</h3>
                <p>Live terms from COLLECTIONREWARDS.</p>
              </div>
            </div>
            <div className="biggi-card__body">
              <div className="rewards-panel__stat-trio collection-stats-grid">
                {COLLECTIONStatRows.map((row) => (
                  <div className="rewards-panel__stat" key={row.label}>
                    <span className="label">{row.label}</span>
                    <span className="value">{row.value}</span>
                  </div>
                ))}
              </div>
              {!hasStats && (
                <div className="rewards-grid__loading">
                  <span className="rewards-grid__spinner" />
                  <span>Loading REWARDS configuration</span>
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
                <div
                  className={`rewards-panel__claim-row ${rainbowPresentation.rowTone}`.trim()}
                >
                  <div className="rewards-panel__claim-plate">
                    {renderThumbnailPlate(
                      rainbowThumbnails(),
                      "Rainbow preview",
                    )}
                  </div>
                  <div className="rewards-panel__claim-info">
                    <div className="label">Rainbow reward</div>
                    <div className={`pill ${rainbowPresentation.tone}`}>
                      {rainbowPresentation.label}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="biggi-btn biggi-btn--ghost"
                    onClick={onClaimRainbowReward}
                    disabled={
                      rainbowPresentation.disabled || claimState.rainbow
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
              <h3>Claim COLLECTION REWARDS</h3>
              <p>Direct calls to COLLECTIONREWARDS contract.</p>
            </div>
          </div>
          <div className="biggi-card__body">
            <div className="collection-claims-layout collection-claims-layout--two">
              <div className="collection-table collection-table--block">
                <div className="collection-table__header">
                  <div>
                    <div className="collection-table__title">Block REWARDS</div>
                    <small className="collection-table__hint">
                      Claim if you hold all 10 Main IDs in a block.
                    </small>
                  </div>
                  <span className="rewards-panel__chip">{blockBadgeLabel}</span>
                </div>
                <div className="rewards-panel__claim-list">
                  {BLOCK_INDICES.map((blockIdx) => {
                    const idx = blockIdx - 1;
                    const claimability = blockClaimability[idx] || null;
                    const presentation = resolveClaimPresentation({
                      kind: "block",
                      paid: blockPaid[idx],
                      loading: !blockStatusesLoaded,
                      canClaim: canClaimCOLLECTION,
                      claimability,
                    });
                    const blockThumbs = blockThumbnailsForId(blockIdx);
                    return (
                      <div
                        key={`block-${blockIdx}`}
                        className={`rewards-panel__claim-row ${presentation.rowTone}`}
                      >
                        <div className="rewards-panel__claim-plate">
                          {renderThumbnailPlate(
                            blockThumbs,
                            `Block ${blockIdx}`,
                          )}
                        </div>
                        <div className="rewards-panel__claim-info">
                          <div className="label">Block {blockIdx}</div>
                          <div className={`pill ${presentation.tone}`}>
                            {presentation.label}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="biggi-btn biggi-btn--ghost"
                          onClick={() => onClaimBlockReward?.(blockIdx)}
                          disabled={
                            presentation.disabled ||
                            claimState.block === blockIdx
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
                    <small className="collection-table__hint">
                      Each Main ID (1-10) can mint once.
                    </small>
                  </div>
                  <span className="rewards-panel__chip">
                    {orangeBadgeLabel}
                  </span>
                </div>
                <div className="rewards-panel__claim-list">
                  {ORANGE_MAIN_IDS.map((mainId) => {
                    const idx = mainId - 1;
                    const claimability = orangeClaimability[idx] || null;
                    const presentation = resolveClaimPresentation({
                      kind: "orange",
                      paid: orangeMainIdPaid[idx],
                      loading: !orangeStatusesLoaded,
                      canClaim: canClaimCOLLECTION,
                      claimability,
                    });
                    const orangeThumbs = orangeThumbnailsForId(mainId);
                    return (
                      <div
                        key={`orange-${mainId}`}
                        className={`rewards-panel__claim-row ${presentation.rowTone}`}
                      >
                        <div className="rewards-panel__claim-plate">
                          {renderThumbnailPlate(
                            orangeThumbs,
                            `Main ID ${mainId}`,
                          )}
                        </div>
                        <div className="rewards-panel__claim-info">
                          <div className="label">Main ID {mainId}</div>
                          <div className={`pill ${presentation.tone}`}>
                            {presentation.label}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="biggi-btn biggi-btn--ghost"
                          onClick={() => onClaimOrangeReward?.(mainId)}
                          disabled={
                            presentation.disabled ||
                            claimState.orange === mainId
                          }
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

export default COLLECTIONREWARDSSection;
