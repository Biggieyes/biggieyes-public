// Recharts ESM bridge with explicit default export (avoids alias recursion)
// Use subpath import so it bypasses the alias on bare "recharts"
import * as Recharts from "recharts/es6/index.js";

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

export * from "recharts/es6/index.js";
export default Recharts;

