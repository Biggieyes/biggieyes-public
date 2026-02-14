import * as React from "react";
import "./RedeemFLOW.css";

/**
 * Presentational component for the redeem/reveal FLOW.
 * No internal logic — just triggers the provided callbacks.
 */
export default function RedeemFLOW({
  isRedeeming = false,
  VRFPending = false,
  redeemMsg = "",
  onRedeem = () => {},
  onRefresh = () => {},
  pendingTicketId = null,
}) {
  // Step index: 0 = Ready, 1 = Tx submitting/confirming, 2 = VRF pending
  const stepIndex = React.useMemo(() => {
    if (VRFPending) return 2;
    if (isRedeeming) return 1;
    return 0;
  }, [isRedeeming, VRFPending]);

  const progressPct = React.useMemo(() => {
    // 3 steps (0..2) -> 0%, 50%, 100%
    return Math.round((stepIndex / 2) * 100);
  }, [stepIndex]);

  const canRedeem = !isRedeeming && !VRFPending;
  const flowRows = React.useMemo(() => {
    const statusFor = (idx) => {
      if (stepIndex === 0) {
        return idx === 0
          ? { text: "READY", tone: "ready" }
          : { text: "PENDING", tone: "pending" };
      }
      if (stepIndex === 1) {
        if (idx === 0) return { text: "DONE", tone: "done" };
        if (idx === 1) return { text: "IN PROGRESS", tone: "active" };
        return { text: "PENDING", tone: "pending" };
      }
      // stepIndex === 2 (VRF pending)
      if (idx === 0 || idx === 1) return { text: "DONE", tone: "done" };
      return { text: "IN PROGRESS", tone: "active" };
    };

    return [
      { step: "1", label: "Ticket ready", ...statusFor(0) },
      { step: "2", label: "Wallet confirm + redeem tx", ...statusFor(1) },
      { step: "3", label: "Chainlink VRF pending", ...statusFor(2) },
    ];
  }, [stepIndex]);

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
            {VRFPending && <span className="spinner" />}
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

      <div className="redeem-flow-table-wrap" role="table" aria-label="Redeem flow table">
        <table className="redeem-flow-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Action</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {flowRows.map((row) => (
              <tr key={row.step}>
                <td className="redeem-flow-step">{row.step}</td>
                <td className="redeem-flow-label">{row.label}</td>
                <td className="redeem-flow-status">
                  <span className={`status-pill ${row.tone}`}>{row.text}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

        {VRFPending && (
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



