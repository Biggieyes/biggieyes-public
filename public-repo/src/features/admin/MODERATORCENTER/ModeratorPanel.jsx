import * as React from "react";
import copy from "clipboard-copy";
import { formatWei, toBytes32 } from "@/utils/eth";
import {
  buildModeratorReferralLink,
  buildModeratorReferralValue,
} from "@/shared/utils/referrals.js";
import "./MODERATORCENTERPanel.css";

const shortAddr = (value) => {
  if (!value) return "--";
  const text = String(value);
  return text.length <= 14 ? text : `${text.slice(0, 8)}...${text.slice(-6)}`;
};

const shortHash = (value) => {
  if (!value) return "--";
  const text = String(value);
  return text.length <= 20 ? text : `${text.slice(0, 12)}...${text.slice(-8)}`;
};

export default function ModeratorPanel({
  walletAddress,
  baseUrl,
  weekId,
  onWeekChange,
  onRefreshChain,
  chainLoading,
  slotInfo,
  weekStats,
  globalUniquePerWeek,
  claimable,
  onClaim,
  claimState,
  compact,
}) {
  const [refCode, setRefCode] = React.useState("");
  const slotId = slotInfo?.slotId;
  const canonicalReferral = buildModeratorReferralValue(slotId, refCode);
  const referralHash = slotInfo?.referralHash || "";
  const referralMatches = React.useMemo(() => {
    if (!canonicalReferral || !referralHash) return false;
    return toBytes32(canonicalReferral).toLowerCase() === referralHash.toLowerCase();
  }, [canonicalReferral, referralHash]);
  const referralLink = React.useMemo(
    () =>
      referralMatches
        ? buildModeratorReferralLink(baseUrl, slotId, refCode.trim())
        : "",
    [baseUrl, slotId, refCode, referralMatches],
  );

  const weekUnique = weekStats?.uniqueRefs != null ? String(weekStats.uniqueRefs) : "--";
  const weekTickets =
    weekStats?.ticketSales != null ? String(weekStats.ticketSales) : "--";
  const weekAllocated =
    weekStats?.allocatedWei != null ? formatWei(weekStats.allocatedWei) : "--";
  const claimablePol = claimable != null ? formatWei(claimable) : "--";
  const role = slotInfo?.isLeader ? "Leader" : "Moderator";
  const uniqueMode =
    globalUniquePerWeek == null ? "--" : globalUniquePerWeek ? "Global" : "Per slot";

  const heroStats = [
    { label: "Slot", value: slotId ?? "--", hint: role },
    { label: "Unique referrals", value: weekUnique, hint: `Week ${weekId}` },
    { label: "Paid tickets", value: weekTickets, hint: "Attributed on-chain" },
    {
      label: "Claimable",
      value: claimablePol === "--" ? "--" : `${claimablePol} POL`,
      hint: "Pull payout",
    },
  ];

  const slotRows = [
    ["Status", slotInfo?.enabled ? "Active" : "Disabled"],
    ["Role", role],
    ["Payout", shortAddr(slotInfo?.payout || walletAddress)],
    ["Referral hash", shortHash(referralHash)],
    ["Cumulative paid tickets", String(slotInfo?.cumulativeSales ?? "--")],
  ];

  const weeklyRows = [
    ["Week ID", weekId || "--"],
    ["Unique buyers", weekUnique],
    ["Paid tickets", weekTickets],
    ["Weekly pool", weekAllocated === "--" ? "--" : `${weekAllocated} POL`],
    ["Unique policy", uniqueMode],
  ];

  return (
    <div className="moderator-center__stack">
      <div className="moderator-center__hero">
        {heroStats.map((item) => (
          <article key={item.label} className="moderator-center__stat-card">
            <div>
              <span className="moderator-center__stat-label">{item.label}</span>
              <strong className="moderator-center__stat-value">{item.value}</strong>
              <div className="moderator-center__stat-hint">{item.hint}</div>
            </div>
          </article>
        ))}
      </div>

      <div
        className={`moderator-center__grid ${compact ? "" : "moderator-center__grid--wide"}`.trim()}
      >
        <div className="moderator-center__stack">
          <section className="moderator-center__card">
            <div className="moderator-center__card-head">
              <h3>Referral link</h3>
              <span
                className={`moderator-center__chip ${
                  referralMatches
                    ? "moderator-center__chip--ok"
                    : "moderator-center__chip--warn"
                }`.trim()}
              >
                {referralMatches ? "Verified" : "Code required"}
              </span>
            </div>
            <div className="moderator-center__field">
              <label>Referral code</label>
              <input
                type="text"
                value={refCode}
                onChange={(event) => setRefCode(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="moderator-center__field">
              <label>Shareable link</label>
              <input type="text" readOnly value={referralLink} />
            </div>
            <div className="moderator-center__actions">
              <button
                type="button"
                className="biggi-btn biggi-btn--ghost"
                disabled={!referralMatches}
                onClick={() => referralLink && copy(referralLink)}
              >
                Copy link
              </button>
            </div>
          </section>

          <section className="moderator-center__card">
            <div className="moderator-center__card-head">
              <h3>Claim</h3>
              <span className="moderator-center__chip moderator-center__chip--cyan">
                POL
              </span>
            </div>
            <div className="moderator-center__statlines">
              <div className="moderator-center__statline">
                <span>Available</span>
                <strong>{claimablePol === "--" ? "--" : `${claimablePol} POL`}</strong>
              </div>
              <div className="moderator-center__statline">
                <span>Destination</span>
                <strong className="mono">{shortAddr(walletAddress)}</strong>
              </div>
            </div>
            <div className="moderator-center__actions">
              <button
                type="button"
                className="biggi-btn biggi-btn--ghost"
                disabled={claimState?.pending || !claimable || claimable === 0n}
                onClick={onClaim}
              >
                {claimState?.pending ? "Claiming..." : "Claim rewards"}
              </button>
            </div>
            {claimState?.message ? (
              <div className="moderator-center__hint">{claimState.message}</div>
            ) : null}
          </section>
        </div>

        <div className="moderator-center__stack">
          <section className="moderator-center__card">
            <div className="moderator-center__card-head">
              <h3>On-chain slot</h3>
              <span className="moderator-center__chip moderator-center__chip--ok">
                Wallet verified
              </span>
            </div>
            <div className="moderator-center__statlines">
              {slotRows.map(([label, value]) => (
                <div key={label} className="moderator-center__statline">
                  <span>{label}</span>
                  <strong className={label.includes("hash") ? "mono" : ""}>{value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="moderator-center__card">
            <div className="moderator-center__card-head">
              <h3>Weekly window</h3>
              <span className="moderator-center__chip moderator-center__chip--cyan">
                On-chain
              </span>
            </div>
            <div className="moderator-center__field">
              <label>Week ID</label>
              <input
                type="number"
                min="0"
                step="1"
                value={weekId || ""}
                onChange={(event) => onWeekChange?.(event.target.value)}
              />
            </div>
            <div className="moderator-center__actions">
              <button
                type="button"
                className="biggi-btn biggi-btn--ghost"
                disabled={chainLoading}
                onClick={onRefreshChain}
              >
                {chainLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
            <div className="moderator-center__statlines">
              {weeklyRows.map(([label, value]) => (
                <div key={label} className="moderator-center__statline">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="moderator-center__card">
            <h3>Attribution rules</h3>
            <ul className="moderator-center__list moderator-center__list--bullets">
              <li>Only a paid TicketHub token can be attributed.</li>
              <li>Each ticket can be attributed once by its current owner.</li>
              <li>The referral confirmation is a separate on-chain transaction after mint.</li>
              <li>Weekly rewards become claimable after delayed final settlement.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
