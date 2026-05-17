"use client";

import { useState } from "react";
import { Route, ChevronDown, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanStep {
  tool: string;
  why: string;
  expected: string;
}

export interface PlanSpec {
  hipotesis: string;
  steps: PlanStep[];
}

const TOOL_LABELS: Record<string, string> = {
  calcular_totales:                "Verificación financiera",
  validar_cierre_de_total:         "Contraste de total declarado",
  detectar_exclusiones_logicas:    "Consistencia de presupuesto",
  calcular_incidencia_de_subgrupo: "Peso de rubros",
  analizar_geometria_plano:        "Geometría del plano",
  comparar_computo_con_plano:      "Presupuesto vs plano",
  buscar_en_base_documental:       "Contexto documental",
  sugerir_formato:                 "Estándares del sector",
  analizar_estado_obra:            "Estado documental de la obra",
  comparar_con_indices:            "Índices de mercado",
};

export function PlanBlock({ spec }: { spec: PlanSpec }) {
  const [expanded, setExpanded] = useState(false);
  if (!spec.steps || spec.steps.length === 0) return null;

  return (
    <div className="w-full overflow-hidden rounded-[10px] border border-primary/25 bg-primary/[0.04]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-primary/[0.06]"
      >
        <Route className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-medium text-foreground">
              Plan de auditoría · {spec.steps.length} paso{spec.steps.length === 1 ? "" : "s"}
            </span>
            <ChevronDown
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
            <span className="inline-flex items-center gap-1 mr-1">
              <Target className="h-2.5 w-2.5" />
              <span className="font-mono uppercase tracking-[0.06em] text-[9.5px]">Hipótesis</span>
            </span>
            {spec.hipotesis}
          </p>
        </div>
      </button>

      {expanded && (
        <ol className="border-t border-primary/20 divide-y divide-primary/15">
          {spec.steps.map((step, i) => (
            <li key={i} className="flex gap-3 px-3.5 py-2.5 text-[11px]">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[9px] font-semibold text-primary">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">
                  {TOOL_LABELS[step.tool] ?? step.tool}
                  <span className="ml-1.5 font-mono text-[9.5px] text-muted-foreground/60">{step.tool}</span>
                </div>
                <p className="mt-0.5 text-muted-foreground">
                  <span className="text-foreground/70">Para </span>{step.why}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  <span className="text-foreground/70">Espera </span>{step.expected}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const PLAN_RE = /<plan>\s*(\{[\s\S]*?\})\s*<\/plan>/;
const PLAN_OPEN = "<plan>";
const PLAN_CLOSE = "</plan>";

export interface PlanExtractResult {
  plan: PlanSpec | null;
  cleanText: string;
  /** True while `<plan>` is open but `</plan>` hasn't arrived yet (streaming). */
  pending: boolean;
}

/**
 * Extracts the first `<plan>{...}</plan>` block from an assistant text.
 * Handles partial streaming: if `<plan>` is open but `</plan>` hasn't arrived,
 * the raw JSON-in-progress is hidden and `pending` is set to true.
 */
export function extractPlan(text: string): PlanExtractResult {
  const match = text.match(PLAN_RE);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]!) as PlanSpec;
      if (parsed.hipotesis && Array.isArray(parsed.steps)) {
        const cleanText = text.replace(match[0], "").replace(/^\s*\n+/, "").trimEnd();
        return { plan: parsed, cleanText, pending: false };
      }
    } catch {
      // Closed tag but JSON malformed — show as raw text so the user sees something is off.
    }
  }
  const openIdx = text.indexOf(PLAN_OPEN);
  if (openIdx !== -1 && !text.includes(PLAN_CLOSE)) {
    return { plan: null, cleanText: text.slice(0, openIdx).trimEnd(), pending: true };
  }
  return { plan: null, cleanText: text, pending: false };
}

export function PlanPendingPlaceholder() {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-primary/20 bg-primary/[0.03] px-3.5 py-2.5">
      <Route className="h-3.5 w-3.5 shrink-0 text-primary/70" strokeWidth={1.75} />
      <span className="eb-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span className="text-[11.5px] text-muted-foreground">Planificando auditoría…</span>
    </div>
  );
}
