// src/components/ReferralList.jsx
import * as React from "react";
import { format } from "date-fns";

const shortAddr = (addr) => {
  if (!addr) return "--";
  const s = String(addr);
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

const fmtDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return format(date, "yyyy-MM-dd HH:mm");
};

export default function ReferralList({ items = [] }) {
  return (
    <section className="moderator-center__card">
      <h3>Referral list</h3>
      {items.length === 0 ? (
        <div className="muted">No data.</div>
      ) : (
        <div className="moderator-center__table">
          <div className="moderator-center__table-head">
            <span>Wallet</span>
            <span>First visit</span>
            <span>Purchase</span>
          </div>
          {items.map((row, idx) => (
            <div key={`${row.wallet}-${idx}`} className="moderator-center__table-row">
              <span className="mono">{shortAddr(row.wallet)}</span>
              <span>{fmtDate(row.firstSeen)}</span>
              <span className={row.purchased ? "ok" : "muted"}>
                {row.purchased ? "Yes" : "No"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
