"use client";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface ChartSpec {
  chartType: "bar" | "pie" | "line";
  title: string;
  data: { label: string; value: number }[];
  unit?: string;
}

// Palette compatible with light and dark mode (uses CSS variables when possible)
const COLORS = [
  "#6366f1", // primary (indigo)
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#a855f7", // purple
  "#14b8a6", // teal
  "#f97316", // orange
  "#ec4899", // pink
  "#84cc16", // lime
  "#06b6d4", // cyan
  "#8b5cf6", // violet
];

function formatValue(value: number, unit: string) {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "$") return `$${value.toLocaleString("es-AR")}`;
  if (unit === "m²") return `${value.toFixed(2)} m²`;
  if (unit === "ml") return `${value.toFixed(2)} ml`;
  return `${value.toLocaleString("es-AR")}${unit ? ` ${unit}` : ""}`;
}

export function ChartBlock({ chartType, title, data, unit = "" }: ChartSpec) {
  const rechartData = data.map((d) => ({ name: d.label, value: d.value }));

  return (
    <div className="my-2 w-full max-w-[480px] rounded-xl border bg-card p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>

      {chartType === "bar" && (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rechartData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => formatValue(v, unit)}
              width={60}
              className="fill-muted-foreground"
            />
            <Tooltip
              formatter={(value) => [formatValue(Number(value), unit), title]}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive>
              {rechartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {chartType === "pie" && (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={rechartData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              label={({ name, value }) =>
                `${name ?? ""}: ${formatValue(Number(value ?? 0), unit)}`
              }
              labelLine={false}
              isAnimationActive
            >
              {rechartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend
              formatter={(value: string) => (
                <span style={{ fontSize: 11 }}>{value}</span>
              )}
            />
            <Tooltip formatter={(value) => [formatValue(Number(value), unit), ""]} />
          </PieChart>
        </ResponsiveContainer>
      )}

      {chartType === "line" && (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={rechartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => formatValue(v, unit)}
              width={60}
              className="fill-muted-foreground"
            />
            <Tooltip
              formatter={(value) => [formatValue(Number(value), unit), title]}
              contentStyle={{ fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={COLORS[0]}
              strokeWidth={2}
              dot={{ r: 4 }}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
