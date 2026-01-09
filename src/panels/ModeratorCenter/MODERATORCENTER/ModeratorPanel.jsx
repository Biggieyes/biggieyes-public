// src/components/ModeratorPanel.jsx
import * as React from "react";
import copy from "clipboard-copy";

const shortAddr = (addr) => {
  if (!addr) return "--";
  const s = String(addr);
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

export default function MODERATORCENTERPanel({
  stats,
  walletAddress,
  baseUrl,
  onRequestReset,
}) {
  const [refCode, setRefCode] = React.useState("");
  const slotId = stats?.slotId ?? "--";

  const referralLink = React.useMemo(() => {
    const code = refCode || "code";
    if (!slotId || slotId === "--") return "";
    return `${baseUrl}?ref=slot${slotId}:${code}`;
  }, [baseUrl, slotId, refCode]);

  return (
    <section className="moderator-center__stack">
      <div className="moderator-center__card">
        <h3>Personal overview</h3>
        <div className="moderator-center__stats">
          <div>
            <span className="muted">Slot ID</span>
            <strong>{slotId}</strong>
          </div>
          <div>
            <span className="muted">Payout wallet</span>
            <strong>{shortAddr(stats?.payoutWallet || walletAddress)}</strong>
          </div>
          <div>
            <span className="muted">Strikes</span>
            <strong>{stats?.strikes ?? "--"}</strong>
          </div>
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
        <h3>Referral odkaz</h3>
        <p className="muted">
          Share your link. A user must connect their wallet for the referral to
          be recorded.
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
            onClick={onRequestReset}
          >
            Request password reset
          </button>
        </div>
      </div>

      <div className="moderator-center__card">
        <h3>Pokyny</h3>
        <ul className="moderator-center__list">
          <li>
            Referrals are stored only on the first visit with a connected
            wallet.
          </li>
          <li>The same address is counted only once across all slots.</li>
          <li>Ticket purchases update after the on-chain event is captured.</li>
        </ul>
      </div>
    </section>
  );
}

