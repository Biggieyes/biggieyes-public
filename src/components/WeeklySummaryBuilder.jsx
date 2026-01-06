// src/components/WeeklySummaryBuilder.jsx
import * as React from "react";
import { supabase, supabaseReady } from "../supabaseClient";

export default function WeeklySummaryBuilder({ onEntries }) {
  const [weekNumber, setWeekNumber] = React.useState("");
  const [entries, setEntries] = React.useState([]);
  const [status, setStatus] = React.useState("");

  const loadSummary = async () => {
    if (!supabaseReady) {
      setStatus("Supabase is not configured.");
      return;
    }
    if (!weekNumber) {
      setStatus("Enter a week.");
      return;
    }
    setStatus("Loading...");
    const { data, error } = await supabase
      .from("weekly_summary")
      .select("slot_id,wallet,amount_wei,amount")
      .eq("week", weekNumber)
      .order("slot_id", { ascending: true });

    if (error) {
      setStatus("Failed to load weekly_summary.");
      return;
    }
    const rows = Array.isArray(data) ? data : [];
    const mapped = rows.map((row) => ({
      slotId: row.slot_id,
      wallet: row.wallet,
      amountWei: row.amount_wei || row.amount,
    }));
    setEntries(mapped);
    onEntries?.(mapped);
    setStatus(`Loaded ${mapped.length} records.`);
  };

  const totalWei = entries.reduce((sum, row) => {
    const val = Number(row.amountWei || 0);
    return Number.isFinite(val) ? sum + val : sum;
  }, 0);

  return (
    <section className="moderator-center__card">
      <h3>Weekly summary</h3>
      <div className="moderator-center__field">
        <label>Week (week number)</label>
        <input
          type="text"
          placeholder="e.g. 2025-W12"
          value={weekNumber}
          onChange={(e) => setWeekNumber(e.target.value)}
        />
      </div>
      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          onClick={loadSummary}
        >
          Load from Supabase
        </button>
      </div>
      {status && <div className="muted">{status}</div>}
      {entries.length > 0 && (
        <div className="moderator-center__summary">
          <span className="muted">Records</span>
          <strong>{entries.length}</strong>
          <span className="muted">Celkem (wei)</span>
          <strong className="mono">{totalWei}</strong>
        </div>
      )}
    </section>
  );
}
