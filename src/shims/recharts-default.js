// Recharts shim to provide both default and named exports explicitly (works with preact/compat)
import * as Recharts from "recharts";

// Explicit named re-exports to keep esbuild happy
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

// Fallback: re-export everything else
export * from "recharts";

// Default bundle
export default Recharts;

