import * as React from "react";
import StatCard from "../../Common/components/StatCard.jsx";
import LineChart from "../../Charts/charts/LineChart.jsx";
import "./BUYBACKTreasuryTab.css";

export default function BUYBACKTreasuryTab({
  snapshot,
  nativeSeries = [],
  biggiSeries = [],
  treasurySeries = [],
  isLoading,
  error,
}) {
  if (isLoading) {
    return <div className="buyback-tab">Loading BUYBACK stats...</div>;
  }
  if (error) {
    return <div className="buyback-tab buyback-tab--error">{error?.message || String(error)}</div>;
  }

  const buy = snapshot?.BUYBACK || {};
  const treasury = snapshot?.treasury || {};
  const derived = snapshot?.derived || {};

  const stats = [
    {
      label: "Total spent",
      value: buy.totalNativeSpent,
      hint: derived.statusLabel,
      accent: derived.statusTone,
    },
    {
      label: "BIGGI acquired",
      value: buy.totalBiggiAcquired,
      hint: buy.lastBUYBACKLabel,
    },
    {
      label: "BUYBACK native",
      value: buy.nativeBalance,
      hint: buy.routerShort,
    },
    {
      label: "BUYBACK BIGGI",
      value: buy.biggiBalance,
      hint: buy.address,
    },
    {
      label: "Treasury BIGGI",
      value: treasury.biggiBalance,
      hint: treasury.shortAddress,
    },
    {
      label: "Treasury native",
      value: treasury.maticBalance,
      hint: treasury.totalMaticReceived,
    },
  ];

  return (
    <section className="buyback-tab">
      <header className="buyback-tab__header">
        <h3>BUYBACK & Treasury</h3>
        <span>{snapshot?.tsLabel || "--"}</span>
      </header>
      <div className="buyback-tab__stats">
        {stats.map((stat, idx) => (
          <StatCard key={`${stat.label}-${idx}`} {...stat} />
        ))}
      </div>
      <div className="buyback-tab__charts">
        <div className="buyback-tab__chart">
          <h4>Native spent</h4>
          <LineChart points={nativeSeries} height={160} />
        </div>
        <div className="buyback-tab__chart">
          <h4>BIGGI acquired</h4>
          <LineChart points={biggiSeries} height={160} />
        </div>
        <div className="buyback-tab__chart">
          <h4>Treasury BIGGI</h4>
          <LineChart points={treasurySeries} height={160} />
        </div>
      </div>
    </section>
  );
}
