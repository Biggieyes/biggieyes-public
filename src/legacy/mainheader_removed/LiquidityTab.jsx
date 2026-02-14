import * as React from "react";
import LineChart from "../charts/LineChart";
import LiquidityFLOW from "../ECOSYSTEM/â…FLOWâ…/LiquidityFLOW";
import StatCard from "../components/StatCard";
import { mapSnapshotToFLOWRows } from "../../../services/tokenomics/liquidity.mappers";
import "./LiquidityTab.css";

const selectAccent = (segment, target) =>
  segment === target ? "primary" : undefined;

const LiquidityTab = ({
  snapshot,
  history,
  chartPoints,
  isLoading,
  error,
  activeSegment,
}) => {
  const cards = [
    {
      label: "Reserve POL",
      value: snapshot?.reserve?.maticBalance ?? "N/A",
      hint: snapshot?.reserve?.shortAddress ?? "N/A",
      accent: selectAccent(activeSegment, "reserve"),
    },
    {
      label: "LM Router",
      value: snapshot?.manager?.routerShort ?? "N/A",
      hint: snapshot?.manager?.router ?? "N/A",
      accent: selectAccent(activeSegment, "lm"),
    },
    {
      label: "Vault LP",
      value: snapshot?.vault?.totalLpLocked ?? "N/A",
      hint: snapshot?.vault?.liquidityManagerShort ?? "N/A",
      accent: selectAccent(activeSegment, "vault") || "secondary",
    },
  ];

  const FLOWs = snapshot ? mapSnapshotToFLOWRows(snapshot) : [];
  const statusMessage = error
    ? "Unable to load liquidity snapshot."
    : !snapshot && isLoading
      ? "Loading liquidity data..."
      : null;

  return (
    <div className="liquidity-tab">
      <div className="liquidity-tab__cards">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {statusMessage && (
        <div className="liquidity-tab__status">{statusMessage}</div>
      )}

      <div className="liquidity-tab__chart">
        <header>
          <div>
            <h3>LP trend</h3>
            <p>Vault total LP locked over the session.</p>
          </div>
          <span className="liquidity-tab__chart-meta">
            {history?.length ? `${history.length} records` : "No history yet"}
          </span>
        </header>
        <LineChart points={chartPoints} />
      </div>

      <LiquidityFLOW FLOWs={FLOWs} activeSegment={activeSegment} />
    </div>
  );
};

export default LiquidityTab;




