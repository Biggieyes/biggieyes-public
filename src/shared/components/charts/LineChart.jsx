import * as React from "react";
import "./LineChart.css";

function _formatNumber(value) {
  if (value === undefined || value === null) return "N/A";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const GRID_ROWS = 4;
const GRID_COLS = 5;
const CHART_PADDING = { top: 12, right: 12, bottom: 20, left: 20 };

const LineChart = ({ points = [], width = 320, height = 150, maxPoints = 48 }) => {
  const sanitized = React.useMemo(
    () =>
      points
        .map((point) => ({
          value:
            typeof point.value === "number"
              ? point.value
              : Number(point.value) || 0,
          label: point.label || "",
        }))
        .filter((point) => Number.isFinite(point.value)),
    [points],
  );
  const clipIdRef = React.useRef(
    `line-chart-clip-${Math.random().toString(36).slice(2, 9)}`,
  );
  const clipId = clipIdRef.current;
  const chartState = React.useMemo(() => {
    if (!sanitized.length) {
      return null;
    }
    const limit = Number(maxPoints) || 0;
    const reducedPoints =
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

    const values = reducedPoints.map((entry) => entry.value);
    let nextMax = Math.max(...values);
    let nextMin = Math.min(...values);
    const isFlat = nextMax === nextMin;
    if (nextMax === nextMin) {
      const delta = Math.abs(nextMax) * 0.05 || 1;
      nextMax += delta;
      nextMin -= delta;
    }
    const range = nextMax - nextMin || 1;
    const nextPlotWidth = Math.max(
      1,
      width - CHART_PADDING.left - CHART_PADDING.right,
    );
    const nextPlotHeight = Math.max(
      1,
      height - CHART_PADDING.top - CHART_PADDING.bottom,
    );
    const plotPoints =
      reducedPoints.length === 1 ? [reducedPoints[0], reducedPoints[0]] : reducedPoints;
    const coords = plotPoints.map((entry, index) => {
      const x =
        CHART_PADDING.left +
        (plotPoints.length === 1
          ? nextPlotWidth / 2
          : (nextPlotWidth / (plotPoints.length - 1)) * index);
      const y =
        CHART_PADDING.top +
        nextPlotHeight -
        ((entry.value - nextMin) / range) * nextPlotHeight;
      return { x, y };
    });

    return {
      reduced: reducedPoints,
      min: nextMin,
      max: nextMax,
      isFlat,
      pointCount: reducedPoints.length,
      plotWidth: nextPlotWidth,
      plotHeight: nextPlotHeight,
      svgPoints: coords.map((pt) => `${pt.x},${pt.y}`).join(" "),
      coords,
      latest: reducedPoints[reducedPoints.length - 1],
      first: reducedPoints[0],
      lastPoint: coords[coords.length - 1],
    };
  }, [height, maxPoints, sanitized, width]);

  if (!chartState?.latest) {
    return <div className="line-chart__empty">No liquidity history yet.</div>;
  }

  const {
    min,
    max,
    isFlat,
    pointCount,
    plotWidth,
    plotHeight,
    svgPoints,
    coords,
    first,
    latest,
    lastPoint,
  } = chartState;

  const noChange = pointCount > 1 && isFlat;
  const collecting = pointCount < 3;
  const showPointMarkers = pointCount <= 24;

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
              x={CHART_PADDING.left}
              y={CHART_PADDING.top}
              width={plotWidth}
              height={plotHeight}
              rx="6"
            />
          </clipPath>
        </defs>
        <g className="line-chart__grid">
          {Array.from({ length: GRID_ROWS + 1 }, (_, i) => {
            const y = CHART_PADDING.top + (plotHeight / GRID_ROWS) * i;
            return (
              <line
                key={`h-${i}`}
                x1={CHART_PADDING.left}
                x2={CHART_PADDING.left + plotWidth}
                y1={y}
                y2={y}
              />
            );
          })}
          {Array.from({ length: GRID_COLS + 1 }, (_, i) => {
            const x = CHART_PADDING.left + (plotWidth / GRID_COLS) * i;
            return (
              <line
                key={`v-${i}`}
                x1={x}
                x2={x}
                y1={CHART_PADDING.top}
                y2={CHART_PADDING.top + plotHeight}
              />
            );
          })}
        </g>
        <line
          className="line-chart__axis"
          x1={CHART_PADDING.left}
          x2={CHART_PADDING.left + plotWidth}
          y1={CHART_PADDING.top + plotHeight}
          y2={CHART_PADDING.top + plotHeight}
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
          {showPointMarkers
            ? coords.map((point, idx) => (
                <circle
                  key={`marker-${idx}`}
                  className="line-chart__marker line-chart__marker--minor"
                  cx={point.x}
                  cy={point.y}
                  r="2.2"
                  fill="#98ecff"
                />
              ))
            : null}
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
        <span
          className={`line-chart__status ${
            noChange ? "line-chart__status--flat" : collecting ? "line-chart__status--collecting" : ""
          }`.trim()}
        >
          {noChange
            ? "No change in current session"
            : collecting
              ? `Collecting history (${pointCount} pts)`
              : `Delta: ${_formatNumber(latest.value - first.value)}`}
        </span>
      </div>
    </div>
  );
};

export default React.memo(LineChart);

