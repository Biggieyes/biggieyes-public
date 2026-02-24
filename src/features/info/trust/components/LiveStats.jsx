import * as React from "react";
import { formatUnits } from "ethers";

import useTrustSnapshot from "../hooks/useTrustSnapshot";

const cardStyle = {
  background: "#12141a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 14,
  display: "grid",
  gap: 10,
};

const titleStyle = {
  margin: 0,
  fontSize: 16,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#e6e9f2",
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "6px 0",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

const labelStyle = { color: "#9aa3b2" };
const valueStyle = { color: "#e6e9f2", fontWeight: 700 };

const formatValue = (val, decimals = 18, suffix = "") => {
  if (val == null) return "-";
  try {
    const raw = typeof val === "bigint" ? val : BigInt(val);
    const formatted = formatUnits(raw, decimals);
    const num = Number(formatted);
    const output = Number.isFinite(num)
      ? num.toLocaleString("en-US", {
          maximumFractionDigits: 4,
        })
      : formatted;
    return suffix ? `${output} ${suffix}` : output;
  } catch {
    return String(val);
  }
};

export default function TrustLiveStats() {
  const { snapshot, loading, error, refresh } = useTrustSnapshot({
    intervalMs: 15000,
  });

  const tsLabel = React.useMemo(() => {
    if (!snapshot?.ts) return "-";
    try {
      return new Date(snapshot.ts).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "-";
    }
  }, [snapshot?.ts]);

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3 style={titleStyle}>Live On-Chain Stats</h3>
        <button
          type="button"
          onClick={refresh}
          style={{
            marginLeft: "auto",
            border: "1px solid rgba(255,255,255,0.14)",
            background: "#0f1116",
            color: "#cfd6e6",
            padding: "4px 8px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div style={{ fontSize: 12, color: "#7d8796" }}>
        Last update: {tsLabel}
      </div>

      {error ? (
        <div style={{ color: "#ff8d8d", fontSize: 12 }}>
          Reader error: {error?.message || String(error)}
        </div>
      ) : null}

      <div>
        <div style={rowStyle}>
          <span style={labelStyle}>Reserve (POL)</span>
          <span style={valueStyle}>
            {formatValue(snapshot?.reserveNative, 18, "POL")}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Reserve (BIGGI)</span>
          <span style={valueStyle}>
            {formatValue(snapshot?.reserveBiggi, 18, "BIGGI")}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>LP Vault Balance</span>
          <span style={valueStyle}>
            {formatValue(snapshot?.lpVaultBalance, 18)}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Total Minted Tickets</span>
          <span style={valueStyle}>
            {snapshot?.totalMintedTickets ?? "-"}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Token Supply</span>
          <span style={valueStyle}>
            {formatValue(snapshot?.tokenSupply, 18, "BIGGI")}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Rewards Minted</span>
          <span style={valueStyle}>
            {formatValue(snapshot?.rewardsMinted, 18, "BIGGI")}
          </span>
        </div>
        <div style={{ ...rowStyle, borderBottom: "none" }}>
          <span style={labelStyle}>Drip Available</span>
          <span style={valueStyle}>
            {formatValue(snapshot?.dripAvailable, 18, "BIGGI")}
          </span>
        </div>
      </div>
    </section>
  );
}
