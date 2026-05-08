"use client";

import { motion } from "framer-motion";
import {
  FileSpreadsheet, FileText, FileCode2, FileType2, Image,
  CheckCircle2, ChevronRight, X, Zap,
} from "lucide-react";
import type { ProcessedFile } from "@/lib/file-processor/types";

interface FileReadyViewProps {
  file: ProcessedFile;
  onActionSelect: (actionText: string) => void;
  onRemove: () => void;
}

/* ── Per-type config ─────────────────────────────────────────────────── */

function getConfig(file: ProcessedFile) {
  switch (file.type) {
    case "excel": {
      const total = file.detectedTotal != null
        ? `$${file.detectedTotal.toLocaleString("es-AR")}`
        : "—";
      return {
        Icon: FileSpreadsheet,
        iconBg: "bg-[oklch(0.62_0.13_145)]/10",
        iconColor: "text-[oklch(0.62_0.13_145)]",
        meta: `${file.itemCount} ítems · hoja "${file.sheetName}" · ${total} declarado`,
        stats: [
          { label: "Hoja", value: file.sheetName },
          { label: "Ítems", value: String(file.itemCount) },
          { label: "Total decl.", value: total },
          { label: "Cierre", value: "✓ verificar" },
        ],
        actions: [
          { label: "Auditoría completa", hint: "9 reglas + cierre + incidencias", primary: true },
          { label: "Solo detectar exclusiones", hint: "movimientos, gastos generales, IVA" },
          { label: "Calcular incidencias por rubro", hint: "% sobre costo directo" },
          { label: "Comparar con histórico", hint: "benchmark de archivos anteriores" },
        ],
      };
    }
    case "pdf": {
      const tipo = file.isScanned ? "escaneado (imagen)" : "texto extraído";
      return {
        Icon: FileText,
        iconBg: "bg-destructive/10",
        iconColor: "text-destructive",
        meta: `${file.pageCount} páginas · ${tipo}`,
        stats: [
          { label: "Páginas", value: String(file.pageCount) },
          { label: "Tipo", value: file.isScanned ? "escaneado" : "texto" },
          { label: "Texto", value: file.text.length > 0 ? `${Math.round(file.text.length / 1000)}k chars` : "—" },
          { label: "Estado", value: "listo" },
        ],
        actions: [
          { label: "Analizá el documento", hint: "identificá tipo y extraé todos los datos", primary: true },
          { label: "Extraé datos de costos", hint: "ítems, cantidades, precios" },
          { label: "Identificá especificaciones", hint: "materiales, normas, memorias descriptivas" },
          { label: "Generá un resumen técnico", hint: "ejecutivo, apto para cliente" },
        ],
      };
    }
    case "dxf": {
      const totalEntities = Object.values(file.entitySummary).reduce((s, v) => s + v, 0);
      return {
        Icon: FileCode2,
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-500",
        meta: `${file.layers.length} capas · ${totalEntities} entidades · ${file.dimensions.length} cotas`,
        stats: [
          { label: "Capas", value: String(file.layers.length) },
          { label: "Entidades", value: totalEntities.toLocaleString("es-AR") },
          { label: "Área total", value: `${file.geometrySummary.totalAreaM2.toFixed(1)} m²` },
          { label: "Cotas", value: String(file.dimensions.length) },
        ],
        actions: [
          { label: "Analizá la geometría del plano", hint: "áreas, longitudes y cómputo métrico", primary: true },
          { label: "Calculá cómputo métrico", hint: "m² por local, ml de cerramientos" },
          { label: "Identificá locales y usos", hint: "vivienda, servicio, circulación" },
          { label: "Comparar con presupuesto", hint: "cruzá cantidades plano vs cómputo" },
        ],
      };
    }
    case "docx": {
      return {
        Icon: FileType2,
        iconBg: "bg-indigo-500/10",
        iconColor: "text-indigo-500",
        meta: `${file.wordCount.toLocaleString("es-AR")} palabras`,
        stats: [
          { label: "Palabras", value: file.wordCount.toLocaleString("es-AR") },
          { label: "Tipo", value: "documento Word" },
          { label: "Texto", value: "extraído" },
          { label: "Estado", value: "listo" },
        ],
        actions: [
          { label: "Identificá especificaciones técnicas", hint: "materiales, normas, requisitos", primary: true },
          { label: "Extraé listados de materiales", hint: "cantidades y referencias" },
          { label: "Generá resumen técnico", hint: "ejecutivo, apto para cliente" },
          { label: "Analizá datos de costos", hint: "si hay precios o presupuesto" },
        ],
      };
    }
    case "image": {
      return {
        Icon: Image,
        iconBg: "bg-orange-500/10",
        iconColor: "text-orange-500",
        meta: file.mimeType,
        stats: [
          { label: "Tipo", value: "imagen" },
          { label: "Formato", value: file.mimeType.split("/")[1]?.toUpperCase() ?? "—" },
          { label: "Análisis", value: "multimodal" },
          { label: "Estado", value: "listo" },
        ],
        actions: [
          { label: "Analizá la imagen completa", hint: "descripción técnica detallada", primary: true },
          { label: "Extraé datos del presupuesto", hint: "si es una planilla o tabla" },
          { label: "Identificá el tipo de plano", hint: "arquitectónico, eléctrico, etc." },
          { label: "Describí elementos constructivos", hint: "materiales visibles, estado de obra" },
        ],
      };
    }
    default:
      return null;
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ── Component ───────────────────────────────────────────────────────── */

export function FileReadyView({ file, onActionSelect, onRemove }: FileReadyViewProps) {
  const cfg = getConfig(file);
  if (!cfg || file.type === "dwg_unsupported") return null;

  const { Icon, iconBg, iconColor, meta, stats, actions } = cfg;

  return (
    <div className="py-10">
      <div className="mx-auto max-w-[680px] space-y-6 px-6">

        {/* ── File card ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <SectionLabel>Archivo en revisión</SectionLabel>
          <div className="mt-3 overflow-hidden rounded-[12px] border border-border bg-card">
            {/* Name row */}
            <div className="flex items-stretch border-b border-border">
              <div className={`flex w-16 shrink-0 items-center justify-center border-r border-border ${iconBg}`}>
                <Icon className={`h-6 w-6 ${iconColor}`} strokeWidth={1.5} />
              </div>
              <div className="flex-1 px-4 py-3.5">
                <p className="font-display text-[15px] font-semibold leading-tight text-foreground">
                  {file.fileName}
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {meta} · {formatSize(file.fileSize)}
                </p>
              </div>
              <button
                onClick={onRemove}
                className="flex w-12 items-center justify-center text-muted-foreground/50 transition-colors hover:text-destructive"
                title="Quitar archivo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className={`px-4 py-3 ${i < stats.length - 1 ? "border-r border-border" : ""}`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="eb-num mt-1 font-display text-[15px] font-semibold text-foreground">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Suggested actions ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <SectionLabel>Acciones sugeridas</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {actions.map((action) => (
              <ActionButton
                key={action.label}
                label={action.label}
                hint={action.hint}
                primary={action.primary}
                onClick={() => onActionSelect(action.label)}
              />
            ))}
          </div>
        </motion.div>

        {/* Divider hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center font-mono text-[10px] text-muted-foreground"
        >
          o escribí una pregunta específica en el campo de abajo ↓
        </motion.p>

      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

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

function ActionButton({
  label, hint, primary, onClick,
}: {
  label: string;
  hint: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 rounded-[10px] border p-3.5 text-left transition-colors ${
        primary
          ? "border-primary/30 bg-primary/[0.06] hover:bg-primary/10"
          : "border-border bg-card hover:bg-accent"
      }`}
    >
      {/* Icon box */}
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] ${
        primary ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}>
        {primary ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
      </div>
      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-display text-[13px] font-semibold leading-tight text-foreground">
          {label}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
      </div>
      <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
    </button>
  );
}
