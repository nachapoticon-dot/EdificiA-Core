"use client";

import { useState } from "react";
import { GitBranch, ChevronDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractHypothesis,
  type HypothesisBranch,
  type HypothesisSpec,
  type HypothesisExtractResult,
} from "@/lib/ai/output/hypothesis-parser";

export { extractHypothesis };
export type { HypothesisBranch, HypothesisSpec, HypothesisExtractResult };

function confidenceColor(value: number, isChosen: boolean): string {
  if (isChosen) return "text-primary";
  if (value >= 0.7) return "text-foreground";
  if (value >= 0.4) return "text-muted-foreground";
  return "text-muted-foreground/70";
}

function pctLabel(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function HypothesisBlock({ spec }: { spec: HypothesisSpec }) {
  const [expanded, setExpanded] = useState(true);
  if (!spec.branches || spec.branches.length === 0) return null;
  const sorted = [...spec.branches].sort((a, b) => b.confidence - a.confidence);
  const chosenName = spec.chosen?.trim();

  return (
    <div className="w-full overflow-hidden rounded-[10px] border border-[oklch(0.55_0.16_245)]/25 bg-[oklch(0.55_0.16_245)]/[0.04]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[oklch(0.55_0.16_245)]/[0.06]"
      >
        <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.55_0.16_245)]" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-medium text-foreground">
              Hipótesis · {sorted.length} rama{sorted.length === 1 ? "" : "s"}
            </span>
            {chosenName && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-primary">
                <CheckCircle2 className="h-2.5 w-2.5" />
                elegida
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </div>
          {chosenName && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              <span className="font-mono uppercase tracking-[0.06em] text-[9.5px] text-foreground/70 mr-1">Elegida:</span>
              {chosenName}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <ol className="border-t border-[oklch(0.55_0.16_245)]/20 divide-y divide-[oklch(0.55_0.16_245)]/15">
          {sorted.map((branch, i) => {
            const isChosen = chosenName != null && branch.name.trim() === chosenName;
            return (
              <li key={`${branch.name}-${i}`} className="flex gap-3 px-3.5 py-2.5 text-[11px]">
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-semibold",
                    isChosen ? "bg-primary text-primary-foreground" : "bg-[oklch(0.55_0.16_245)]/15 text-[oklch(0.55_0.16_245)]",
                  )}
                >
                  {isChosen ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium", isChosen ? "text-primary" : "text-foreground")}>{branch.name}</span>
                    <span className={cn("font-mono text-[9.5px]", confidenceColor(branch.confidence, isChosen))}>
                      {pctLabel(branch.confidence)}
                    </span>
                  </div>
                  <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                    <div
                      className={cn("h-full rounded-full", isChosen ? "bg-primary" : "bg-[oklch(0.55_0.16_245)]/60")}
                      style={{ width: pctLabel(branch.confidence) }}
                    />
                  </div>
                  {branch.evidence && (
                    <p className="mt-1 text-muted-foreground">
                      <span className="text-foreground/70">Evidencia </span>
                      {branch.evidence}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {spec.rationale && (
        <div className="border-t border-[oklch(0.55_0.16_245)]/15 bg-[oklch(0.55_0.16_245)]/[0.03] px-3.5 py-2 text-[11px] text-muted-foreground">
          <span className="font-mono uppercase tracking-[0.06em] text-[9.5px] text-foreground/70 mr-1">Por qué</span>
          {spec.rationale}
        </div>
      )}
    </div>
  );
}

export function HypothesisPendingPlaceholder() {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-[oklch(0.55_0.16_245)]/20 bg-[oklch(0.55_0.16_245)]/[0.03] px-3.5 py-2.5">
      <GitBranch className="h-3.5 w-3.5 shrink-0 text-[oklch(0.55_0.16_245)]/70" strokeWidth={1.75} />
      <span className="eb-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-[oklch(0.55_0.16_245)]" />
      <span className="text-[11.5px] text-muted-foreground">Evaluando hipótesis…</span>
    </div>
  );
}
