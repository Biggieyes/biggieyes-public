import * as React from "react";
import "./WeeklyCountdown.css";

const STATUS_MAP = {
  claimable: { label: "Claimable now", tone: "teal" },
  next: { label: "Next claim soon", tone: "yellow" },
  already: { label: "Already claimed", tone: "gray" },
  loading: { label: "Loading", tone: "teal" },
  error: { label: "Error", tone: "yellow" },
};

const pad = (value) => String(value).padStart(2, "0");

const breakdown = (seconds) => {
  const dd = Math.floor(seconds / 86400);
  const hh = Math.floor((seconds % 86400) / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = Math.floor(seconds % 60);
  return { dd, hh, mm, ss };
};

const formatNumber = (value) =>
  Number.isFinite(value) ? pad(Math.max(0, Math.floor(value))) : "00";

export default function WeeklyCountdown({
  info = {},
  isClaiming = false,
  claimSuccess = false,
  onClaim,
  onRefresh,
}) {
  const remaining = Math.max(0, info.remainingSeconds ?? 0);
  const segments = breakdown(remaining);
  const percent = Math.min(100, Math.max(0, info.percentComplete ?? 0));
  const statusKey = info.status || "claimable";
  const badge = STATUS_MAP[info.error ? "error" : statusKey] || STATUS_MAP.claimable;
  const hasError = Boolean(info.error);

  const timerDigits = React.useMemo(
    () => [
      { label: "DD", value: formatNumber(segments.dd) },
      { label: "HH", value: formatNumber(segments.hh) },
      { label: "MM", value: formatNumber(segments.mm) },
      { label: "SS", value: formatNumber(segments.ss) },
    ],
    [segments]
  );

  const badgeClass = `wc-badge wc-badge--${badge.tone}`;
  const metaLine = info.blockNumber
    ? `Authoritative by block #${info.blockNumber} (UTC)`
    : "Authoritative clock (UTC)";
  const lastSync = info.lastSync ? new Date(info.lastSync).toLocaleString() : "-";
  const buttonLabel = claimSuccess ? "Claimed!" : "Claim";
  const weekLabel = info.currentWeek ? `Week ${info.currentWeek}` : "Week in progress";
  const remainingLabel = `${pad(segments.dd)}d ${pad(segments.hh)}h ${pad(segments.mm)}m ${pad(segments.ss)}s`;
  const statusLabel = badge.label;
  const progressLabel = `${percent.toFixed(0)}% complete`;

  return (
    <div className="wc-card" role="region" aria-live="polite">
      <div className="wc-card__header">
        <div className="wc-card__icon" aria-hidden />
        <div>
          <div className="wc-card__title">Weekly payout</div>
          <div className="wc-card__subtitle">Weekly Claim</div>
        </div>
        <span className={badgeClass}>{statusLabel}</span>
      </div>

      <div className="wc-table-grid">
        <div className="wc-table-grid__pane wc-table-grid__pane--countdown">
          <div className="wc-table-grid__title">Claim window</div>
          <div className="wc-timer" aria-live="polite">
            {timerDigits.map((segment) => (
              <div key={segment.label} className="wc-timer__segment">
                <span className="wc-timer__value">{segment.value}</span>
                <span className="wc-timer__label">{segment.label}</span>
              </div>
            ))}
          </div>
          <div className="wc-progress">
            <div className="wc-progress__track">
              <div
                className="wc-progress__fill"
                style={{ width: `${percent}%` }}
                aria-label={`Progress ${percent.toFixed(0)}%`}
              />
            </div>
            <div className="wc-progress__meta">
              <div>{weekLabel}</div>
              <div>{progressLabel}</div>
            </div>
          </div>
          <div className="wc-remaining-text">{remainingLabel}</div>
        </div>

        <div className="wc-table-grid__pane wc-table-grid__pane--details">
          <div className="wc-data-grid">
            <div className="wc-data-row">
              <span className="wc-data-label">Current week</span>
              <strong className="wc-data-value">{weekLabel}</strong>
            </div>
            <div className="wc-data-row">
              <span className="wc-data-label">Progress</span>
              <strong className="wc-data-value">{progressLabel}</strong>
            </div>
            <div className="wc-data-row">
              <span className="wc-data-label">Status</span>
              <strong className="wc-data-value">{statusLabel}</strong>
            </div>
            <div className="wc-data-row">
              <span className="wc-data-label">Meta</span>
              <strong className="wc-data-value">{metaLine}</strong>
            </div>
          </div>
          <div className="wc-meta wc-meta--compact">
            <div>
              <span>Last sync:</span>{" "}
              <span className="wc-meta__sync">{lastSync}</span>
            </div>
            <button
              type="button"
              className="wc-meta__refresh"
              onClick={onRefresh}
              aria-label="Refresh countdown"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="wc-actions">
        <button
          type="button"
          className={`wc-cta${isClaiming ? " wc-cta--loading" : ""}`}
          onClick={onClaim}
          disabled={!info.claimable || isClaiming || hasError || claimSuccess}
        >
          <span>{isClaiming ? "Waiting for mint..." : buttonLabel}</span>
        </button>
        {info.error && <div className="wc-error">{info.error}</div>}
        {claimSuccess && <div className="wc-toast">Claim confirmed! Re-syncing...</div>}
      </div>
    </div>
  );
}
