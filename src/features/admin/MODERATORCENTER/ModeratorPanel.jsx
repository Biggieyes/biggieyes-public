// src/features/admin/MODERATORCENTER/ModeratorPanel.jsx
import * as React from "react";
import copy from "clipboard-copy";
import { formatWei } from "@/utils/eth";
import { buildModeratorReferralLink } from "@/shared/utils/referrals.js";
import "./MODERATORCENTERPanel.css";

const shortAddr = (addr) => {
  if (!addr) return "--";
  const s = String(addr);
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

const shortHash = (value) => {
  if (!value) return "--";
  const s = String(value);
  if (s.length <= 18) return s;
  return `${s.slice(0, 10)}...${s.slice(-6)}`;
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
  const hasWallet = Boolean(walletAddress);
  const resolvedBaseUrl =
    baseUrl || (typeof window !== "undefined" ? window.location.origin : "");

  const referralLink = React.useMemo(() => {
    return buildModeratorReferralLink(resolvedBaseUrl, slotId, refCode);
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
  const slotState =
    slotInfo?.enabled == null ? "Checking" : slotInfo.enabled ? "Active" : "Disabled";
  const leaderState =
    slotInfo?.isLeader == null ? "Unknown" : slotInfo.isLeader ? "Leader" : "Moderator";
  const passwordState = passwordSet === "Yes" ? "Password set" : passwordSet === "No" ? "Password missing" : "Password unknown";
  const globalMode =
    globalUniquePerWeek == null ? "--" : globalUniquePerWeek ? "Global" : "Per slot";

  const heroStats = [
    {
      icon: "Slot",
      label: "Slot",
      value: slotId,
      hint: slotState,
    },
    {
      icon: "Refs",
      label: "Unique referrals",
      value: stats?.uniqueCount ?? "--",
      hint: `This week ${stats?.uniqueThisWeek ?? "--"}`,
    },
    {
      icon: "Sales",
      label: "Purchases",
      value: stats?.purchasesCount ?? "--",
      hint: `This week ${stats?.purchasesThisWeek ?? "--"}`,
    },
    {
      icon: "POL",
      label: "Allocated this week",
      value: weekAllocated === "--" ? "--" : `${weekAllocated} POL`,
      hint: globalMode,
    },
  ];

  const performanceRows = [
    ["Connected wallet", shortAddr(walletAddress || "")],
    ["Payout wallet", shortAddr(payoutWallet)],
    ["Strikes", stats?.strikes ?? "--"],
    ["Weekly unique", stats?.uniqueThisWeek ?? "--"],
    ["Weekly purchases", stats?.purchasesThisWeek ?? "--"],
  ];

  const onChainRows = [
    ["Status", slotState],
    ["Role", leaderState],
    ["Payout", shortAddr(payoutWallet)],
    ["Referral hash", shortHash(referralHash)],
    ["Cumulative sales", cumulativeSales],
    ["Password", passwordState],
  ];

  const weeklyRows = [
    ["Week ID", weekId || "--"],
    ["Unique refs", weekUnique],
    ["Ticket sales", weekTickets],
    ["Allocated", weekAllocated === "--" ? "--" : `${weekAllocated} POL`],
    ["Unique mode", globalMode],
  ];

  const ownerRows = [
    ["Reset password", "Admin Panel > Moderator Ops"],
    ["Change payout", "Admin Panel > Moderator Ops"],
    ["Change referral hash", "Admin Panel > Moderator Ops"],
  ];

  return (
    <div className="moderator-center__stack">
      <div className="moderator-center__hero">
        {heroStats.map((item) => (
          <article key={item.label} className="moderator-center__stat-card">
            <div className="moderator-center__stat-icon">{item.icon}</div>
            <div>
              <span className="moderator-center__stat-label">{item.label}</span>
              <strong className="moderator-center__stat-value">
                {item.value}
              </strong>
              <div className="moderator-center__stat-hint">{item.hint}</div>
            </div>
          </article>
        ))}
      </div>

      <div
        className={`moderator-center__grid ${compact ? "" : "moderator-center__grid--wide"}`.trim()}
      >
        <div className="moderator-center__stack">
          <div className="moderator-center__card">
            <div className="moderator-center__card-head">
              <h3>Performance snapshot</h3>
              <span className="moderator-center__chip moderator-center__chip--cyan">
                Supabase
              </span>
            </div>
            <p className="moderator-center__copy muted">
              Quick view of your slot performance, payout routing, and current
              session identity.
            </p>
            <div className="moderator-center__statlines">
              {performanceRows.map(([label, value]) => (
                <div key={label} className="moderator-center__statline">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="moderator-center__card">
            <div className="moderator-center__card-head">
              <h3>Referral link</h3>
              <span className="moderator-center__chip">Shareable</span>
            </div>
            <p className="moderator-center__copy muted">
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
                disabled={!hasWallet}
                onClick={() => onRequestReset && onRequestReset()}
              >
                Request password reset
              </button>
            </div>
            <div className="moderator-center__hint">
              {hasWallet
                ? "Reset requests use the connected wallet so the backend can verify who is asking for a new password."
                : "Connect a wallet first if you need to request a password reset."}
            </div>
          </div>
        </div>

        <div className="moderator-center__stack">
          <div className="moderator-center__card">
            <div className="moderator-center__card-head">
              <h3>On-chain slot</h3>
              <div className="moderator-center__chips">
                <span
                  className={`moderator-center__chip ${slotInfo?.enabled ? "moderator-center__chip--ok" : "moderator-center__chip--warn"}`.trim()}
                >
                  {enabledLabel}
                </span>
                <span className="moderator-center__chip">{leaderLabel}</span>
                <span
                  className={`moderator-center__chip ${passwordSet === "Yes" ? "moderator-center__chip--ok" : "moderator-center__chip--warn"}`.trim()}
                >
                  {passwordSet}
                </span>
              </div>
            </div>
            <div className="moderator-center__statlines">
              {onChainRows.map(([label, value]) => (
                <div key={label} className="moderator-center__statline">
                  <span>{label}</span>
                  <strong className={label === "Referral hash" ? "mono" : ""}>
                    {value}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div className="moderator-center__card">
            <div className="moderator-center__card-head">
              <h3>Weekly window</h3>
              <span className="moderator-center__chip moderator-center__chip--cyan">
                On-chain
              </span>
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

            <div className="moderator-center__statlines">
              {weeklyRows.map(([label, value]) => (
                <div key={label} className="moderator-center__statline">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="moderator-center__card">
            <h3>Guidelines</h3>
            <ul className="moderator-center__list moderator-center__list--bullets">
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
            <div className="moderator-center__card-head">
              <h3>Owner actions</h3>
              <span className="moderator-center__chip moderator-center__chip--cyan">
                Admin Panel
              </span>
            </div>
            <p className="moderator-center__copy muted">
              Moderator Center no longer mixes owner controls into this screen.
              If a slot needs changes, the owner handles them in the main admin.
            </p>
            <div className="moderator-center__statlines">
              {ownerRows.map(([label, value]) => (
                <div key={label} className="moderator-center__statline">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
