"use client";

import {
  BarChart, Bar, Cell,
  PieChart, Pie,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

export interface ChartSpec {
  chartType: "bar" | "pie" | "line";
  title: string;
  data: { label: string; value: number; alert?: boolean }[];
  unit?: string;
}

const TERRA  = "oklch(0.62 0.165 32)";
const WARN   = "oklch(0.74 0.15 75)";
const COLORS = [
  TERRA,
  "oklch(0.62 0.13 145)",
  "oklch(0.74 0.15 75)",
  "oklch(0.55 0.16 235)",
  "oklch(0.60 0.12 300)",
  "oklch(0.54 0.155 30)",
  "oklch(0.46 0.135 28)",
];

function formatValue(value: number, unit: string) {
  if (unit === "%")  return `${value.toFixed(1)}%`;
  if (unit === "$")  return `$${value.toLocaleString("es-AR")}`;
  if (unit === "m²") return `${value.toFixed(2)} m²`;
  if (unit === "ml") return `${value.toFixed(2)} ml`;
  return `${value.toLocaleString("es-AR")}${unit ? ` ${unit}` : ""}`;
}

export function ChartBlock({ chartType, title, data, unit = "" }: ChartSpec) {
  const rechartData = data.map((d) => ({ name: d.label, value: d.value, alert: d.alert }));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="my-1 w-full max-w-[520px] overflow-hidden rounded-[12px] border border-border bg-card">
      {/* Card header */}
      <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
        <div>
          <p className="font-display text-[13px] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            FIG. 01 · {unit ? `${unit} ·` : ""} n = {data.length}
          </p>
        </div>
        {unit === "%" && total > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            Σ = {total.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Chart body */}
      <div className="p-4">
        {chartType === "bar" && (
          /* Horizontal bar chart — matches design spec */
          <div className="flex flex-col gap-1.5">
            {rechartData.map((d) => {
              const max = Math.max(...rechartData.map((r) => r.value)) * 1.1 || 1;
              const pct = (d.value / max) * 100;
              const color = d.alert ? WARN : TERRA;
              return (
                <div key={d.name} className="grid items-center gap-3" style={{ gridTemplateColumns: "110px 1fr 52px" }}>
                  <span className="text-right text-[11px] text-muted-foreground truncate">{d.name}</span>
                  <div className="relative h-[18px] overflow-hidden rounded-[3px] bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-500"
                      style={{ width: `${pct}%`, background: color, opacity: 0.85 }}
                    />
                    {pct > 20 && (
                      <span
                        className="eb-num absolute inset-0 flex items-center pl-2 font-mono text-[10px] text-white"
                        style={{ mixBlendMode: "difference" }}
                      >
                        {formatValue(d.value, unit)}
                      </span>
                    )}
                  </div>
                  <span
                    className="eb-num font-mono text-[11px] font-medium"
                    style={{ color }}
                  >
                    {formatValue(d.value, unit)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {chartType === "pie" && (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={rechartData}
                cx="50%"
                cy="50%"
                outerRadius={75}
                dataKey="value"
                label={({ name, value }) => `${name ?? ""}: ${formatValue(Number(value ?? 0), unit)}`}
                labelLine={false}
                isAnimationActive
              >
                {rechartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend formatter={(v: string) => <span style={{ fontSize: 11 }}>{v}</span>} />
              <Tooltip formatter={(value) => [formatValue(Number(value), unit), ""]} />
            </PieChart>
          </ResponsiveContainer>
        )}

        {chartType === "line" && (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rechartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => formatValue(v, unit)} width={56} />
              <Tooltip formatter={(value) => [formatValue(Number(value), unit), title]} contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke={TERRA} strokeWidth={2} dot={{ r: 3 }} isAnimationActive />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
