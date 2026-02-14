import * as React from "react";
import SimpleLineChart from "./SimpleLineChart";

export default function TokenSupplyChart({ data, height = 260 }) {
  const chartData = Array.isArray(data) ? data : [];
  const safeHeight = Math.max(140, Number(height) || 260);
  const series = [
    { key: "minted", label: "Minted", color: "#7ad7ff" },
    { key: "mintableLeft", label: "Mintable left", color: "#f3d600" },
  ];

  return (
    <div className="token-chart" style={{ minHeight: safeHeight }}>
      <SimpleLineChart
        data={chartData}
        series={series}
        height={safeHeight}
        emptyLabel="No supply history yet."
      />
    </div>
  );
}

