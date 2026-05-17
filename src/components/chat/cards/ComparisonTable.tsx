"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComparisonRow {
  label: string;
  valueA: number | null;
  valueB: number | null;
  unit?: string;
  delta: number | null;
  deltaPct: number | null;
  status: "higher" | "lower" | "equal";
}

export interface ComparisonTableSpec {
  type: "comparison_table";
  title: string;
  columnA: string;
  columnB: string;
  rows: ComparisonRow[];
}

function fmt(n: number | null, unit?: string): string {
  if (n === null) return "—";
  const formatted = unit === "%" || unit === "pct"
    ? `${n.toFixed(1)}%`
    : `$${Math.round(n).toLocaleString("es-AR")}`;
  return unit && unit !== "%" && unit !== "pct"
    ? `${Math.round(n).toLocaleString("es-AR")} ${unit}`
    : formatted;
}

export function ComparisonTable({ spec }: { spec: ComparisonTableSpec }) {
  const totalDelta = spec.rows.reduce((s, r) => s + (r.delta ?? 0), 0);

  return (
    <div className="w-full overflow-hidden rounded-[10px] border border-border bg-card">
      {/* Title */}
      <div className="border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {spec.title}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] border-b border-border bg-muted/20 px-4 py-2">
        <span className="text-[11px] font-medium text-muted-foreground">Concepto</span>
        <span className="w-32 text-right text-[11px] font-medium text-muted-foreground">{spec.columnA}</span>
        <span className="w-32 text-right text-[11px] font-medium text-muted-foreground">{spec.columnB}</span>
        <span className="w-24 text-right text-[11px] font-medium text-muted-foreground">Diferencia</span>
      </div>

      {/* Rows */}
      {spec.rows.map((row, i) => (
        <div
          key={i}
          className={cn(
            "grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-2.5",
            i < spec.rows.length - 1 ? "border-b border-border" : "",
            row.status === "higher" && row.delta !== null && row.delta > 0 && "bg-[var(--err)]/[0.02]",
          )}
        >
          <span className="text-[12px] text-foreground">{row.label}</span>
          <span className="w-32 text-right font-mono text-[12px] text-foreground">
            {fmt(row.valueA, row.unit)}
          </span>
          <span className="w-32 text-right font-mono text-[12px] text-muted-foreground">
            {fmt(row.valueB, row.unit)}
          </span>
          <DeltaCell row={row} />
        </div>
      ))}

      {/* Total delta */}
      {totalDelta !== 0 && (
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            Diferencia total
          </span>
          <span className={cn(
            "font-mono text-[13px] font-semibold",
            totalDelta > 0 ? "text-[var(--err)]" : "text-[oklch(0.55_0.13_145)]",
          )}>
            {totalDelta > 0 ? "+" : ""}${Math.round(totalDelta).toLocaleString("es-AR")}
          </span>
        </div>
      )}
    </div>
  );
}

function DeltaCell({ row }: { row: ComparisonRow }) {
  if (row.delta === null) return <span className="w-24" />;

  if (row.status === "equal") {
    return (
      <div className="flex w-24 items-center justify-end gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span className="font-mono text-[11px]">igual</span>
      </div>
    );
  }

  const isOver = row.delta > 0;
  return (
    <div className={cn(
      "flex w-24 items-center justify-end gap-1",
      isOver ? "text-[var(--err)]" : "text-[oklch(0.55_0.13_145)]",
    )}>
      {isOver
        ? <TrendingUp className="h-3 w-3" />
        : <TrendingDown className="h-3 w-3" />
      }
      <span className="font-mono text-[11px]">
        {isOver ? "+" : ""}{row.deltaPct ?? 0}%
      </span>
    </div>
  );
}
