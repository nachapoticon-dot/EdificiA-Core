"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Upload, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Clock, Info,
} from "lucide-react";
import { usePriceIndices, useUploadPriceList } from "@/hooks/usePriceIndices";
import type { PriceIndexRow } from "@/hooks/usePriceIndices";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  company_list:    { label: "Lista propia",   className: "bg-[oklch(0.93_0.08_145)] text-[var(--ok)]" },
  company_learned: { label: "Aprendido",      className: "bg-[oklch(0.95_0.05_245)] text-[oklch(0.45_0.16_245)]" },
  CAC:             { label: "CAC",            className: "bg-[oklch(0.95_0.06_25)] text-[oklch(0.45_0.18_25)]" },
  INDEC:           { label: "INDEC",          className: "bg-[oklch(0.95_0.04_65)] text-[oklch(0.45_0.14_65)]" },
};

const CATEGORY_LABELS: Record<string, string> = {
  fundaciones: "Fundaciones", estructura: "Estructura", albanileria: "Albañilería",
  cubierta: "Cubierta", sanitaria: "Inst. Sanitaria", electrica: "Inst. Eléctrica",
  terminaciones: "Terminaciones", proyecto: "Proyecto General",
  presupuesto_general: "Presupuesto General", sin_clasificar: "Sin clasificar",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodLabel(row: PriceIndexRow): string {
  if (!row.period_month) return String(row.period_year);
  return `${MONTH_NAMES[row.period_month - 1]} ${row.period_year}`;
}

function isStale(row: PriceIndexRow): boolean {
  const now = new Date();
  const rowDate = new Date(row.created_at);
  const diffDays = (now.getTime() - rowDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 45;
}

function formatARS(n: number): string {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

// ── Category group ────────────────────────────────────────────────────────────

function CategoryGroup({ category, rows }: { category: string; rows: PriceIndexRow[] }) {
  const [open, setOpen] = useState(false);
  const best = rows[0]!;
  const stale = isStale(best);
  const badge = SOURCE_BADGE[best.source] ?? { label: best.source, className: "bg-accent text-muted-foreground" };

  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-card">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        {stale
          ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[oklch(0.72_0.16_65)]" />
          : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--ok)]" />
        }
        <span className="flex-1 text-[13px] font-medium text-foreground">
          {CATEGORY_LABELS[category] ?? category}
        </span>
        <span className={`rounded-[6px] px-2 py-0.5 font-mono text-[10px] ${badge.className}`}>
          {badge.label}
        </span>
        <span className="font-mono text-[13px] font-semibold text-foreground">
          {formatARS(best.value_avg)}
          {best.unit && <span className="ml-1 text-[11px] font-normal text-muted-foreground">/{best.unit}</span>}
        </span>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {periodLabel(best)}
          {stale && <span className="ml-1 text-[oklch(0.72_0.16_65)]">· desactualizado</span>}
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/60">{rows.length} reg.</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
               : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-accent/30">
                <th className="px-4 py-2 text-left font-mono uppercase tracking-wide text-muted-foreground">Fuente</th>
                <th className="px-4 py-2 text-left font-mono uppercase tracking-wide text-muted-foreground">Descripción</th>
                <th className="px-4 py-2 text-right font-mono uppercase tracking-wide text-muted-foreground">Mín</th>
                <th className="px-4 py-2 text-right font-mono uppercase tracking-wide text-muted-foreground">Prom</th>
                <th className="px-4 py-2 text-right font-mono uppercase tracking-wide text-muted-foreground">Máx</th>
                <th className="px-4 py-2 text-left font-mono uppercase tracking-wide text-muted-foreground">Período</th>
                <th className="px-4 py-2 text-left font-mono uppercase tracking-wide text-muted-foreground">Archivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const b = SOURCE_BADGE[r.source] ?? { label: r.source, className: "bg-accent text-muted-foreground" };
                return (
                  <tr key={r.id} className={i % 2 === 0 ? "" : "bg-accent/20"}>
                    <td className="px-4 py-2">
                      <span className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] ${b.className}`}>{b.label}</span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-2 text-muted-foreground">{r.description ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{r.value_min ? formatARS(r.value_min) : "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold text-foreground">{formatARS(r.value_avg)}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{r.value_max ? formatARS(r.value_max) : "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{periodLabel(r)}</td>
                    <td className="max-w-[120px] truncate px-4 py-2 text-muted-foreground/60">{r.source_file ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Upload modal ──────────────────────────────────────────────────────────────

function UploadModal({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile]     = useState<File | null>(null);
  const [source, setSource] = useState("company_list");
  const [notes, setNotes]   = useState("");
  const [step, setStep]     = useState<"pick" | "preview" | "done">("pick");
  const [preview, setPreview] = useState<{ total: number; warnings: string[]; period_year: number; period_month: number } | null>(null);

  const { previewMutation, confirmMutation } = useUploadPriceList();

  async function handlePreview() {
    if (!file) return;
    const result = await previewMutation.mutateAsync({ file, source, notes: notes || undefined });
    setPreview(result);
    setStep("preview");
  }

  async function handleConfirm() {
    if (!file) return;
    await confirmMutation.mutateAsync({ file, source, notes: notes || undefined });
    setStep("done");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg overflow-hidden rounded-[16px] border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-[16px] font-medium text-foreground">Subir lista de precios</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {step === "pick" && (
            <>
              {/* Source selector */}
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Fuente</label>
                <div className="flex gap-2">
                  {[
                    { value: "company_list", label: "Lista de distribuidores" },
                    { value: "CAC",          label: "Índice CAC" },
                    { value: "INDEC",        label: "Índice INDEC" },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setSource(opt.value)}
                      className={`rounded-[8px] border px-3 py-1.5 text-[12px] transition-colors ${source === opt.value ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {source === "company_list" && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Para listas de distribuidores recibidas por email o entregadas en obra.
                  </p>
                )}
              </div>

              {/* File picker */}
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Archivo (Excel o CSV)</label>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
                <button onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-[10px] border border-dashed border-primary/40 bg-primary/[0.03] px-4 py-3 transition-colors hover:bg-primary/[0.07]"
                >
                  <Upload className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  <span className="text-[13px] text-muted-foreground">
                    {file ? <span className="font-medium text-foreground">{file.name}</span> : "Seleccionar archivo…"}
                  </span>
                </button>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Notas (opcional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Ej: Lista Distribuidora XYZ — Actualización mayo 2026"
                  className="w-full rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="rounded-[8px] border border-border px-4 py-2 text-[12px] text-muted-foreground hover:bg-accent">
                  Cancelar
                </button>
                <button onClick={handlePreview} disabled={!file || previewMutation.isPending}
                  className="flex items-center gap-2 rounded-[8px] bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90"
                >
                  {previewMutation.isPending
                    ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    : null}
                  Vista previa
                </button>
              </div>
            </>
          )}

          {step === "preview" && preview && (
            <>
              <div className="rounded-[10px] border border-border bg-background p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="text-[13px] font-medium text-foreground">
                    Se importarán <strong>{preview.total}</strong> precios · Período {MONTH_NAMES[(preview.period_month ?? 1) - 1]} {preview.period_year}
                  </span>
                </div>
                {preview.warnings.map((w, i) => (
                  <p key={i} className="flex items-start gap-1.5 text-[11px] text-[oklch(0.72_0.16_65)]">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{w}
                  </p>
                ))}
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Los registros existentes <strong>no se modifican</strong>. Esta carga agrega nuevas filas al historial. El sistema usará automáticamente los más recientes para comparaciones.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setStep("pick")} className="rounded-[8px] border border-border px-4 py-2 text-[12px] text-muted-foreground hover:bg-accent">
                  Volver
                </button>
                <button onClick={handleConfirm} disabled={confirmMutation.isPending}
                  className="flex items-center gap-2 rounded-[8px] bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90"
                >
                  {confirmMutation.isPending
                    ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    : null}
                  Confirmar importación
                </button>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-10 w-10 text-[var(--ok)]" />
              <p className="text-[14px] font-medium text-foreground">
                {confirmMutation.data?.inserted ?? 0} precios importados correctamente
              </p>
              <p className="text-[12px] text-muted-foreground">
                El agente usará estos índices en la próxima comparación.
              </p>
              <button onClick={onClose} className="mt-2 rounded-[8px] bg-primary px-5 py-2 text-[12px] font-semibold text-primary-foreground hover:opacity-90">
                Cerrar
              </button>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IndicesPage() {
  const { data: indices = [], isLoading } = usePriceIndices();
  const [showUpload, setShowUpload] = useState(false);

  // Group by category
  const grouped = new Map<string, PriceIndexRow[]>();
  for (const row of indices) {
    if (!grouped.has(row.category)) grouped.set(row.category, []);
    grouped.get(row.category)!.push(row);
  }

  const staleCount = [...grouped.values()].filter(rows => rows[0] && isStale(rows[0])).length;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="font-display text-[20px] font-medium tracking-[-0.01em] text-foreground">
                  Índices de Precio
                </h1>
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {grouped.size} categorías · {indices.length} registros
                  {staleCount > 0 && <span className="ml-2 text-[oklch(0.72_0.16_65)]">· {staleCount} desactualizados (+45 días)</span>}
                </p>
              </div>
            </div>
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Upload className="h-4 w-4" />
              Subir lista de precios
            </button>
          </div>

          {/* Immutability notice */}
          <div className="mt-4 flex items-start gap-2 rounded-[8px] border border-border bg-background px-3 py-2.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Los registros son <strong>inmutables</strong> — no se pueden modificar ni eliminar. Para corregir un precio, subí una versión más reciente. El sistema usa automáticamente el registro más reciente por categoría y fuente.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-4xl px-8 py-8">

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-[10px] border border-border bg-card" />
            ))}
          </div>
        )}

        {!isLoading && grouped.size === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] border border-border bg-card text-muted-foreground">
              <TrendingUp className="h-6 w-6" strokeWidth={1.25} />
            </div>
            <h2 className="font-display text-[18px] font-medium text-foreground">Sin índices todavía</h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Subí la primera lista de precios para que el agente pueda comparar presupuestos contra referencias reales.
            </p>
            <button onClick={() => setShowUpload(true)}
              className="mt-6 flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground hover:opacity-90"
            >
              <Upload className="h-4 w-4" />
              Subir primera lista
            </button>
          </div>
        )}

        {!isLoading && grouped.size > 0 && (
          <div className="space-y-2">
            {[...grouped.entries()].map(([cat, rows]) => (
              <CategoryGroup key={cat} category={cat} rows={rows} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      </AnimatePresence>
    </div>
  );
}
