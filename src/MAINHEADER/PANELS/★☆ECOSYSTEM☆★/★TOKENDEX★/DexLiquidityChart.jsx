import * as React from "react";
import SimpleLineChart from "./SimpleLineChart";

const sampleData = [
  { time: "Day 1", reserveNative: 120, reserveBiggi: 320000, price: 0.00038 },
  { time: "Day 2", reserveNative: 150, reserveBiggi: 360000, price: 0.00042 },
  { time: "Day 3", reserveNative: 180, reserveBiggi: 400000, price: 0.00045 },
  { time: "Day 4", reserveNative: 210, reserveBiggi: 440000, price: 0.00048 },
  { time: "Day 5", reserveNative: 240, reserveBiggi: 480000, price: 0.0005 },
];

export default function DexLiquidityChart({ data, height = 320 }) {
  const chartData = Array.isArray(data) && data.length ? data : sampleData;
  const isSample = !(Array.isArray(data) && data.length);
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
      {isSample ? (
        <div className="dex-chart__hint">
          Sample data shown - fill liquidity history (time, reserveNative,
          reserveBiggi, price).
        </div>
      ) : null}
    </div>
  );
}

