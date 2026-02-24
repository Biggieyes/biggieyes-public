import * as React from "react";
import SimpleLineChart from "./SimpleLineChart";

function LiquidityVaultChart({ data, height = 260 }) {
  const chartData = Array.isArray(data) ? data : [];
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
    </div>
  );
}

export default React.memo(LiquidityVaultChart);

