// src/features/admin/MODERATORCENTER/ModeratorPanel.jsx
import * as React from "react";
import copy from "clipboard-copy";
import { formatWei } from "@/utils/eth";
import "./MODERATORCENTERPanel.css";

const shortAddr = (addr) => {
  if (!addr) return "--";
  const s = String(addr);
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

export default function ModeratorPanel({
  stats,
  walletAddress,
  baseUrl,
  onRequestReset,
  weekId,
  onWeekChange,
  onRefreshChain,
  chainLoading,
  chainError,
  slotInfo,
  weekStats,
  globalUniquePerWeek,
  compact,
}) {
  const [refCode, setRefCode] = React.useState("");
  const slotId = stats?.slotId ?? "--";
  const resolvedBaseUrl =
    baseUrl || (typeof window !== "undefined" ? window.location.origin : "");

  const referralLink = React.useMemo(() => {
    const code = refCode || "code";
    if (!slotId || slotId === "--") return "";
    return `${resolvedBaseUrl}?ref=slot${slotId}:${code}`;
  }, [resolvedBaseUrl, slotId, refCode]);

  const payoutWallet =
    slotInfo?.payout || stats?.payoutWallet || walletAddress || "";
  const enabledLabel =
    slotInfo?.enabled == null ? "--" : slotInfo.enabled ? "Yes" : "No";
  const leaderLabel =
    slotInfo?.isLeader == null ? "--" : slotInfo.isLeader ? "Yes" : "No";
  const referralHash = slotInfo?.referralHash || "--";
  const cumulativeSales =
    slotInfo?.cumulativeSales != null
      ? String(slotInfo.cumulativeSales)
      : "--";
  const passwordSet = (() => {
    const hash = slotInfo?.passwordHash;
    if (!hash) return "--";
    const raw = String(hash);
    if (/^0x0+$/.test(raw)) return "No";
    return "Yes";
  })();
  const weekUnique =
    weekStats?.uniqueRefs != null ? String(weekStats.uniqueRefs) : "--";
  const weekTickets =
    weekStats?.ticketSales != null ? String(weekStats.ticketSales) : "--";
  const weekAllocated =
    weekStats?.allocatedWei != null ? formatWei(weekStats.allocatedWei) : "--";

  return (
    <div className="moderator-center__stack">
      <div className="moderator-center__header">
        <div>
          <h2>Moderator Center</h2>
          <div className="muted">
            Track referrals, payouts, and weekly performance.
          </div>
        </div>
        <div className="moderator-center__wallet">
          <div className="moderator-center__wallet-info">
            <span className="muted">Wallet</span>
            <strong>{shortAddr(walletAddress)}</strong>
          </div>
        </div>
      </div>

      <div className="moderator-center__meta">
        <div>
          <span className="muted">Slot ID</span>
          <strong>{slotId}</strong>
        </div>
        <div>
          <span className="muted">Payout wallet</span>
          <strong>{shortAddr(payoutWallet)}</strong>
        </div>
        <div>
          <span className="muted">Strikes</span>
          <strong>{stats?.strikes ?? "--"}</strong>
        </div>
        <div>
          <span className="muted">Referrals (total)</span>
          <strong>{stats?.uniqueCount ?? "--"}</strong>
        </div>
      </div>

      <div
        className={`moderator-center__grid ${compact ? "" : "moderator-center__grid--wide"}`.trim()}
      >
        <div className="moderator-center__stack">
          <div className="moderator-center__card">
            <h3>Personal overview</h3>
            <div className="moderator-center__stats">
              <div>
                <span className="muted">Unique referrals (total)</span>
                <strong>{stats?.uniqueCount ?? "--"}</strong>
              </div>
              <div>
                <span className="muted">Purchases (total)</span>
                <strong>{stats?.purchasesCount ?? "--"}</strong>
              </div>
              <div>
                <span className="muted">This week (unique)</span>
                <strong>{stats?.uniqueThisWeek ?? "--"}</strong>
              </div>
              <div>
                <span className="muted">This week (purchases)</span>
                <strong>{stats?.purchasesThisWeek ?? "--"}</strong>
              </div>
            </div>
          </div>

          <div className="moderator-center__card">
            <h3>Referral link</h3>
            <p className="muted">
              Share your link. A user must connect their wallet for the referral
              to be recorded.
            </p>
            <div className="moderator-center__field">
              <label>Code (optional)</label>
              <input
                type="text"
                placeholder="e.g. promo2025"
                value={refCode}
                onChange={(e) => setRefCode(e.target.value)}
              />
            </div>
            <div className="moderator-center__field">
              <label>Generated link</label>
              <input type="text" readOnly value={referralLink} />
            </div>
            <div className="moderator-center__actions">
              <button
                type="button"
                className="biggi-btn biggi-btn--ghost"
                onClick={() => referralLink && copy(referralLink)}
              >
                Copy link
              </button>
              <button
                type="button"
                className="biggi-btn biggi-btn--ghost"
                onClick={() => onRequestReset && onRequestReset()}
              >
                Request password reset
              </button>
            </div>
          </div>
        </div>

        <div className="moderator-center__stack">
          <div className="moderator-center__card">
            <h3>On-chain slot</h3>
            <div className="moderator-center__stats">
              <div>
                <span className="muted">Enabled</span>
                <strong>{enabledLabel}</strong>
              </div>
              <div>
                <span className="muted">Leader</span>
                <strong>{leaderLabel}</strong>
              </div>
              <div>
                <span className="muted">Payout</span>
                <strong>{shortAddr(payoutWallet)}</strong>
              </div>
              <div>
                <span className="muted">Referral hash</span>
                <strong className="mono">{shortAddr(referralHash)}</strong>
              </div>
              <div>
                <span className="muted">Cumulative sales</span>
                <strong>{cumulativeSales}</strong>
              </div>
              <div>
                <span className="muted">Password set</span>
                <strong>{passwordSet}</strong>
              </div>
            </div>

            <div className="moderator-center__field">
              <label>Week ID</label>
              <input
                type="text"
                value={weekId || ""}
                onChange={(e) => onWeekChange?.(e.target.value)}
                placeholder="e.g. 2870"
              />
            </div>
            <div className="moderator-center__actions">
              <button
                type="button"
                className="biggi-btn biggi-btn--ghost"
                disabled={chainLoading}
                onClick={() => onRefreshChain?.()}
              >
                {chainLoading ? "Loading..." : "Refresh on-chain"}
              </button>
            </div>
            {chainError ? (
              <div className="moderator-center__error">{chainError}</div>
            ) : null}

            <div className="moderator-center__stats">
              <div>
                <span className="muted">Week unique</span>
                <strong>{weekUnique}</strong>
              </div>
              <div>
                <span className="muted">Week tickets</span>
                <strong>{weekTickets}</strong>
              </div>
              <div>
                <span className="muted">Week allocated (POL)</span>
                <strong>{weekAllocated}</strong>
              </div>
              <div>
                <span className="muted">Global unique mode</span>
                <strong>
                  {globalUniquePerWeek == null
                    ? "--"
                    : globalUniquePerWeek
                      ? "On"
                      : "Off"}
                </strong>
              </div>
            </div>
          </div>

          <div className="moderator-center__card">
            <h3>Guidelines</h3>
            <ul className="moderator-center__list">
              <li>
                Referrals are stored only on the first visit with a connected
                wallet.
              </li>
              <li>The same address is counted only once across all slots.</li>
              <li>
                Ticket purchases update after the on-chain event is captured.
              </li>
            </ul>
          </div>
          <div className="moderator-center__card">
            <h3>Quick stats</h3>
            <div className="moderator-center__stats">
              <div>
                <span className="muted">Weekly referrals</span>
                <strong>{stats?.uniqueThisWeek ?? "--"}</strong>
              </div>
              <div>
                <span className="muted">Weekly purchases</span>
                <strong>{stats?.purchasesThisWeek ?? "--"}</strong>
              </div>
              <div>
                <span className="muted">Total purchases</span>
                <strong>{stats?.purchasesCount ?? "--"}</strong>
              </div>
              <div>
                <span className="muted">Slot status</span>
                <strong>{slotId !== "--" ? "Active" : "Pending"}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
