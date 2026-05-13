"use client";

import { useMemo } from "react";
import { Layers, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompCol, CompItem, ComparisonSpec } from "@/lib/validators/blocks";
import { BlockShell, MonoLabel } from "./BlockShell";

// ─────────────────────────────────────────────────────────────────────────────
// ComparisonBlock — ranking de proveedores/materiales con badge RECOMENDADO.
// Columnas dinámicas con `format` que decide cómo renderizar el valor.
// ─────────────────────────────────────────────────────────────────────────────
export function ComparisonBlock({
  spec,
  accentVar,
}: {
  spec: ComparisonSpec;
  accentVar?: string;
}) {
  const ranked = useMemo(
    () => [...spec.items].sort((a, b) => b.score - a.score),
    [spec.items]
  );
  const recommendedName = ranked[0]?.name ?? "";

  // grid layout: nombre + N columnas + score
  const gridCols = `minmax(180px,1.6fr) repeat(${spec.cols.length},1fr) 110px`;

  return (
    <BlockShell
      icon={Layers}
      fig="FIG. 04 · COMPARATIVE"
      title={spec.title}
      meta={`${spec.items.length} opciones`}
      accentVar={accentVar}
      footer={
        <MonoLabel>
          ranking por <span className="text-foreground">{spec.rankBy}</span>
        </MonoLabel>
      }
    >
      {/* Header row */}
      <div className="grid items-center gap-2.5 border-b border-border pb-2" style={{ gridTemplateColumns: gridCols }}>
        <MonoLabel className="text-[9.5px] tracking-[0.1em]">OPCIÓN</MonoLabel>
        {spec.cols.map((c) => (
          <MonoLabel key={c.key} className="text-[9.5px] tracking-[0.1em]">{c.label}</MonoLabel>
        ))}
        <MonoLabel className="text-[9.5px] tracking-[0.1em]">SCORE</MonoLabel>
      </div>

      {/* Rows */}
      {ranked.map((row, i) => {
        const isRec = row.name === recommendedName;
        return (
          <div
            key={row.name}
            className={cn(
              "grid items-center gap-2.5 border-b border-border py-2 text-[12px] last:border-b-0",
              isRec && "bg-[color-mix(in_oklch,var(--primary)_5%,transparent)] -mx-3.5 px-3.5"
            )}
            style={{ gridTemplateColumns: gridCols }}
          >
            {/* Name + rank */}
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-[6px] font-mono text-[11px] font-semibold",
                  isRec ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                )}
              >
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
                  <span>{row.name}</span>
                  {isRec && (
                    <span
                      className="inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em] text-white"
                      style={{ backgroundColor: accentVar ?? "var(--primary)" }}
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={1.5} /> RECOMENDADO
                    </span>
                  )}
                </div>
                {row.sub && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{row.sub}</div>}
              </div>
            </div>

            {/* Value cells */}
            {spec.cols.map((c) => (
              <CompCell key={c.key} col={c} row={row} />
            ))}

            {/* Score bar */}
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-white/[0.05]">
                <div
                  className="h-full rounded-[3px] transition-[width] duration-500 ease-out"
                  style={{
                    width: `${row.score}%`,
                    backgroundColor: isRec ? accentVar ?? "var(--primary)" : "var(--muted-foreground)",
                  }}
                />
              </div>
              <span className="w-[22px] text-right font-mono text-[12px] font-semibold tabular-nums">
                {row.score}
              </span>
            </div>
          </div>
        );
      })}
    </BlockShell>
  );
}

// ── Cell value formatter ─────────────────────────────────────────────────────
function CompCell({ col, row }: { col: CompCol; row: CompItem }) {
  const v = row.values[col.key];
  const isAlert =
    col.alertThreshold != null && typeof v === "number" ? v > col.alertThreshold : false;

  let display: string;
  if (col.format === "currency" && typeof v === "number") {
    display = `$${v.toLocaleString("es-AR")}`;
  } else if (col.format === "duration_h" && typeof v === "number") {
    display = `${v}h`;
  } else if (col.format === "boolean_iram") {
    display = v ? "✓ vigente" : "✗ vencida";
  } else if (col.format === "count_obras" && typeof v === "number") {
    display = `${v} obras`;
  } else {
    display = String(v);
  }

  const isInvalidIram = col.format === "boolean_iram" && !v;

  return (
    <div
      className={cn(
        "flex flex-col font-mono text-[11.5px] font-medium",
        (isAlert || isInvalidIram) && "text-[var(--warn)]"
      )}
    >
      <span>{display}</span>
    </div>
  );
}
