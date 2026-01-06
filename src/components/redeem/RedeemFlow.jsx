import * as React from "react";
import "./RedeemFlow.css";

/**
 * Presentational component for the redeem/reveal flow.
 * No internal logic — just triggers the provided callbacks.
 */
export default function RedeemFlow({
  isRedeeming = false,
  vrfPending = false,
  redeemMsg = "",
  onRedeem = () => {},
  onRefresh = () => {},
  pendingTicketId = null,
}) {
  // Step index: 0 = Ready, 1 = Tx submitting/confirming, 2 = VRF pending
  const stepIndex = React.useMemo(() => {
    if (vrfPending) return 2;
    if (isRedeeming) return 1;
    return 0;
  }, [isRedeeming, vrfPending]);

  const progressPct = React.useMemo(() => {
    // 3 steps (0..2) -> 0%, 50%, 100%
    return Math.round((stepIndex / 2) * 100);
  }, [stepIndex]);

  const canRedeem = !isRedeeming && !vrfPending;

  return (
    <section className="redeem-card" aria-live="polite">
      <header className="redeem-header">
        <div className="redeem-title">Redeem &amp; Reveal</div>
        {pendingTicketId && (
          <div className="redeem-badge" title="Ticket being redeemed">
            Ticket #{pendingTicketId}
          </div>
        )}
      </header>

      {/* Step indicator */}
      <ol className="redeem-steps">
        <li
          className={`step ${stepIndex >= 0 ? "done" : ""} ${stepIndex === 0 ? "active" : ""}`}
        >
          <span className="dot" />
          <span className="label">Ready to Redeem</span>
        </li>
        <li
          className={`step ${stepIndex >= 1 ? "done" : ""} ${stepIndex === 1 ? "active" : ""}`}
        >
          <span className="dot">
            {isRedeeming && <span className="spinner" />}
          </span>
          <span className="label">Tx Confirmation</span>
        </li>
        <li
          className={`step ${stepIndex >= 2 ? "done" : ""} ${stepIndex === 2 ? "active" : ""}`}
        >
          <span className="dot">
            {vrfPending && <span className="spinner" />}
          </span>
          <span className="label">VRF Pending</span>
        </li>
      </ol>

      {/* Progress bar */}
      <div className="redeem-progress">
        <div className="track" />
        <div className="fill" style={{ width: `${progressPct}%` }} />
        <div className="ticks">
          <span style={{ left: "0%" }} />
          <span style={{ left: "50%" }} />
          <span style={{ left: "100%" }} />
        </div>
      </div>

      {/* Message line */}
      {!!redeemMsg && <div className="redeem-msg">{redeemMsg}</div>}

      {/* CTA buttons */}
      <div className="redeem-actions">
        <button
          className={`redeem-cta ${!canRedeem ? "disabled" : ""}`}
          onClick={canRedeem ? onRedeem : undefined}
          disabled={!canRedeem}
        >
          {canRedeem
            ? "Redeem Ticket"
            : isRedeeming
              ? "Submitting..."
              : "Waiting for VRF..."}
        </button>

        {vrfPending && (
          <button className="redeem-refresh" onClick={onRefresh}>
            Refresh reveal
          </button>
        )}
      </div>

      {/* Tiny helper note */}
      <p className="redeem-note">
        After your ticket burns, the NFT is selected via Chainlink VRF. It will
        auto-appear in your gallery once revealed.
      </p>
    </section>
  );
}
