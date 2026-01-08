import * as React from "react";
import "./SimpleLineChart.css";

const DEFAULT_WIDTH = 640;
const GRID_ROWS = 4;
const GRID_COLS = 6;

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const toNumber = (value) => {
  if (isFiniteNumber(value)) return value;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const buildSegments = (
  data,
  key,
  min,
  max,
  width,
  height,
  offsetX,
  offsetY,
) => {
  const range = max - min || 1;
  const segments = [];
  let current = [];
  const count = data.length;

  data.forEach((entry, index) => {
    const raw = entry ? entry[key] : null;
    const value = toNumber(raw);
    if (!isFiniteNumber(value)) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      return;
    }
    const x =
      offsetX + (count === 1 ? width / 2 : (width / (count - 1)) * index);
    const y = offsetY + height - ((value - min) / range) * height;
    current.push({ x, y });
  });

  if (current.length) segments.push(current);
  return segments;
};

const SimpleLineChart = ({
  data = [],
  series = [],
  height = 240,
  width = DEFAULT_WIDTH,
  emptyLabel = "No data yet.",
  showLegend = true,
}) => {
  const points = Array.isArray(data) ? data : [];
  const seriesList = Array.isArray(series) ? series : [];

  const values = [];
  points.forEach((entry) => {
    seriesList.forEach((item) => {
      const value = toNumber(entry ? entry[item.key] : null);
      if (isFiniteNumber(value)) values.push(value);
    });
  });

  if (!seriesList.length || !values.length) {
    return <div className="simple-chart__empty">{emptyLabel}</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const safeHeight = Math.max(80, Number(height) || 240);
  const safeWidth = Math.max(320, Number(width) || DEFAULT_WIDTH);
  const padding = { top: 16, right: 12, bottom: 22, left: 20 };
  const plotWidth = Math.max(1, safeWidth - padding.left - padding.right);
  const plotHeight = Math.max(1, safeHeight - padding.top - padding.bottom);
  const clipIdRef = React.useRef(
    `simple-chart-clip-${Math.random().toString(36).slice(2, 9)}`,
  );
  const clipId = clipIdRef.current;

  return (
    <div className="simple-chart" style={{ minHeight: safeHeight }}>
      <svg
        viewBox={`0 0 ${safeWidth} ${safeHeight}`}
        preserveAspectRatio="none"
        className="simple-chart__svg"
        style={{ height: safeHeight }}
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
        <g className="simple-chart__grid">
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
          className="simple-chart__axis"
          x1={padding.left}
          x2={padding.left + plotWidth}
          y1={padding.top + plotHeight}
          y2={padding.top + plotHeight}
        />
        {seriesList.map((item, idx) => {
          const color = item.color || "#4ad2ff";
          const segments = buildSegments(
            points,
            item.key,
            min,
            max,
            plotWidth,
            plotHeight,
            padding.left,
            padding.top,
          );
          if (!segments.length) return null;
          const lastSegment = segments[segments.length - 1] || [];
          const lastPoint = lastSegment[lastSegment.length - 1];

          return (
            <g key={item.key || idx} clipPath={`url(#${clipId})`}>
              {segments.map((segment, segIdx) => {
                const pointsAttr = segment
                  .map((pt) => `${pt.x},${pt.y}`)
                  .join(" ");
                return (
                  <g key={`${item.key || idx}-${segIdx}`}>
                    <polyline
                      className="simple-chart__line simple-chart__line--glow"
                      points={pointsAttr}
                      stroke={color}
                    />
                    <polyline
                      className="simple-chart__line"
                      points={pointsAttr}
                      stroke={color}
                      strokeWidth={item.strokeWidth || 2}
                    />
                  </g>
                );
              })}
              {lastPoint ? (
                <circle
                  className="simple-chart__marker"
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="3.5"
                  fill={color}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {showLegend ? (
        <div className="simple-chart__legend">
          {seriesList.map((item, idx) => (
            <span key={item.key || idx} className="simple-chart__legend-item">
              <span
                className="simple-chart__legend-dot"
                style={{ background: item.color || "#4ad2ff" }}
              />
              {item.label || item.key}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default SimpleLineChart;
