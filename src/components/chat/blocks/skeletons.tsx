"use client";

import { AlertTriangle, Building2, ClipboardList, DraftingCompass, Layers, HardHat } from "lucide-react";
import { BlockShell } from "./BlockShell";

// ─────────────────────────────────────────────────────────────────────────────
// Skeletons — mismo footprint que el bloque real, animación shimmer.
// `aria-busy` para lectores de pantalla.
// ─────────────────────────────────────────────────────────────────────────────

const sk = "rounded-[4px] bg-[linear-gradient(90deg,color-mix(in_oklch,var(--foreground)_5%,transparent)_0%,color-mix(in_oklch,var(--foreground)_9%,transparent)_50%,color-mix(in_oklch,var(--foreground)_5%,transparent)_100%)] bg-[length:200%_100%] animate-[eb-shimmer_1.6s_linear_infinite]";
const skBar = "rounded-[3px] bg-[linear-gradient(90deg,color-mix(in_oklch,var(--primary)_18%,transparent),color-mix(in_oklch,var(--primary)_32%,transparent),color-mix(in_oklch,var(--primary)_18%,transparent))] bg-[length:200%_100%] animate-[eb-shimmer_1.6s_linear_infinite]";

export function MetricsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando métricas de obra">
      <BlockShell icon={Building2} fig="FIG. 02 · METRICS" title="Calculando métricas de obra…" meta="cargando…">
        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-[8px] border border-border bg-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-1.5 bg-card px-3 py-2.5">
              <div className={`${sk} h-[9px] w-12`} />
              <div className={`${sk} h-[14px] w-20`} />
              <div className={`${sk} h-[9px] w-14 opacity-50`} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between border-b border-dashed border-border pb-1">
            <div className={`${sk} h-[9px] w-12`} />
            <div className={`${sk} h-[9px] w-16`} />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="grid items-center gap-2.5" style={{ gridTemplateColumns: "130px 1fr 64px" }}>
              <div className={`${sk} ml-auto h-[10px] w-[100px]`} />
              <div className="relative h-[20px] overflow-hidden rounded-[3px] bg-muted/60">
                <div className={`${skBar} h-full`} style={{ width: `${80 - i * 12}%` }} />
              </div>
              <div className={`${sk} h-[10px] w-[50px]`} />
            </div>
          ))}
        </div>
      </BlockShell>
    </div>
  );
}

export function MediaSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando legajo gráfico">
      <BlockShell icon={DraftingCompass} fig="FIG. 03 · MEDIA" title="Cargando legajo gráfico…" meta="indexando" dense>
        <div className="grid grid-cols-[1.5fr_1fr] gap-2">
          <div className="flex flex-col overflow-hidden rounded-[8px] border border-border bg-muted/30">
            <div className={`${sk} aspect-[4/3]`} />
            <div className="flex flex-col gap-1 px-2.5 pb-2 pt-1.5">
              <div className={`${sk} h-[9px] w-[70px]`} />
              <div className={`${sk} h-[14px] w-[180px]`} />
              <div className={`${sk} h-[9px] w-[120px] opacity-50`} />
            </div>
          </div>
          <div className="grid grid-rows-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-[8px] border border-border bg-muted/30">
                <div className={`${sk} aspect-video min-h-[64px]`} />
                <div className="flex flex-col gap-1 px-2.5 pb-2 pt-1.5">
                  <div className={`${sk} h-[9px] w-[60px]`} />
                  <div className={`${sk} h-[12px] w-[110px]`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </BlockShell>
    </div>
  );
}

