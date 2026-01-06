import * as React from "react";
import SimpleLineChart from "./SimpleLineChart";

const sampleData = [
  {
    time: "Day 1",
    totalSupply: 1000000,
    minted: 1000000 - 450000,
    mintableLeft: 450000,
  },
  {
    time: "Day 2",
    totalSupply: 1050000,
    minted: 1050000 - 430000,
    mintableLeft: 430000,
  },
  {
    time: "Day 3",
    totalSupply: 1100000,
    minted: 1100000 - 410000,
    mintableLeft: 410000,
  },
  {
    time: "Day 4",
    totalSupply: 1160000,
    minted: 1160000 - 380000,
    mintableLeft: 380000,
  },
  {
    time: "Day 5",
    totalSupply: 1200000,
    minted: 1200000 - 360000,
    mintableLeft: 360000,
  },
];

export default function TokenSupplyChart({ data, height = 260 }) {
  const chartData = Array.isArray(data) && data.length ? data : sampleData;
  const isSample = !(Array.isArray(data) && data.length);
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
      {isSample ? (
        <div className="token-chart__hint">
          Sample data shown - provide token history (time, minted,
          mintableLeft).
        </div>
      ) : null}
    </div>
  );
}
