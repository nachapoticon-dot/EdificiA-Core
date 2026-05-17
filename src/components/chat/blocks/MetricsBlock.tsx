"use client";

import { Building2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetricsSpec } from "@/lib/validators/blocks";
import { BlockShell, MonoLabel } from "./BlockShell";

// ─────────────────────────────────────────────────────────────────────────────
// MetricsBlock — KPIs (strip) + barras horizontales con incidencia / desvíos.
// Mantiene la idiom visual del ChartBlock existente (barras hechas a mano,
// no Recharts) — más rápido de renderizar y consistente con el resto.
// ─────────────────────────────────────────────────────────────────────────────
export function MetricsBlock({
  spec,
  accentVar,
}: {
  spec: MetricsSpec;
  accentVar?: string;
}) {
  const { title, kpis, bars, totalLabel = "Σ", footer } = spec;
  const max = Math.max(...bars.map((b) => b.value)) * 1.1 || 1;

  const fmt$ = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <BlockShell
      icon={Building2}
      fig="FIG. 02 · METRICS"
      title={title}
      meta={`n = ${bars.length}`}
      accentVar={accentVar}
      footer={footer ? <MonoLabel>{footer}</MonoLabel> : null}
    >
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-px overflow-hidden rounded-[8px] border border-border bg-border">
        {kpis.map((k, i) => (
          <div key={i} className="flex flex-col gap-1 bg-card px-3 py-2.5">
            <MonoLabel className="text-[9px] tracking-[0.1em]">{k.label}</MonoLabel>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[19px] font-semibold leading-none tracking-tight tabular-nums">
                {k.value}
              </div>
              <div className="flex items-center gap-1">
                {k.confidence != null && <ConfidenceBadge confidence={k.confidence} />}
                {k.delta != null && (
                  <DeltaBadge delta={k.delta} alert={k.alert} />
                )}
              </div>
            </div>
            {k.sub && (
              <MonoLabel className="text-[9.5px] tracking-[0.04em] normal-case">
                {k.sub}
              </MonoLabel>
            )}
          </div>
        ))}
      </div>

      {/* Horizontal bars */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between border-b border-dashed border-border pb-1">
          <MonoLabel>RUBRO</MonoLabel>
          <MonoLabel>INCIDENCIA</MonoLabel>
        </div>
        <div className="flex flex-col gap-1.5 pt-1">
          {bars.map((b, i) => {
            const pct = (b.value / max) * 100;
            const color = b.alert ? "var(--warn)" : accentVar ?? "var(--primary)";
            return (
              <div
                key={i}
                className="grid items-center gap-2.5"
                style={{ gridTemplateColumns: "130px 1fr 76px" }}
              >
                <span className="truncate text-right text-[11.5px] text-muted-foreground" title={b.label}>
                  {b.label}
                </span>
                <div className="relative h-[20px] overflow-hidden rounded-[3px] bg-white/[0.05]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-[3px] transition-[width] duration-500 ease-out"
                    style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.9 }}
                  />
                  {pct > 24 && (
                    <span
                      className="absolute inset-0 flex items-center pl-2 font-mono text-[10px] text-white"
                      style={{ mixBlendMode: "difference" }}
                    >
                      {fmt$(b.value)}
                    </span>
                  )}
                </div>
                <span
                  className="text-right font-mono text-[11px] font-semibold tabular-nums"
                  style={{ color }}
                >
                  {b.pct != null ? fmtPct(b.pct) : fmt$(b.value)}
                  {b.confidence != null && (
                    <span className="block text-[9px] font-normal text-muted-foreground">
                      {Math.round(b.confidence)}% conf.
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2 font-mono text-[12.5px] font-semibold">
          <MonoLabel>{totalLabel}</MonoLabel>
          <span className="tabular-nums">{fmt$(bars.reduce((s, b) => s + b.value, 0))}</span>
        </div>
      </div>
    </BlockShell>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  return (
    <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
      {Math.round(confidence)}%
    </span>
  );
}

function DeltaBadge({ delta, alert }: { delta: number; alert?: boolean }) {
  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
        alert && "bg-[color-mix(in_oklch,var(--warn)_16%,transparent)] text-[var(--warn)]",
        !alert && delta > 0 && "bg-[color-mix(in_oklch,var(--green)_14%,transparent)] text-[var(--green)]",
        !alert && delta <= 0 && "bg-[color-mix(in_oklch,var(--cyan)_14%,transparent)] text-[var(--cyan)]"
      )}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={1.5} />
      {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
    </span>
  );
}