export function ComparisonSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cotejando proveedores">
      <BlockShell icon={Layers} fig="FIG. 04 · COMPARATIVE" title="Cotejando proveedores…" meta="consultando índices">
        <div className="grid items-center gap-2.5 border-b border-border pb-2" style={{ gridTemplateColumns: "minmax(180px,1.6fr) repeat(4,1fr) 110px" }}>
          {["OPCIÓN", "PRECIO", "PLAZO", "CALIDAD", "OBRAS", "SCORE"].map((l) => (
            <span key={l} className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">{l}</span>
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="grid items-center gap-2.5 border-b border-border py-2 last:border-b-0" style={{ gridTemplateColumns: "minmax(180px,1.6fr) repeat(4,1fr) 110px" }}>
            <div className="flex items-center gap-2.5">
              <div className={`${sk} h-[22px] w-[22px] rounded-[6px]`} />
              <div className="flex flex-1 flex-col gap-1">
                <div className={`${sk} h-[14px] w-[140px]`} />
                <div className={`${sk} h-[10px] w-[90px] opacity-50`} />
              </div>
            </div>
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className={`${sk} h-[12px] w-[60px]`} />
            ))}
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-muted/60">
                <div className={`${skBar} h-full`} style={{ width: `${75 - i * 12}%` }} />
              </div>
            </div>
          </div>
        ))}
      </BlockShell>
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div aria-busy="true" aria-label="Calculando cronograma">
      <BlockShell icon={HardHat} fig="FIG. 05 · TIMELINE" title="Calculando cronograma de avance…" meta="estimando holguras">
        <div className="grid grid-cols-[200px_1fr] gap-3 border-b border-dashed border-border pb-1.5">
          <span />
          <div className="flex items-end">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-1 justify-center">
                <div className={`${sk} h-[9px] w-[22px]`} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-[200px_1fr] items-center gap-3 py-1.5">
              <div className="flex items-center gap-2">
                <div className={`${sk} h-2 w-2 rounded-full`} />
                <div className="flex flex-1 flex-col gap-1">
                  <div className={`${sk} h-[12px] w-[130px]`} />
                  <div className={`${sk} h-[9px] w-[70px] opacity-50`} />
                </div>
              </div>
              <div className="relative h-[22px] rounded-[4px] bg-muted/60">
                <div className={`${skBar} absolute top-[2px] bottom-[2px]`} style={{ left: `${5 + i * 12}%`, width: `${38 - i * 4}%` }} />
              </div>
            </div>
          ))}
        </div>
      </BlockShell>
    </div>
  );
}

export function RiskRegisterSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando registro de riesgos">
      <BlockShell icon={AlertTriangle} fig="FIG. 06 · RISK REGISTER" title="Priorizando riesgos operativos…" meta="calculando">
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[8px] border border-border bg-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card px-3 py-2">
              <div className={`${sk} h-[9px] w-14`} />
              <div className={`${sk} mt-2 h-[18px] w-8`} />
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[1.6fr_90px_110px_90px] items-start gap-3 border-b border-border py-2 last:border-b-0">
              <div className="flex flex-col gap-1.5">
                <div className={`${sk} h-[13px] w-[190px]`} />
                <div className={`${sk} h-[10px] w-[130px] opacity-60`} />
                <div className={`${sk} h-[10px] w-[240px] opacity-50`} />
              </div>
              <div className={`${sk} h-5 w-16 rounded-[6px]`} />
              <div className={`${sk} h-[11px] w-20`} />
              <div className={`${sk} h-5 w-16 rounded-[6px] justify-self-end`} />
            </div>
          ))}
        </div>
      </BlockShell>
    </div>
  );
}

export function EvidenceLedgerSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando ledger de evidencia">
      <BlockShell icon={ClipboardList} fig="FIG. 07 · EVIDENCE LEDGER" title="Trazando evidencia del expediente…" meta="validando fuentes">
        <div className="flex items-center justify-between">
          <div className={`${sk} h-8 w-[220px] rounded-[8px]`} />
          <div className={`${sk} h-[10px] w-[130px]`} />
        </div>
        <div className="flex flex-col">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-[1.5fr_150px_90px_90px] items-start gap-3 border-b border-border py-2 last:border-b-0">
              <div className="flex items-start gap-2">
                <div className={`${sk} h-6 w-6 rounded-[6px]`} />
                <div className="flex flex-col gap-1.5">
                  <div className={`${sk} h-[13px] w-[190px]`} />
                  <div className={`${sk} h-[10px] w-[230px] opacity-50`} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className={`${sk} h-5 w-14 rounded-[6px]`} />
                <div className={`${sk} h-[10px] w-[110px] opacity-60`} />
              </div>
              <div className={`${skBar} mt-1 h-1.5 w-16`} />
              <div className={`${sk} h-5 w-16 rounded-[6px] justify-self-end`} />
            </div>
          ))}
        </div>
      </BlockShell>
    </div>
  );
}
