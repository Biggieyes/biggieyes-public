import * as React from "react";
import StatCard from "../components/StatCard";
import ValueRow from "../components/ValueRow";
import LineChart from "../charts/LineChart";
import StatusBadge from "../components/StatusBadge";
import DRIPFLOW from "../ECOSYSTEM/â…FLOWâ…/DRIPFLOW.jsx";
import BUYBACKStabilityChart from "../../../components/TOKEN/BUYBACKStabilityChart";
import { mapDRIPSnapshotToFLOWRows } from "../../../services/tokenomics/DRIP.mappers";
import "./DRIPTab.css";

const DRIPTab = ({
  snapshot,
  availableSeries,
  capSeries,
  nativeSeries,
  stabilitySeries,
  isLoading,
  error,
}) => {
  const FLOWs = mapDRIPSnapshotToFLOWRows(snapshot);
  const statusLabel =
    snapshot?.derived?.statusLabel ?? (isLoading ? "Loading" : "Waiting");
  const statusTone = snapshot?.derived?.statusTone ?? "default";
  const sampleCount = (snapshot && availableSeries?.length) || 0;

  if (!snapshot && isLoading) {
    return <div className="DRIP-tab__empty">Loading DRIP data...</div>;
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
    <section className="DRIP-tab">
      <header className="DRIP-tab__header">
        <div>
          <p className="DRIP-tab__eyebrow">DRIP DISTRIBUTOR / DRIP LM</p>
          <h2>Stabilization pump</h2>
        </div>
        <StatusBadge status={statusLabel} tone={statusTone} />
      </header>
      <div className="DRIP-tab__meta">
        <span>Updated {snapshot?.tsLabel ?? "N/A"}</span>
        <span>{sampleCount ? `${sampleCount} samples` : "No history yet"}</span>
      </div>

      <div className="DRIP-tab__charts">
        <div className="DRIP-tab__chart-card">
          <header>
            <h4>Available tokens</h4>
            <p>DRIPDistributor balance over time.</p>
          </header>
          <LineChart points={availableSeries} />
        </div>
        <div className="DRIP-tab__chart-card">
          <header>
            <h4>Cap remaining</h4>
            <p>Daily cap left.</p>
          </header>
          <LineChart points={capSeries} />
        </div>
        <div className="DRIP-tab__chart-card">
          <header>
            <h4>Native forwarded</h4>
            <p>DRIPLM balance (native) trend.</p>
          </header>
          <LineChart points={nativeSeries} />
        </div>
      </div>

      <div className="DRIP-tab__stats">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {error ? (
        <div className="DRIP-tab__alert">
          {error.message || "Unable to refresh DRIP data."}
        </div>
      ) : null}

      <div className="DRIP-tab__split">
        <div className="DRIP-tab__column">
          <div className="DRIP-tab__panel">
            <h3>DRIPDistributor overview</h3>
            <ValueRow
              label="Distributor"
              value={snapshot?.distributor?.shortAddress ?? "--"}
              hint={snapshot?.distributor?.address ?? "--"}
            />
            <ValueRow
              label="DRIPLM"
              value={snapshot?.distributor?.DRIPLMShort ?? "--"}
              hint={snapshot?.distributor?.DRIPLM ?? "--"}
            />
            <ValueRow
              label="Treasury"
              value={snapshot?.distributor?.treasuryShort ?? "--"}
              hint={snapshot?.distributor?.treasury ?? "--"}
            />
            <ValueRow
              label="Paused"
              value={snapshot?.distributor?.paused ? "Yes" : "No"}
            />
          </div>
          <DRIPFLOW FLOWs={FLOWs} />
        </div>

        <div className="DRIP-tab__column">
          <div className="DRIP-tab__panel">
            <h3>DRIPLM config</h3>
            <ValueRow
              label="Router"
              value={snapshot?.DRIPLM?.routerShort ?? "--"}
              hint={snapshot?.DRIPLM?.router ?? "--"}
            />
            <ValueRow
              label="Reserve"
              value={snapshot?.DRIPLM?.reserveShort ?? "--"}
              hint={snapshot?.DRIPLM?.reserve ?? "--"}
            />
            <ValueRow
              label="Sell % / slippage"
              value={`${snapshot?.DRIPLM?.sellPct ?? "--"}% / ${snapshot?.DRIPLM?.slippageBps ?? "--"} bps`}
            />
            <ValueRow
              label="Deadline"
              value={
                snapshot?.DRIPLM?.txDeadlineSec
                  ? `${snapshot?.DRIPLM?.txDeadlineSec} s`
                  : "--"
              }
            />
            <ValueRow
              label="DRIPLM native"
              value={snapshot?.DRIPLM?.nativeBalance ?? "--"}
              hint="Balance"
            />
          </div>
          <div className="DRIP-tab__panel">
            <h3>FLOW history</h3>
            <p className="DRIP-tab__history-note">
              Trends are shown in the charts below.
            </p>
          </div>
          {stabilitySeries?.length ? (
            <div className="DRIP-tab__panel">
              <h3>Stabilization rail</h3>
              <p className="DRIP-tab__history-note">
                DRIP â†’ BUYBACK Agent â†’ Treasury
              </p>
              <BUYBACKStabilityChart data={stabilitySeries} height={220} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default DRIPTab;






