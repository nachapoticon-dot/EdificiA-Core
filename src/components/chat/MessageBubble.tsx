"use client";

import {
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
  type UIMessagePart,
  type UIDataTypes,
  type UITools,
} from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { AlertTriangle, ThumbsDown, FileSpreadsheet, FileText, FileCode2, FileType2 } from "lucide-react";
import { ChartBlock, type ChartSpec } from "./cards/ChartBlock";
import { DocumentProposalCard, type FileProposal } from "./cards/DocumentProposalCard";
import { FindingCallout, type FindingSpec } from "./cards/FindingCallout";
import { ComparisonTable, type ComparisonTableSpec } from "./cards/ComparisonTable";
import { GeneratedDocCard, type DocGenerationProposal } from "./cards/GeneratedDocCard";
import { PlanBlock, PlanPendingPlaceholder, extractPlan } from "./cards/PlanBlock";
import { HypothesisBlock, HypothesisPendingPlaceholder, extractHypothesis } from "./cards/HypothesisBlock";
import { ResponseBlock } from "./blocks";
import { BlockSpec, type BlockKind } from "@/lib/validators/blocks";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useState } from "react";

// ── File attachment card (shown in user messages) ────────────────────────────

interface FileMeta {
  fileName: string;
  type: "excel" | "pdf" | "dxf" | "docx" | "image";
  fileSize?: number;
  itemCount?: number;
  sheetName?: string;
  detectedTotal?: number;
  pageCount?: number;
  isScanned?: boolean;
  wordCount?: number;
}

const FILE_ICONS: Record<FileMeta["type"], React.ElementType> = {
  excel: FileSpreadsheet,
  pdf:   FileText,
  dxf:   FileCode2,
  docx:  FileType2,
  image: FileType2,
};

// Each file type gets a distinct accent tint. Both the icon tile background
// and the icon foreground use the same hue so the card reads as a single
// "chip" instead of an icon floating on a generic surface.
const FILE_ACCENTS: Record<FileMeta["type"], { badge: string }> = {
  excel: { badge: "XLSX" },
  pdf:   { badge: "PDF"  },
  dxf:   { badge: "DXF"  },
  docx:  { badge: "DOCX" },
  image: { badge: "IMG"  },
};

