import * as React from "react";
import "./LineChart.css";

function _formatNumber(value) {
  if (value === undefined || value === null) return "N/A";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const GRID_ROWS = 4;
const GRID_COLS = 5;

const LineChart = ({ points = [], width = 320, height = 150, maxPoints = 48 }) => {
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

  const limit = Number(maxPoints) || 0;
  const reduced =
    limit > 0 && sanitized.length > limit
      ? (() => {
          const step = Math.ceil(sanitized.length / limit);
          const sampled = [];
          for (let i = 0; i < sanitized.length; i += step) {
            sampled.push(sanitized[i]);
          }
          const last = sanitized[sanitized.length - 1];
          if (sampled[sampled.length - 1] !== last) sampled.push(last);
          return sampled;
        })()
      : sanitized;

  const values = reduced.map((entry) => entry.value);
  let max = Math.max(...values);
  let min = Math.min(...values);
  if (max === min) {
    const delta = Math.abs(max) * 0.05 || 1;
    max += delta;
    min -= delta;
  }
  const range = max - min || 1;
  const padding = { top: 12, right: 12, bottom: 20, left: 20 };
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = Math.max(1, height - padding.top - padding.bottom);
  const clipIdRef = React.useRef(
    `line-chart-clip-${Math.random().toString(36).slice(2, 9)}`,
  );
  const clipId = clipIdRef.current;

  const plotPoints =
    reduced.length === 1 ? [reduced[0], reduced[0]] : reduced;

  const coords = plotPoints.map((entry, index) => {
    const x =
      padding.left +
      (plotPoints.length === 1
        ? plotWidth / 2
        : (plotWidth / (plotPoints.length - 1)) * index);
    const y =
      padding.top + plotHeight - ((entry.value - min) / range) * plotHeight;
    return { x, y };
  });
  const svgPoints = coords.map((pt) => `${pt.x},${pt.y}`).join(" ");

  const latest = reduced[reduced.length - 1];
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

export default React.memo(LineChart);

