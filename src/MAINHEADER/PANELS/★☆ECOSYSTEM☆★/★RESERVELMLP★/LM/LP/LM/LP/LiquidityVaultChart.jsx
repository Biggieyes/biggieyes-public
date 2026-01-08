import * as React from "react";
import SimpleLineChart from "./SimpleLineChart";

const sampleData = [
  { time: "Day 1", liquidity: 1000 },
  { time: "Day 2", liquidity: 1200 },
  { time: "Day 3", liquidity: 1500 },
  { time: "Day 4", liquidity: 1800 },
  { time: "Day 5", liquidity: 2100 },
];

export default function LiquidityVaultChart({ data, height = 260 }) {
  const chartData = Array.isArray(data) && data.length ? data : sampleData;
  const isSample = !(Array.isArray(data) && data.length);
  const safeHeight = Math.max(140, Number(height) || 260);
  const series = [{ key: "liquidity", label: "Liquidity", color: "#7ad7ff" }];

  return (
    <div className="liquidity-vault-chart" style={{ minHeight: safeHeight }}>
      <SimpleLineChart
        data={chartData}
        series={series}
        height={safeHeight}
        emptyLabel="No vault history yet."
      />
      {isSample ? (
        <div className="liquidity-vault-chart__hint">
          Sample data shown - provide vault history.
        </div>
      ) : null}
    </div>
  );
}
