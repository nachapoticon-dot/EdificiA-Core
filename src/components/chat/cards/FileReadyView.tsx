"use client";

import { motion } from "framer-motion";
import {
  FileSpreadsheet, FileText, FileCode2, FileType2, Image,
  CheckCircle2, ChevronRight, X, Zap, ShieldAlert, GitCompare,
} from "lucide-react";
import type { ProcessedFile } from "@/lib/file-processor/types";
import { piiLabel, type PiiScanResult } from "@/lib/security/pii-detector";
import type { ContextScanResult } from "@/lib/document-intelligence/context-scan";

interface FileReadyViewProps {
  file: ProcessedFile;
  piiScan?: PiiScanResult;
  contextScan?: ContextScanResult;
  onActionSelect: (actionText: string) => void;
  onRemove: () => void;
  onStartComparison?: () => void;
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
        headline: "Planilla estructurada",
        purpose: "Puede ser presupuesto, cómputo, comparativa o lista de precios. El agente primero la clasifica y después decide qué verificar.",
        signals: ["ítems tabulados", "valores numéricos", "rubros comparables"],
        meta: `${file.itemCount} ítems · hoja "${file.sheetName}" · ${total} declarado`,
        stats: [
          { label: "Hoja", value: file.sheetName },
          { label: "Ítems", value: String(file.itemCount) },
          { label: "Total decl.", value: total },
          { label: "Cierre", value: "✓ verificar" },
        ],
        actions: [
          { label: "Entender y auditar", hint: "clasifica, extrae señales y verifica lo que aplique", primary: true },
          { label: "Comparar precios", hint: "contra presupuesto, histórico o proveedor" },
          { label: "Calcular incidencias", hint: "rubros, partidas y peso relativo" },
          { label: "Preparar compra", hint: "usar como referencia para cotización" },
        ],
      };
    }
    case "pdf": {
      const tipo = file.isScanned ? "escaneado (imagen)" : "texto extraído";
      return {
        Icon: FileText,
        iconBg: "bg-destructive/10",
        iconColor: "text-destructive",
        headline: file.isScanned ? "PDF escaneado" : "Documento con texto",
        purpose: "Puede ser lista de precios, contrato, memoria, certificado, legajo o presupuesto. Se analiza por intención, no por plantilla fija.",
        signals: file.isScanned ? ["OCR disponible", "lectura visual", "validación manual"] : ["texto extraído", "búsqueda interna", "datos citables"],
        meta: `${file.pageCount} páginas · ${tipo}`,
        stats: [
          { label: "Páginas", value: String(file.pageCount) },
          { label: "Tipo", value: file.isScanned ? "escaneado" : "texto" },
          { label: "Texto", value: file.text.length > 0 ? `${Math.round(file.text.length / 1000)}k chars` : "—" },
          { label: "Estado", value: "listo" },
        ],
        actions: [
          { label: "Interpretar documento", hint: "tipo, propósito y datos útiles", primary: true },
          { label: "Extraer precios o costos", hint: "proveedor, moneda, unidades, importes" },
          { label: "Buscar riesgos", hint: "faltantes, vencimientos o contradicciones" },
          { label: "Resumir para obra", hint: "qué decisión habilita y próximos pasos" },
        ],
      };
    }
    case "dxf": {
      const totalEntities = Object.values(file.entitySummary).reduce((s, v) => s + v, 0);
      return {
        Icon: FileCode2,
        iconBg: "bg-blue-500/10",
        iconColor: "text-blue-500",
        headline: "Plano CAD medible",
        purpose: "Sirve para leer geometría, capas, superficies y cotas; también para cruzar cantidades contra cómputos o presupuestos.",
        signals: ["capas", "entidades CAD", "cómputo geométrico"],
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
        headline: "Documento técnico editable",
        purpose: "Puede contener memoria, pliego, contrato, especificaciones o minuta. La lectura prioriza obligaciones, materiales y restricciones.",
        signals: ["texto editable", "especificaciones", "responsables/fechas"],
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
        headline: "Imagen para lectura visual",
        purpose: "Puede ser foto de obra, plano, captura de planilla o remito. Se interpreta visualmente y se extraen señales visibles.",
        signals: ["visión multimodal", "contexto visual", "extracción manual"],
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

export function FileReadyView({ file, piiScan, contextScan, onActionSelect, onRemove, onStartComparison }: FileReadyViewProps) {
  const cfg = getConfig(file);
  if (!cfg || file.type === "dwg_unsupported") return null;

  const { Icon, iconBg, iconColor, meta, stats, actions } = cfg;
  const canCompare = file.type === "excel" && typeof onStartComparison === "function";

  return (
    <div className="py-10">
      <div className="mx-auto max-w-[760px] space-y-6 px-6">

        {piiScan?.hasMatches && <PiiWarningBanner scan={piiScan} />}
        {contextScan?.hasFindings && <ContextWarningBanner scan={contextScan} />}

        {/* ── File card ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <SectionLabel>Archivo en revisión</SectionLabel>
          <div className="mt-3 overflow-hidden rounded-[8px] border border-border bg-card shadow-sm">
            {/* Name row */}
            <div className="flex items-stretch border-b border-border bg-card">
              <div className={`flex w-[72px] shrink-0 items-center justify-center border-r border-border ${iconBg}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-border/60 bg-card/70">
                  <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.5} />
                </div>
              </div>
              <div className="min-w-0 flex-1 px-4 py-3.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                  {cfg.headline}
                </p>
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

            {/* Interpretation row */}
            <div className="grid gap-0 border-b border-border bg-background/35 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Lectura inicial
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/85">
                  {cfg.purpose}
                </p>
              </div>
              <div className="border-t border-border px-4 py-3 md:border-l md:border-t-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Señales disponibles
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cfg.signals.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-[5px] border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className={`border-border px-4 py-3 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b md:border-b-0" : ""} ${i < stats.length - 1 ? "md:border-r" : ""}`}
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
          {canCompare && (
            <button
              type="button"
              onClick={onStartComparison}
              className="mt-2 flex w-full items-center gap-3 rounded-[10px] border border-dashed border-border bg-card/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-muted text-muted-foreground">
                <GitCompare className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-[13px] font-semibold leading-tight text-foreground">
                  Comparar con otra versión (A vs B)
                </p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Subí un segundo Excel y el agente audita las diferencias en un mismo turno
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            </button>
          )}
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

function PiiWarningBanner({ scan }: { scan: PiiScanResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-[10px] border border-[oklch(0.72_0.16_60)]/50 bg-[oklch(0.72_0.16_60)]/[0.06]"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.62_0.18_60)]" strokeWidth={1.75} />
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold text-foreground">
            Datos personales detectados en el archivo
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
            Se encontraron {scan.totalCount} coincidencia{scan.totalCount === 1 ? "" : "s"}. Revisá antes de compartir externamente.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {scan.matches.map((m) => (
              <span
                key={m.type}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[oklch(0.72_0.16_60)]/30 bg-[oklch(0.72_0.16_60)]/[0.06] px-2 py-0.5 font-mono text-[10px] text-foreground/80"
                title={m.samples.join(", ")}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.62_0.18_60)]" />
                {piiLabel(m.type)} · {m.count}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ContextWarningBanner({ scan }: { scan: ContextScanResult }) {
  const strongest = scan.findings[0];
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-[10px] border border-destructive/35 bg-destructive/[0.06]"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-foreground">
            Posibles contradicciones con documentos previos
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
            {strongest?.message ?? `Se detectaron ${scan.totalCount} diferencias relevantes contra el contexto de la obra.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {scan.findings.map((finding) => (
              <span
                key={`${finding.type}:${finding.relatedFileName}`}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-destructive/25 bg-destructive/[0.04] px-2 py-0.5 font-mono text-[10px] text-foreground/80"
                title={`${finding.relatedFileName}: actual ${formatFindingNumber(finding.evidence.currentValue)} vs previo ${formatFindingNumber(finding.evidence.relatedValue)}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                {finding.relatedFileName} · {finding.evidence.deltaPct.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function formatFindingNumber(value: number): string {
  return Math.round(value).toLocaleString("es-AR");
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
