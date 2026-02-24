import * as React from "react";
import { formatEther } from "ethers";

import Card from "../components/Card";
import Line from "../components/Line";
import AddressLine from "../components/AddressLine";
import { explorerLink } from "../utils/format";

function formatBps(bps) {
  if (bps == null) return "--";
  const n = Number(bps);
  if (!Number.isFinite(n)) return "--";
  return `${(n / 100).toFixed(2)}%`;
}

function formatSeconds(sec) {
  if (sec == null) return "--";
  const n = Number(sec);
  if (!Number.isFinite(n)) return "--";
  if (n < 60) return `${n}s`;
  if (n < 3600) return `${(n / 60).toFixed(1)}m`;
  return `${(n / 3600).toFixed(2)}h`;
}

function formatNative(value) {
  if (value == null) return "--";
  try {
    const formatted = formatEther(value);
    return `${Number(formatted).toFixed(4)} POL`;
  } catch {
    return "--";
  }
}

function PolicyTab({ snapshot, loading, error }) {
  const p = snapshot?.policy;

  const dailyCap = p?.maxDailyBuybackNative;
  const usedToday = p?.usedToday;
  let remaining = null;
  try {
    if (dailyCap != null && usedToday != null) remaining = dailyCap - usedToday;
  } catch {
    remaining = null;
  }

  return (
    <div className="biggi-grid">
      <Card title="POLICY" subtitle="Buyback throttles, slippage, quotas (view-only)">
        {loading ? <div className="biggi-muted">Loading…</div> : null}
        {error ? <div className="biggi-muted">{String(error?.message || error)}</div> : null}

        <AddressLine label="Policy" address={p?.address} href={explorerLink(p?.address)} />

        <Line
          label="Buybacks paused"
          value={p?.buybacksPaused == null ? "--" : p.buybacksPaused ? "YES" : "NO"}
          tone={p?.buybacksPaused ? "warn" : "ok"}
        />

        <Line label="Swap slippage" value={formatBps(p?.swapSlippageBps)} />
        <Line label="TX deadline" value={formatSeconds(p?.txDeadlineSec)} />
        <Line label="Min buyback interval" value={formatSeconds(p?.minBuybackInterval)} />

        <div className="biggi-divider" />

        <Line label="Daily buyback cap" value={formatNative(dailyCap)} />
        <Line label="Used today" value={formatNative(usedToday)} />
        <Line label="Remaining today" value={formatNative(remaining)} />

        <Line label="Day index" value={p?.dayIndex == null ? "--" : String(p.dayIndex)} />
      </Card>
    </div>
  );
}

export default React.memo(PolicyTab);
