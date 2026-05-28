"use client";

import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId } from "react";
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from "lucide-react";

export interface ChartSpec {
  chartType: "bar" | "pie" | "line";
  title: string;
  data: { label: string; value: number; alert?: boolean }[];
  unit?: string;
}

const COLORS = [
  "oklch(0.58 0.15 32)",
  "oklch(0.58 0.12 145)",
  "oklch(0.68 0.14 78)",
  "oklch(0.55 0.13 236)",
  "oklch(0.58 0.12 305)",
  "oklch(0.50 0.11 25)",
  "oklch(0.48 0.08 190)",
];

const WARN = "oklch(0.68 0.14 65)";
const MUTED_BAR = "color-mix(in oklch, var(--foreground) 7%, transparent)";

function formatNumber(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function formatValue(value: number, unit: string) {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "$") return `$${formatNumber(value)}`;
  if (unit.startsWith("$/")) return `$${formatNumber(value)}/${unit.slice(2)}`;
  if (unit === "m²" || unit === "ml") return `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${unit}`;
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

function chartMeta(chartType: ChartSpec["chartType"], unit: string, count: number) {
  const kind = chartType === "pie" ? "COMPOSICION" : chartType === "line" ? "EVOLUCION" : "COMPARATIVA";
  return `FIG. 01 · ${kind}${unit ? ` · ${unit}` : ""} · n = ${count}`;
}

export function ChartBlock({ chartType, title, data, unit = "" }: ChartSpec) {
  const rows = data.slice(0, 12).filter((d) => Number.isFinite(d.value));
  if (rows.length === 0) return null;

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(...rows.map((row) => row.value), 1);
  const Icon = chartType === "pie" ? PieChartIcon : chartType === "line" ? LineChartIcon : BarChart3;

  return (
    <div
      role="figure"
      aria-label={title}
      className="my-1 w-full max-w-[640px] overflow-hidden rounded-[12px] border border-border bg-card text-foreground shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border bg-gradient-to-b from-muted/35 to-transparent px-3.5 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-primary/10 text-primary">
            <Icon className="h-4 w-4" strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-semibold leading-tight">{title}</h3>
            <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">
              {chartMeta(chartType, unit, rows.length)}
            </p>
          </div>
        </div>
        {chartType === "pie" && unit === "%" && total > 0 && (
          <div className="shrink-0 rounded-[6px] border border-border bg-background px-2 py-1 text-right font-mono text-[10.5px] text-muted-foreground">
            Σ {total.toFixed(1)}%
          </div>
        )}
      </div>

      <div className="p-3.5">
        {chartType === "pie" && <PieBody rows={rows} total={total} unit={unit} />}
        {chartType === "bar" && <BarBody rows={rows} max={max} unit={unit} />}
        {chartType === "line" && <LineBody rows={rows} unit={unit} />}
      </div>
    </div>
  );
}

function PieBody({
  rows,
  total,
  unit,
}: {
  rows: ChartSpec["data"];
  total: number;
  unit: string;
}) {
  const chartRows = rows.map((row, index) => ({
    name: row.label,
    value: row.value,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      <div className="relative h-[230px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={chartRows}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={86}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive
            >
              {chartRows.map((row) => (
                <Cell key={row.name} fill={row.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatValue(Number(value), unit)} contentStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">total</div>
            <div className="text-[18px] font-semibold tabular-nums">{unit === "%" ? `${total.toFixed(1)}%` : formatValue(total, unit)}</div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-center gap-1.5">
        {chartRows.map((row) => {
          const share = total > 0 ? (row.value / total) * 100 : 0;
          return (
            <div key={row.name} className="grid items-center gap-2 rounded-[7px] px-2 py-1.5 hover:bg-muted/35" style={{ gridTemplateColumns: "10px minmax(0,1fr) auto" }}>
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: row.color }} />
              <span className="truncate text-[12px] text-muted-foreground" title={row.name}>{row.name}</span>
              <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
                {formatValue(row.value, unit)}
                {unit !== "%" && total > 0 && <span className="ml-1 text-muted-foreground">({share.toFixed(1)}%)</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarBody({
  rows,
  max,
  unit,
}: {
  rows: ChartSpec["data"];
  max: number;
  unit: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => {
        const color = row.alert ? WARN : COLORS[index % COLORS.length];
        const width = Math.max(2, (row.value / max) * 100);
        return (
          <div key={row.label} className="grid items-center gap-2.5" style={{ gridTemplateColumns: "minmax(92px,132px) minmax(120px,1fr) minmax(72px,auto)" }}>
            <span className="truncate text-right text-[12px] text-muted-foreground" title={row.label}>{row.label}</span>
            <div className="relative h-[24px] overflow-hidden rounded-[5px]" style={{ backgroundColor: MUTED_BAR }}>
              <div
                className="h-full rounded-[5px] transition-[width] duration-500 ease-out"
                style={{ width: `${width}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-right font-mono text-[11px] font-semibold tabular-nums" style={{ color }}>
              {formatValue(row.value, unit)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LineBody({
  rows,
  unit,
}: {
  rows: ChartSpec["data"];
  unit: string;
}) {
  const fillId = `chart-line-${useId().replace(/:/g, "")}`;
  const chartRows = rows.map((row) => ({ name: row.label, value: row.value }));

  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartRows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={COLORS[0]} stopOpacity={0.22} />
              <stop offset="100%" stopColor={COLORS[0]} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis
            width={62}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatValue(value, unit)}
          />
          <Tooltip formatter={(value) => formatValue(Number(value), unit)} contentStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={COLORS[0]}
            strokeWidth={2}
            fill={`url(#${fillId})`}
            dot={{ r: 3, strokeWidth: 1.5, fill: "var(--card)" }}
            activeDot={{ r: 4 }}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
