import * as React from "react";
import StatCard from "../../Common/components/StatCard.jsx";
import LineChart from "../../Charts/charts/LineChart.jsx";
import "./DRIPTab.css";

function DRIPTab({
  snapshot,
  availableSeries = [],
  capSeries = [],
  nativeSeries = [],
  stabilitySeries = [],
  isLoading,
  error,
}) {
  if (isLoading) {
    return <div className="drip-tab">Loading DRIP snapshot...</div>;
  }
  if (error) {
    return <div className="drip-tab drip-tab--error">{error?.message || String(error)}</div>;
  }

  const dist = snapshot?.distributor || {};
  const lm = snapshot?.DRIPLM || {};
  const derived = snapshot?.derived || {};

  const stats = [
    {
      label: "Available",
      value: dist.availableTokens,
      hint: derived.availablePercent,
      accent: derived.statusTone,
    },
    {
      label: "Cap remaining",
      value: dist.capRemaining,
      hint: derived.capRemainingPercent,
    },
    {
      label: "DRIPLM native",
      value: lm.nativeBalance,
      hint: lm.reserveShort,
    },
    {
      label: "DRIPLM BIGGI",
      value: lm.biggiBalance,
      hint: lm.address,
    },
    {
      label: "Total claimed",
      value: dist.totalClaimed,
      hint: dist.statusLabel,
    },
    {
      label: "Tokens per mint",
      value: dist.tokensPerMint,
      hint: dist.DRIPLMShort,
    },
  ];

  return (
    <section className="drip-tab">
      <header className="drip-tab__header">
        <h3>DRIP distribution</h3>
        <span>{snapshot?.tsLabel || "--"}</span>
      </header>
      <div className="drip-tab__stats">
        {stats.map((stat, idx) => (
          <StatCard key={`${stat.label}-${idx}`} {...stat} />
        ))}
      </div>
      <div className="drip-tab__charts">
        <div className="drip-tab__chart">
          <h4>Available BIGGI</h4>
          <LineChart points={availableSeries} height={160} />
        </div>
        <div className="drip-tab__chart">
          <h4>Cap remaining</h4>
          <LineChart points={capSeries} height={160} />
        </div>
        <div className="drip-tab__chart">
          <h4>DRIPLM native</h4>
          <LineChart points={nativeSeries} height={160} />
        </div>
        {stabilitySeries?.length ? (
          <div className="drip-tab__chart">
            <h4>BUYBACK stability</h4>
            <LineChart points={stabilitySeries} height={160} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default React.memo(DRIPTab);
