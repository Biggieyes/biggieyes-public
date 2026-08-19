// Local compat wrapper for Recharts under preact/compat
import * as Recharts from "../../shims/recharts-esm.js";

// Explicit named exports used across charts
export const Area = Recharts.Area;
export const AreaChart = Recharts.AreaChart;
export const CartesianGrid = Recharts.CartesianGrid;
export const Legend = Recharts.Legend;
export const ResponsiveContainer = Recharts.ResponsiveContainer;
export const Tooltip = Recharts.Tooltip;
export const XAxis = Recharts.XAxis;
export const YAxis = Recharts.YAxis;
export const Line = Recharts.Line;
export const LineChart = Recharts.LineChart;
export const ComposedChart = Recharts.ComposedChart;

// Fallback export-all
export * from "../../shims/recharts-esm.js";
export default Recharts;

