// src/components/TransactionsModal.jsx
import * as React from "react";

export default function TransactionsModal({
  open,
  status,
  txHash,
  message,
  onClose,
}) {
  if (!open) return null;
  return (
    <div className="moderator-center__modal" role="dialog" aria-modal="true">
      <div className="moderator-center__modal-card">
        <h3>Transaction</h3>
        <div className="moderator-center__modal-body">
          <div className="muted">Stav</div>
          <strong>{status || "Waiting for confirmation"}</strong>
          {message && <div className="muted">{message}</div>}
          {txHash && (
            <div className="mono" style={{ wordBreak: "break-all" }}>
              {txHash}
            </div>
          )}
        </div>
        <div className="moderator-center__actions">
          <button
            type="button"
            className="biggi-btn biggi-btn--ghost"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
