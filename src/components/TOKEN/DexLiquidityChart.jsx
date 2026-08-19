import * as React from "react";
import SimpleLineChart from "./SimpleLineChart";

function DexLiquidityChart({ data, height = 320 }) {
  const chartData = Array.isArray(data) ? data : [];
  const safeHeight = Math.max(120, Number(height) || 320);
  const series = [
    { key: "reserveNative", label: "Reserve native", color: "#7ad7ff" },
    { key: "reserveBiggi", label: "Reserve BIGGI", color: "#9ef0a1" },
    { key: "price", label: "BIGGI per 1 POL", color: "#ffb86b" },
  ];

  return (
    <div className="dex-chart" style={{ minHeight: safeHeight }}>
      <SimpleLineChart
        data={chartData}
        series={series}
        height={safeHeight}
        emptyLabel="No DEX history yet."
      />
    </div>
  );
}

export default React.memo(DexLiquidityChart);