function parseFileMeta(text: string): FileMeta | null {
  const MARKER = "__file_meta__:";
  const markerIdx = text.indexOf(MARKER);
  if (markerIdx === -1) return null;
  const lineEnd = text.indexOf("\n", markerIdx);
  const jsonStr = text.slice(markerIdx + MARKER.length, lineEnd === -1 ? undefined : lineEnd);
  try { return JSON.parse(jsonStr) as FileMeta; } catch { return null; }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileAttachmentCard({ meta }: { meta: FileMeta }) {
  const Icon = FILE_ICONS[meta.type] ?? FileType2;
  const accent = FILE_ACCENTS[meta.type] ?? FILE_ACCENTS.docx;

  // Build metadata chunks separated by bullets
  const chunks: string[] = [accent.badge];
  if (meta.type === "excel") {
    if (meta.itemCount != null) chunks.push(`${meta.itemCount} ítems`);
    if (meta.detectedTotal != null) chunks.push(`$${meta.detectedTotal.toLocaleString("es-AR")}`);
  } else if (meta.type === "pdf") {
    if (meta.pageCount != null) chunks.push(`${meta.pageCount} pág${meta.pageCount === 1 ? "" : "s"}`);
    if (meta.isScanned) chunks.push("escaneado");
  } else if (meta.type === "docx") {
    if (meta.wordCount != null) chunks.push(`${meta.wordCount.toLocaleString("es-AR")} palabras`);
  }
  if (meta.fileSize) chunks.push(formatBytes(meta.fileSize));

  return (
    <div
      className="file-accent group flex max-w-[340px] items-center gap-3 rounded-[10px] border border-border bg-[color-mix(in_oklch,var(--user-bg)_88%,var(--background))] px-3.5 py-3 text-[var(--user-fg)] shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--user-bg)]"
      data-ftype={meta.type}
    >
      {/* Icon tile */}
      <div className={cn(
        "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-border bg-[var(--file-tint)]",
      )}>
        <Icon className="h-5 w-5 text-[var(--file-color)]" strokeWidth={1.5} />
      </div>

      {/* Filename + metadata line */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-[13.5px] font-medium leading-tight">
          {meta.fileName}
        </p>
        <p className="truncate font-mono text-[10.5px] tracking-[0.01em] text-[var(--user-meta)]">
          {chunks.join(" • ")}
        </p>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: UIMessage;
  onFeedback?: () => void;
  onAdjustDocument?: (proposal: DocGenerationProposal, instructions: string) => void;
}

/* ── Tool label map ── */
const TOOL_LABELS: Record<string, string> = {
  calcular_totales:                "Verificando estructura financiera",
  validar_cierre_de_total:         "Contrastando total declarado",
  detectar_exclusiones_logicas:    "Leyendo consistencia del presupuesto",
  calcular_incidencia_de_subgrupo: "Analizando peso de rubros",
  analizar_geometria_plano:        "Analizando geometría del plano",
  comparar_computo_con_plano:      "Comparando presupuesto con plano",
  generar_grafica:                 "Generando gráfica",
  buscar_en_base_documental:       "Contrastando con contexto de obra",
  sugerir_formato:                 "Comparando con estándares del sector",
  generar_archivo:                 "Generando archivo",
  generar_presupuesto_excel:       "Generando presupuesto Excel",
  generar_memoria_descriptiva:     "Generando memoria descriptiva",
  generar_informe_pdf:             "Generando informe de auditoría PDF",
  reportar_hallazgo:               "Registrando hallazgo",
  reportar_hallazgos_batch:        "Preparando síntesis de riesgos",
  comparar_presupuestos:           "Generando tabla comparativa",
  analizar_estado_obra:            "Analizando estado documental de la obra",
  comparar_con_indices:            "Comparando precios con índices de mercado",
  evaluar_impacto_clima:           "Consultando pronóstico meteorológico",
  verificar_ingreso_personal:      "Verificando legajo HSE de la cuadrilla",
  reprogramar_e_informar:          "Reprogramando tarea y registrando evento",
  auditar_curva_inversion:         "Auditando curva S vs plan",
  registrar_subcontrato:           "Registrando subcontrato de obra",
  auditar_subcontratos:            "Auditando subcontratos y retenciones",
  buscar_relaciones_documento:     "Consultando knowledge graph de obra",
  registrar_snapshot_financiero:   "Registrando snapshot financiero",
  registrar_hse_record:            "Registrando legajo HSE",
  registrar_acopio:                "Registrando acopio de obra",
  resolver_relacion_documental:    "Resolviendo relación del knowledge graph",
  resumen_diario_obra:             "Armando brief diario de obra",
  consultar_perfil_empresa:        "Consultando perfil de empresa",
  generar_orden_compra:            "Armando orden de compra",
  generar_acta_obra:               "Generando parte diario de obra",
  enviar_email_stakeholder:        "Enviando email a stakeholders",
  proyectar_metricas:              "Preparando métricas visuales",
  proyectar_legajo_grafico:        "Armando legajo gráfico",
  proyectar_comparativa:           "Construyendo comparativa operativa",
  proyectar_cronograma:            "Proyectando cronograma",
  proyectar_riesgos:               "Priorizando riesgos operativos",
  proyectar_evidencia:             "Ordenando evidencia citable",
};

const SPECIAL_TOOLS = new Set([
  "generar_grafica",
  "generar_archivo",
  "generar_presupuesto_excel",
  "generar_memoria_descriptiva",
  "generar_informe_pdf",
  "generar_orden_compra",
  "generar_acta_obra",
  "reportar_hallazgo",
  "reportar_hallazgos_batch",
  "comparar_presupuestos",
  "proyectar_metricas",
  "proyectar_legajo_grafico",
  "proyectar_comparativa",
  "proyectar_cronograma",
  "proyectar_riesgos",
  "proyectar_evidencia",
]);

/* ── Segment types for the grouped renderer ── */
type TextSegment        = { kind: "text";          part: UIMessagePart<UIDataTypes, UITools> };
type ToolTimelineSegment = { kind: "tool-timeline"; parts: UIMessagePart<UIDataTypes, UITools>[] };
type BlockResultSegment = { kind: "block-result"; part: UIMessagePart<UIDataTypes, UITools> };

type Segment = TextSegment | ToolTimelineSegment | BlockResultSegment;

type ToolInvocationData = {
  toolName?: string;
  state?: string;
  result?: unknown;
  output?: unknown;
  errorText?: string;
};

function getToolInvocation(part: UIMessagePart<UIDataTypes, UITools>): ToolInvocationData | null {
  const p = part as unknown as {
    type?: string;
    toolName?: string;
    state?: string;
    result?: unknown;
    output?: unknown;
    errorText?: string;
    toolInvocation?: ToolInvocationData;
  };

  if (p.toolInvocation) return p.toolInvocation;

  const toolName =
    p.toolName ??
    (typeof p.type === "string" && p.type.startsWith("tool-")
      ? p.type.slice("tool-".length)
      : undefined);

  if (!toolName) return null;

  return {
    toolName,
    state: p.state,
    result: p.result ?? p.output,
    output: p.output,
    errorText: p.errorText,
  };
}

/**
 * Groups consecutive tool calls into ONE timeline segment, then emits the
 * visual block-results for any special tools after it. This collapses the
 * noisy 5-spinner experience into a single status indicator while keeping
 * the actual response blocks (charts, findings, doc cards) visible.
 */
function buildSegments(parts: UIMessagePart<UIDataTypes, UITools>[]): Segment[] {
  const segments: Segment[] = [];
  let pending: UIMessagePart<UIDataTypes, UITools>[] = [];

  function flush() {
    if (pending.length === 0) return;
    segments.push({ kind: "tool-timeline", parts: pending });
    for (const p of pending) {
      const name = getToolInvocation(p)?.toolName ?? "";
      if (SPECIAL_TOOLS.has(name)) {
        segments.push({ kind: "block-result", part: p });
      }
    }
    pending = [];
  }

  for (const part of parts) {
    if (isTextUIPart(part)) {
      flush();
      segments.push({ kind: "text", part });
      continue;
    }
    if (isToolUIPart(part)) {
      pending.push(part);
    }
  }
  flush();

  return segments;
}

/* ── Main component ── */

export function MessageBubble({ message, onFeedback, onAdjustDocument }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const segments = buildSegments(message.parts);
  const timestamp = formatTime((message as { createdAt?: Date | string | number }).createdAt);
  const [hovered, setHovered] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  function handleFeedback() {
    if (feedbackSent || !onFeedback) return;
    setFeedbackSent(true);
    onFeedback();
  }

  return (
    <div
      className={cn("flex gap-3 px-3 py-3 md:px-6", isUser ? "justify-end" : "justify-start")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Agent avatar */}
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-primary text-primary-foreground">
          <span className="font-display text-[13px] font-semibold italic leading-none select-none">E</span>
        </div>
      )}

      <div className={cn("flex min-w-0 flex-col gap-1.5", isUser ? "max-w-[88%] items-end sm:max-w-[640px]" : "w-full max-w-full items-start sm:max-w-[760px]")}>
        <span className="font-mono text-[10px] text-muted-foreground">
          {isUser ? "vos" : "EdificIA"} · {timestamp}
        </span>

        {segments.map((seg, i) => {
          if (seg.kind === "text") {
            return (
              <ErrorBoundary key={i}>
                <TextPart part={seg.part} isUser={isUser} />
              </ErrorBoundary>
            );
          }
          if (seg.kind === "tool-timeline") {
            return (
              <ErrorBoundary key={i}>
                <ToolTimeline parts={seg.parts} />
              </ErrorBoundary>
            );
          }
          if (seg.kind === "block-result") {
            const toolName = getToolInvocation(seg.part)?.toolName ?? "";
            return (
              <ErrorBoundary key={i} label={TOOL_LABELS[toolName] ?? toolName}>
                <BlockResultPart part={seg.part} onAdjustDocument={onAdjustDocument} />
              </ErrorBoundary>
            );
          }
          return null;
        })}

        {/* Feedback button — only on assistant messages */}
        {!isUser && onFeedback && (hovered || feedbackSent) && (
          <button
            onClick={handleFeedback}
            disabled={feedbackSent}
            title="Respuesta incorrecta — pedir corrección"
            className={cn(
              "mt-0.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
              feedbackSent
                ? "cursor-default text-amber-600 dark:text-amber-400"
                : "text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive",
            )}
          >
            <ThumbsDown className="h-3 w-3" />
            {feedbackSent ? "Corrección solicitada" : "Respuesta incorrecta"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Text bubble ── */

function TextPart({
  part,
  isUser,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
  isUser: boolean;
}) {
  if (!isTextUIPart(part)) return null;

  if (isUser) {
    const fileMeta = parseFileMeta(part.text);

    // Extract action text: everything before the \n\n---\n separator
    let actionText = "";
    const sepIdx = part.text.indexOf("\n\n---\n");
    if (sepIdx > 0) {
      actionText = part.text.slice(0, sepIdx).trim();
    } else if (!fileMeta) {
      // Plain user message with no file — apply original length-based cut
      let displayText = part.text;
      if (part.text.length > 400) {
        const cutMarkers = ["```json", "```", "---\n", "\nDatos"];
        let cutIdx = -1;
        for (const marker of cutMarkers) {
          const idx = part.text.indexOf(marker);
          if (idx !== -1 && (cutIdx === -1 || idx < cutIdx)) cutIdx = idx;
        }
        if (cutIdx > 0) displayText = part.text.slice(0, cutIdx).trimEnd();
      }
      return (
        <div className="rounded-[10px_10px_2px_10px] bg-[var(--user-bg)] px-4 py-2.5 text-sm leading-relaxed text-[var(--user-fg)] whitespace-pre-wrap">
          {displayText}
        </div>
      );
    }

    // Message with file attachment
    return (
      <div className="flex flex-col gap-2 items-end">
        {fileMeta && <FileAttachmentCard meta={fileMeta} />}
        {actionText && (
          <div className="rounded-[10px_10px_2px_10px] bg-[var(--user-bg)] px-4 py-2.5 text-sm leading-relaxed text-[var(--user-fg)] whitespace-pre-wrap">
            {actionText}
          </div>
        )}
      </div>
    );
  }

  // Assistant message: extract optional <plan>{...}</plan> and
  // <hypothesis>{...}</hypothesis> blocks so they render as dedicated cards
  // instead of raw text inside the bubble.
  const { plan, cleanText: textAfterPlan, pending: planPending } = extractPlan(part.text);
  const { hypothesis, cleanText, pending: hypPending } = extractHypothesis(textAfterPlan);

  return (
    <div className="flex w-full flex-col gap-2">
      {hypothesis && <HypothesisBlock spec={hypothesis} />}
      {hypPending && <HypothesisPendingPlaceholder />}
      {plan && <PlanBlock spec={plan} />}
      {planPending && <PlanPendingPlaceholder />}
      {cleanText && (
        <div className="prose prose-sm prose-neutral max-w-none rounded-[2px_10px_10px_10px] border border-border bg-card px-4 py-2.5 text-sm leading-relaxed text-foreground shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)] dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="text-base font-semibold mt-3 mb-1 first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-semibold mt-2.5 mb-1 first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-medium mt-2 mb-0.5 first:mt-0">{children}</h3>,
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              code: ({ children, className }) => {
                const isBlock = className?.includes("language-");
                return isBlock
                  ? <code className="block bg-muted rounded-[6px] px-3 py-2 text-xs font-mono overflow-x-auto my-2">{children}</code>
                  : <code className="bg-muted rounded px-1 py-0.5 text-xs font-mono">{children}</code>;
              },
              pre: ({ children }) => <pre className="my-2">{children}</pre>,
              blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground my-2">{children}</blockquote>,
              hr: () => <hr className="my-3 border-border" />,
              table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
              th: ({ children }) => <th className="border border-border px-2 py-1 bg-muted font-medium text-left">{children}</th>,
              td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
              a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{children}</a>,
            }}
          >
            {cleanText}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

/* ── Tool result blocks (chart / findings / doc card / etc.) ── */

const BLOCK_TOOLS: Record<string, BlockKind> = {
  proyectar_metricas:       "metrics",
  proyectar_legajo_grafico: "media",
  proyectar_comparativa:    "comparison",
  proyectar_cronograma:     "timeline",
  proyectar_riesgos:        "risk_register",
  proyectar_evidencia:      "evidence_ledger",
};

/**
 * Renders the OUTPUT of a special tool as a visual block (chart, finding, doc card, etc).
 * Loading/pending state is NOT handled here — that lives in ToolTimeline above.
 * If the tool is still pending we return null so nothing duplicates.
 */
function BlockResultPart({
  part,
  onAdjustDocument,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
  onAdjustDocument?: (proposal: DocGenerationProposal, instructions: string) => void;
}) {
  if (!isToolUIPart(part)) return null;
  const ti = getToolInvocation(part);
  const toolName = ti?.toolName ?? "";
  const isPending = isToolPending(ti?.state);
  const output = getToolOutput(ti);

  if (isPending || !output) return null;

  const blockKind = BLOCK_TOOLS[toolName];
  if (blockKind) {
    const parsed = BlockSpec.safeParse(output);
    if (!parsed.success) return <FallbackErrorBlock toolName={toolName} />;
    return <ResponseBlock spec={parsed.data} />;
  }

  if (toolName === "generar_grafica") {
    const spec = output as ChartSpec;
    if (spec.data?.length > 0) return <ChartBlock {...spec} />;
  }

  if (toolName === "generar_archivo") {
    const o = output as Record<string, unknown>;
    if (o.type === "file_proposal") {
      const proposal: FileProposal = {
        fileName: o.fileName as string,
        content: o.content as string,
        contentType: (o.contentType as string) ?? "text/plain",
        description: o.description as string,
        organizationId: o.organizationId as string,
      };
      return (
        <DocumentProposalCard
          proposal={proposal}
          onDecision={(accepted, name) => { void accepted; void name; }}
        />
      );
    }
  }

  if (
    toolName === "generar_presupuesto_excel" ||
    toolName === "generar_memoria_descriptiva" ||
    toolName === "generar_informe_pdf" ||
    toolName === "generar_orden_compra" ||
    toolName === "generar_acta_obra"
  ) {
    const o = output as Record<string, unknown>;
    if (o.type === "doc_generation_proposal") {
      const proposal = o as unknown as DocGenerationProposal;
      return <GeneratedDocCard proposal={proposal} onAdjust={onAdjustDocument} />;
    }
  }

  if (toolName === "reportar_hallazgo") {
    const spec = output as FindingSpec;
    if (spec.type === "finding_callout") return <FindingCallout spec={spec} />;
  }

  if (toolName === "reportar_hallazgos_batch") {
    const batch = output as { type: string; hallazgos: FindingSpec[] };
    if (batch.type === "finding_batch" && Array.isArray(batch.hallazgos)) {
      return (
        <div className="flex flex-col gap-2 w-full">
          {batch.hallazgos.map((spec, i) => (
            <FindingCallout key={i} spec={spec} />
          ))}
        </div>
      );
    }
  }

  if (toolName === "comparar_presupuestos") {
    const spec = output as ComparisonTableSpec;
    if (spec.type === "comparison_table") return <ComparisonTable spec={spec} />;
  }

  return null;
}

/* ── Unified tool timeline (collapsible) ─────────────────────────────────── */

/**
 * Collapses ALL tool calls in a turn into a single timeline card.
 * While streaming: shows "Procesando paso N de M — <label>".
 * When done: shows "✓ N pasos completados" — click to expand the per-step list.
 */
function ToolTimeline({ parts }: { parts: UIMessagePart<UIDataTypes, UITools>[] }) {
  const relevant = parts.filter(isToolUIPart);
  if (relevant.length === 0) return null;

  const totals = relevant.reduce(
    (acc, p) => {
      const state = getToolInvocation(p)?.state;
      if (isToolDone(state)) acc.done++;
      else if (isToolPending(state)) acc.running++;
      return acc;
    },
    { done: 0, running: 0 },
  );

  const allDone = totals.running === 0;
  if (allDone) return null;

  // While streaming: show the most recent pending tool's label
  const currentPending = relevant.find((p) => isToolPending(getToolInvocation(p)?.state));
  const currentLabel = currentPending
    ? (TOOL_LABELS[getToolInvocation(currentPending)?.toolName ?? ""] ?? "Procesando")
    : null;

  return (
    <div className="w-full overflow-hidden rounded-[10px] border border-border bg-card">
      <button
        type="button"
        disabled
        className="flex w-full cursor-default items-center gap-2.5 px-3.5 py-2.5 text-left text-xs transition-colors"
      >
        <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
          <span className="eb-pulse h-2 w-2 rounded-full bg-primary" />
        </div>
        <span className="flex-1 text-[11.5px] text-muted-foreground">
          {currentLabel ?? "Procesando…"}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {totals.done}/{relevant.length}
        </span>
      </button>
    </div>
  );
}

function isToolPending(state?: string) {
  return state === "call" || state === "partial-call" || state === "input-streaming" || state === "input-available";
}

function isToolDone(state?: string) {
  return state === "result" || state === "output-available" || state === "output-error" || state === "output-denied";
}

function getToolOutput(ti: ToolInvocationData | null): unknown {
  return ti?.result ?? ti?.output;
}

function FallbackErrorBlock({ toolName }: { toolName: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 py-2.5 text-[12px] text-muted-foreground">
      <AlertTriangle className="h-3.5 w-3.5 text-[var(--warn)]" />
      No se pudo renderizar el resultado de <span className="font-mono text-foreground">{toolName}</span>.
    </div>
  );
}

function formatTime(createdAt?: Date | string | number) {
  const d = createdAt ? new Date(createdAt) : new Date();
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
