"use client";

import { motion } from "framer-motion";
import { FileSpreadsheet, GitCompare, X } from "lucide-react";
import type { ExcelProcessedFile } from "@/lib/file-processor/types";

interface ComparisonReadyViewProps {
  fileA: ExcelProcessedFile;
  fileB: ExcelProcessedFile;
  onSubmit: () => void;
  onRemoveB: () => void;
}

function formatTotal(total: number | null | undefined): string {
  if (total == null) return "—";
  return `$${total.toLocaleString("es-AR")}`;
}

function diffLabel(a: number | null | undefined, b: number | null | undefined): { value: string; tone: "neutral" | "up" | "down" } {
  if (a == null || b == null) return { value: "Sin total declarado en ambos", tone: "neutral" };
  const delta = b - a;
  const pct = a !== 0 ? Math.round((delta / Math.abs(a)) * 1000) / 10 : null;
  const sign = delta > 0 ? "+" : "";
  const pctText = pct != null ? ` (${sign}${pct}%)` : "";
  const tone: "up" | "down" | "neutral" = delta > 0 ? "up" : delta < 0 ? "down" : "neutral";
  return { value: `Δ ${sign}$${delta.toLocaleString("es-AR")}${pctText}`, tone };
}

export function ComparisonReadyView({ fileA, fileB, onSubmit, onRemoveB }: ComparisonReadyViewProps) {
  const delta = diffLabel(fileA.detectedTotal, fileB.detectedTotal);

  return (
    <div className="py-10">
      <div className="mx-auto max-w-[760px] space-y-6 px-6">
        <SectionLabel>Comparativa lista para auditar</SectionLabel>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <SideCard label="Versión A" file={fileA} onRemove={null} />
          <SideCard label="Versión B" file={fileB} onRemove={onRemoveB} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="rounded-[10px] border border-border bg-card px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <GitCompare className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
            <p className="font-display text-[13px] font-semibold text-foreground">
              Diferencia de total declarado
            </p>
            <p
              className={`ml-auto font-mono text-[12px] ${
                delta.tone === "up" ? "text-[oklch(0.62_0.18_60)]"
                  : delta.tone === "down" ? "text-[oklch(0.55_0.16_150)]"
                  : "text-muted-foreground"
              }`}
            >
              {delta.value}
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            El agente calculará los totales reales, detectará exclusiones lógicas y proyectará una tabla comparativa con los rubros que más se mueven.
          </p>
        </motion.div>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          onClick={onSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-3 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <GitCompare className="h-4 w-4" />
          Auditar comparativa A vs B
        </motion.button>

        <p className="text-center font-mono text-[10px] text-muted-foreground">
          o escribí una pregunta específica en el campo de abajo ↓
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function SideCard({
  label,
  file,
  onRemove,
}: {
  label: string;
  file: ExcelProcessedFile;
  onRemove: (() => void) | null;
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground/60 transition-colors hover:text-destructive"
            title="Quitar archivo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-stretch">
        <div className="flex w-12 shrink-0 items-center justify-center border-r border-border bg-[oklch(0.62_0.13_145)]/10">
          <FileSpreadsheet className="h-5 w-5 text-[oklch(0.62_0.13_145)]" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1 px-3 py-2.5">
          <p className="truncate font-display text-[13.5px] font-semibold leading-tight text-foreground" title={file.fileName}>
            {file.fileName}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {file.itemCount} ítems · hoja &quot;{file.sheetName ?? "—"}&quot;
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-border">
        <div className="px-3 py-2 border-r border-border">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Total decl.</p>
          <p className="mt-0.5 font-display text-[13px] font-semibold text-foreground">{formatTotal(file.detectedTotal)}</p>
        </div>
        <div className="px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Ítems</p>
          <p className="mt-0.5 font-display text-[13px] font-semibold text-foreground">{file.itemCount}</p>
        </div>
      </div>
    </div>
  );
}
