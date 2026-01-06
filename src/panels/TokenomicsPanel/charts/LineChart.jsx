import * as React from "react";
import "./LineChart.css";

function _formatNumber(value) {
  if (value === undefined || value === null) return "N/A";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const GRID_ROWS = 4;
const GRID_COLS = 5;

const LineChart = ({ points = [], width = 320, height = 150 }) => {
  const sanitized = points
    .map((point) => ({
      value:
        typeof point.value === "number"
          ? point.value
          : Number(point.value) || 0,
      label: point.label || "",
    }))
    .filter((point) => Number.isFinite(point.value));

  if (!sanitized.length) {
    return <div className="line-chart__empty">No liquidity history yet.</div>;
  }

  const values = sanitized.map((entry) => entry.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const padding = { top: 12, right: 12, bottom: 20, left: 20 };
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = Math.max(1, height - padding.top - padding.bottom);
  const clipIdRef = React.useRef(
    `line-chart-clip-${Math.random().toString(36).slice(2, 9)}`,
  );
  const clipId = clipIdRef.current;

  const coords = sanitized.map((entry, index) => {
    const x =
      padding.left +
      (sanitized.length === 1
        ? plotWidth / 2
        : (plotWidth / (sanitized.length - 1)) * index);
    const y =
      padding.top + plotHeight - ((entry.value - min) / range) * plotHeight;
    return { x, y };
  });
  const svgPoints = coords.map((pt) => `${pt.x},${pt.y}`).join(" ");

  const latest = sanitized[sanitized.length - 1];
  const lastPoint = coords[coords.length - 1];

  return (
    <div className="line-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="line-chart__svg"
        style={{ height }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={padding.left}
              y={padding.top}
              width={plotWidth}
              height={plotHeight}
              rx="6"
            />
          </clipPath>
        </defs>
        <g className="line-chart__grid">
          {Array.from({ length: GRID_ROWS + 1 }, (_, i) => {
            const y = padding.top + (plotHeight / GRID_ROWS) * i;
            return (
              <line
                key={`h-${i}`}
                x1={padding.left}
                x2={padding.left + plotWidth}
                y1={y}
                y2={y}
              />
            );
          })}
          {Array.from({ length: GRID_COLS + 1 }, (_, i) => {
            const x = padding.left + (plotWidth / GRID_COLS) * i;
            return (
              <line
                key={`v-${i}`}
                x1={x}
                x2={x}
                y1={padding.top}
                y2={padding.top + plotHeight}
              />
            );
          })}
        </g>
        <line
          className="line-chart__axis"
          x1={padding.left}
          x2={padding.left + plotWidth}
          y1={padding.top + plotHeight}
          y2={padding.top + plotHeight}
        />
        <g clipPath={`url(#${clipId})`}>
          <polyline
            className="line-chart__line line-chart__line--glow"
            points={svgPoints}
            stroke="#4ad2ff"
          />
          <polyline
            className="line-chart__line"
            points={svgPoints}
            stroke="#4ad2ff"
          />
          {lastPoint ? (
            <circle
              className="line-chart__marker"
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="3.2"
              fill="#4ad2ff"
            />
          ) : null}
        </g>
      </svg>
      <div className="line-chart__meta">
        <span>Latest: {_formatNumber(latest.value)}</span>
        <span>
          Range: {_formatNumber(min)} - {_formatNumber(max)}
        </span>
      </div>
    </div>
  );
};

export default LineChart;
