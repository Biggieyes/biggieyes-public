import * as React from "react";
import StatCard from "../components/StatCard";
import ValueRow from "../components/ValueRow";
import LineChart from "../charts/LineChart";
import StatusBadge from "../components/StatusBadge";
import DripFlow from "../flow/DripFlow";
import BuybackStabilityChart from "../../../components/TOKEN/BuybackStabilityChart";
import { mapDripSnapshotToFlowRows } from "../../../services/tokenomics/drip.mappers";
import "./DripTab.css";

const DripTab = ({ snapshot, availableSeries, capSeries, nativeSeries, stabilitySeries, isLoading, error }) => {
  const flows = mapDripSnapshotToFlowRows(snapshot);
  const statusLabel = snapshot?.derived?.statusLabel ?? (isLoading ? "Loading" : "Waiting");
  const statusTone = snapshot?.derived?.statusTone ?? "default";
  const sampleCount = (snapshot && availableSeries?.length) || 0;

  if (!snapshot && isLoading) {
    return <div className="drip-tab__empty">Loading drip data...</div>;
  }

  const stats = [
    {
      label: "Available BIGGI",
      value: snapshot?.distributor?.availableTokens ?? "--",
      hint: snapshot?.derived?.availablePercent ?? "",
      accent: "primary",
    },
    {
      label: "Cap remaining",
      value: snapshot?.distributor?.capRemaining ?? "--",
      hint: snapshot?.derived?.capRemainingPercent ?? "",
    },
    {
      label: "Tokens per mint",
      value: snapshot?.distributor?.tokensPerMint ?? "--",
      hint: "Mint step",
    },
    {
      label: "Total claimed",
      value: snapshot?.distributor?.totalClaimed ?? "--",
      hint: "Since genesis",
      accent: "secondary",
    },
  ];

  return (
    <section className="drip-tab">
      <header className="drip-tab__header">
        <div>
          <p className="drip-tab__eyebrow">DRIP DISTRIBUTOR / DRIP LM</p>
          <h2>Stabilization pump</h2>
        </div>
        <StatusBadge status={statusLabel} tone={statusTone} />
      </header>
      <div className="drip-tab__meta">
        <span>Updated {snapshot?.tsLabel ?? "N/A"}</span>
        <span>{sampleCount ? `${sampleCount} samples` : "No history yet"}</span>
      </div>

      <div className="drip-tab__charts">
        <div className="drip-tab__chart-card">
          <header>
            <h4>Available tokens</h4>
            <p>DripDistributor balance over time.</p>
          </header>
          <LineChart points={availableSeries} />
        </div>
        <div className="drip-tab__chart-card">
          <header>
            <h4>Cap remaining</h4>
            <p>Daily cap left.</p>
          </header>
          <LineChart points={capSeries} />
        </div>
        <div className="drip-tab__chart-card">
          <header>
            <h4>Native forwarded</h4>
            <p>DripLM balance (native) trend.</p>
          </header>
          <LineChart points={nativeSeries} />
        </div>
      </div>

      <div className="drip-tab__stats">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {error ? <div className="drip-tab__alert">{error.message || "Unable to refresh drip data."}</div> : null}

      <div className="drip-tab__split">
        <div className="drip-tab__column">
          <div className="drip-tab__panel">
            <h3>DripDistributor overview</h3>
            <ValueRow
              label="Distributor"
              value={snapshot?.distributor?.shortAddress ?? "--"}
              hint={snapshot?.distributor?.address ?? "--"}
            />
            <ValueRow
              label="DripLM"
              value={snapshot?.distributor?.dripLMShort ?? "--"}
              hint={snapshot?.distributor?.dripLM ?? "--"}
            />
            <ValueRow
              label="Treasury"
              value={snapshot?.distributor?.treasuryShort ?? "--"}
              hint={snapshot?.distributor?.treasury ?? "--"}
            />
            <ValueRow label="Paused" value={snapshot?.distributor?.paused ? "Yes" : "No"} />
          </div>
          <DripFlow flows={flows} />
        </div>

        <div className="drip-tab__column">
          <div className="drip-tab__panel">
            <h3>DripLM config</h3>
            <ValueRow
              label="Router"
              value={snapshot?.dripLM?.routerShort ?? "--"}
              hint={snapshot?.dripLM?.router ?? "--"}
            />
            <ValueRow
              label="Reserve"
              value={snapshot?.dripLM?.reserveShort ?? "--"}
              hint={snapshot?.dripLM?.reserve ?? "--"}
            />
            <ValueRow
              label="Sell % / slippage"
              value={`${snapshot?.dripLM?.sellPct ?? "--"}% / ${snapshot?.dripLM?.slippageBps ?? "--"} bps`}
            />
            <ValueRow
              label="Deadline"
              value={snapshot?.dripLM?.txDeadlineSec ? `${snapshot?.dripLM?.txDeadlineSec} s` : "--"}
            />
            <ValueRow
              label="DripLM native"
              value={snapshot?.dripLM?.nativeBalance ?? "--"}
              hint="Balance"
            />
          </div>
          <div className="drip-tab__panel">
            <h3>Flow history</h3>
            <p className="drip-tab__history-note">Trends are shown in the charts below.</p>
          </div>
          {stabilitySeries?.length ? (
            <div className="drip-tab__panel">
              <h3>Stabilization rail</h3>
              <p className="drip-tab__history-note">Drip → Buyback Agent → Treasury</p>
              <BuybackStabilityChart data={stabilitySeries} height={220} />
            </div>
          ) : null}
        </div>
      </div>

    </section>
  );
};

export default DripTab;
