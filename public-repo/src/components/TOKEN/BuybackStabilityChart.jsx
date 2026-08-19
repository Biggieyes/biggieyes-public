import * as React from "react";
import SimpleLineChart from "./SimpleLineChart";

export default function BUYBACKStabilityChart({ data, height = 280 }) {
  const chartData = Array.isArray(data) ? data : [];
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
    </div>
  );
}



