import * as React from "react";
import SimpleLineChart from "./SimpleLineChart";

const sampleData = [
  {
    time: "Day 1",
    DRIPDistributor: 1200,
    DRIPLm: 900,
    BUYBACKAgent: 600,
    treasury: 300,
  },
  {
    time: "Day 2",
    DRIPDistributor: 1500,
    DRIPLm: 1100,
    BUYBACKAgent: 750,
    treasury: 380,
  },
  {
    time: "Day 3",
    DRIPDistributor: 1800,
    DRIPLm: 1300,
    BUYBACKAgent: 920,
    treasury: 450,
  },
  {
    time: "Day 4",
    DRIPDistributor: 2100,
    DRIPLm: 1500,
    BUYBACKAgent: 1050,
    treasury: 520,
  },
  {
    time: "Day 5",
    DRIPDistributor: 2400,
    DRIPLm: 1750,
    BUYBACKAgent: 1180,
    treasury: 610,
  },
];

export default function BUYBACKStabilityChart({ data, height = 280 }) {
  const chartData = Array.isArray(data) && data.length ? data : sampleData;
  const isSample = !(Array.isArray(data) && data.length);
  const safeHeight = Math.max(150, Number(height) || 280);
  const series = [
    { key: "DRIPDistributor", label: "DRIP Distributor", color: "#7ad7ff" },
    { key: "DRIPLm", label: "DRIP LM", color: "#9ef0a1" },
    { key: "BUYBACKAgent", label: "BUYBACK Agent", color: "#ffb86b" },
    { key: "treasury", label: "Treasury", color: "#ff6b9b" },
  ];

  return (
    <div className="buyback-chart" style={{ minHeight: safeHeight }}>
      <SimpleLineChart
        data={chartData}
        series={series}
        height={safeHeight}
        emptyLabel="No BUYBACK history yet."
      />
      {isSample ? (
        <div className="buyback-chart__hint">
          Sample data shown - provide history for DRIP Distributor, DRIP LM,
          BUYBACK Agent, Treasury.
        </div>
      ) : null}
    </div>
  );
}



