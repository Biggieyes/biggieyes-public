import * as React from "react";
import StatCard from "../../Common/components/StatCard.jsx";
import LineChart from "../../Charts/charts/LineChart.jsx";
import useDistributorHistory from "../../../hooks/tokenomics/useDistributorHistory";
import { shortAddr } from "../utils/format.js";
import "./DistributorTokenTab.css";

const toNumber = (value) => {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const formatMaybeAmount = (value, unit, digits = 2) => {
  const num = toNumber(value);
  if (num != null) {
    return `${num.toLocaleString("en-US", { maximumFractionDigits: digits })} ${unit}`.trim();
  }
  if (value == null || value === "") return "--";
  const raw = String(value).trim();
  return unit && raw.includes(unit) ? raw : `${raw} ${unit}`.trim();
};

export default function DistributorTokenTab({
  distributorData,
  tokenSnapshot,
  BUYBACKSnapshot,
  BUYBACKFallback,
  DRIPAvailable,
  tokenTotalSupply,
}) {
  const dist = distributorData || {};
  const token = tokenSnapshot?.token || {};
  const buybackTotal =
    BUYBACKSnapshot?.BUYBACK?.totalBiggiAcquired ??
    BUYBACKFallback ??
    "--";
  const { points } = useDistributorHistory(dist);

  const stats = [
    {
      label: "Total received",
      value: formatMaybeAmount(dist.totalReceived ?? dist.totalDistributed, "POL"),
      hint: "Distributor",
      accent: "primary",
    },
    {
      label: "Pending reserve",
      value: formatMaybeAmount(dist.pendingReserve, "POL"),
      hint: shortAddr(dist.reserve),
    },
    {
      label: "Pending BUYBACK",
      value: formatMaybeAmount(dist.pendingBUYBACK ?? dist.pendingBUYBACKAgent, "POL"),
      hint: shortAddr(dist.BUYBACKAgent),
      accent: "secondary",
    },
    {
      label: "Pending treasury",
      value: formatMaybeAmount(dist.pendingTreasury, "POL"),
      hint: shortAddr(dist.treasury),
    },
    {
      label: "Pending REWARDS",
      value: formatMaybeAmount(dist.pendingCOLLECTIONREWARDS, "POL"),
      hint: shortAddr(dist.COLLECTIONREWARDS),
    },
    {
      label: "Community pool",
      value: formatMaybeAmount(dist.pendingCOMMUNITYCENTER ?? dist.communityPoolBalance, "POL"),
      hint: shortAddr(dist.COMMUNITYCENTER),
    },
    {
      label: "DRIP available",
      value: formatMaybeAmount(DRIPAvailable, "BIGGI"),
      hint: shortAddr(dist.DRIPDistributor),
    },
    {
      label: "Token supply",
      value: formatMaybeAmount(tokenTotalSupply ?? token.totalSupply, "BIGGI", 0),
      hint: token.symbol || "BIGGI",
    },
    {
      label: "BUYBACK acquired",
      value: formatMaybeAmount(buybackTotal, "BIGGI"),
      hint: shortAddr(dist.BUYBACKAgent),
    },
  ];

  const metaRows = [
    { label: "Distributor", value: shortAddr(dist.address) },
    { label: "Reserve", value: shortAddr(dist.reserve) },
    { label: "Treasury", value: shortAddr(dist.treasury) },
    { label: "BUYBACK Agent", value: shortAddr(dist.BUYBACKAgent) },
    { label: "REWARDS", value: shortAddr(dist.COLLECTIONREWARDS) },
    { label: "Community", value: shortAddr(dist.COMMUNITYCENTER) },
  ];

  return (
    <section className="distributor-token-tab">
      <header className="distributor-token-tab__header">
        <h3>Distributor overview</h3>
      </header>
      <div className="distributor-token-tab__content">
        <div className="distributor-token-tab__column">
          {stats.map((stat, idx) => (
            <StatCard key={`${stat.label}-${idx}`} {...stat} />
          ))}
        </div>
        <div className="distributor-token-tab__column">
          <div className="distributor-token-tab__meta">
            <div className="distributor-token-tab__meta-title">Key addresses</div>
            <div className="distributor-token-tab__meta-list">
              {metaRows.map((row) => (
                <div key={row.label} className="distributor-token-tab__meta-row">
                  <span>{row.label}</span>
                  <span className="distributor-token-tab__meta-address">
                    {row.value || "--"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="distributor-token-tab__chart-wrap">
            <header>
              <h4>Total received trend</h4>
              <span>{points?.length ? "Last updates" : "No data"}</span>
            </header>
            <LineChart points={points || []} height={160} />
          </div>
        </div>
      </div>
    </section>
  );
}
