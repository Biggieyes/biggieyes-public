import * as React from "react";
import SimpleLineChart from "./SimpleLineChart";

const sampleData = [
  {
    time: "Day 1",
    dripDistributor: 1200,
    dripLm: 900,
    buybackAgent: 600,
    treasury: 300,
  },
  {
    time: "Day 2",
    dripDistributor: 1500,
    dripLm: 1100,
    buybackAgent: 750,
    treasury: 380,
  },
  {
    time: "Day 3",
    dripDistributor: 1800,
    dripLm: 1300,
    buybackAgent: 920,
    treasury: 450,
  },
  {
    time: "Day 4",
    dripDistributor: 2100,
    dripLm: 1500,
    buybackAgent: 1050,
    treasury: 520,
  },
  {
    time: "Day 5",
    dripDistributor: 2400,
    dripLm: 1750,
    buybackAgent: 1180,
    treasury: 610,
  },
];

export default function BuybackStabilityChart({ data, height = 280 }) {
  const chartData = Array.isArray(data) && data.length ? data : sampleData;
  const isSample = !(Array.isArray(data) && data.length);
  const safeHeight = Math.max(150, Number(height) || 280);
  const series = [
    { key: "dripDistributor", label: "Drip Distributor", color: "#7ad7ff" },
    { key: "dripLm", label: "Drip LM", color: "#9ef0a1" },
    { key: "buybackAgent", label: "Buyback Agent", color: "#ffb86b" },
    { key: "treasury", label: "Treasury", color: "#ff6b9b" },
  ];

  return (
    <div className="buyback-chart" style={{ minHeight: safeHeight }}>
      <SimpleLineChart
        data={chartData}
        series={series}
        height={safeHeight}
        emptyLabel="No buyback history yet."
      />
      {isSample ? (
        <div className="buyback-chart__hint">
          Sample data shown - provide history for Drip Distributor, Drip LM,
          Buyback Agent, Treasury.
        </div>
      ) : null}
    </div>
  );
}

