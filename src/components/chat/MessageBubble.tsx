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
import { Wrench, CheckCircle2, ThumbsDown, FileSpreadsheet, FileText, FileCode2, FileType2, Circle } from "lucide-react";
import { ChartBlock, type ChartSpec } from "./ChartBlock";
import { DocumentProposalCard, type FileProposal } from "./DocumentProposalCard";
import { FindingCallout, type FindingSpec } from "./FindingCallout";
import { ComparisonTable, type ComparisonTableSpec } from "./ComparisonTable";
import { GeneratedDocCard, type DocGenerationProposal } from "./GeneratedDocCard";
import { ResponseBlock } from "./blocks";
import { BlockSpec, type BlockKind } from "@/lib/validators/blocks";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useState } from "react";

// ── File attachment card (shown in user messages) ────────────────────────────

interface FileMeta {
  fileName: string;
  type: "excel" | "pdf" | "dxf" | "docx" | "image";
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

const FILE_COLORS: Record<FileMeta["type"], string> = {
  excel: "text-[oklch(0.62_0.13_145)]",
  pdf:   "text-destructive",
  dxf:   "text-blue-400",
  docx:  "text-indigo-400",
  image: "text-orange-400",
};

function parseFileMeta(text: string): FileMeta | null {
  const MARKER = "__file_meta__:";
  // Search the entire text — marker may appear after the "---\n" separator
  const markerIdx = text.indexOf(MARKER);
  if (markerIdx === -1) return null;
  // Extract the JSON from the marker to the end of that line
  const lineEnd = text.indexOf("\n", markerIdx);
  const jsonStr = text.slice(markerIdx + MARKER.length, lineEnd === -1 ? undefined : lineEnd);
  try { return JSON.parse(jsonStr) as FileMeta; } catch { return null; }
}

function FileAttachmentCard({ meta }: { meta: FileMeta }) {
  const Icon = FILE_ICONS[meta.type] ?? FileType2;
  const color = FILE_COLORS[meta.type] ?? "text-muted-foreground";

  let subtitle = "";
  if (meta.type === "excel") {
    subtitle = [
      meta.itemCount != null && `${meta.itemCount} ítems`,
      meta.sheetName && `hoja "${meta.sheetName}"`,
      meta.detectedTotal != null && `$${meta.detectedTotal.toLocaleString("es-AR")}`,
    ].filter(Boolean).join(" · ");
  } else if (meta.type === "pdf") {
    subtitle = [meta.pageCount != null && `${meta.pageCount} págs.`, meta.isScanned && "escaneado"].filter(Boolean).join(" · ");
  } else if (meta.type === "docx") {
    subtitle = meta.wordCount != null ? `${meta.wordCount.toLocaleString("es-AR")} palabras` : "";
  }

  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/5 px-3.5 py-2.5">
      <Icon className={cn("h-4 w-4 shrink-0", color)} strokeWidth={1.5} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium leading-tight text-background">{meta.fileName}</p>
        {subtitle && (
          <p className="mt-0.5 font-mono text-[10px] text-background/60">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: UIMessage;
  onFeedback?: () => void;
}

/* ── Tool label map ── */
const TOOL_LABELS: Record<string, string> = {
  calcular_totales:                "Calculando totales del presupuesto",
  validar_cierre_de_total:         "Validando cierre de totales",
  detectar_exclusiones_logicas:    "Detectando inconsistencias · 9 reglas",
  calcular_incidencia_de_subgrupo: "Calculando incidencia del subgrupo",
  analizar_geometria_plano:        "Analizando geometría del plano",
  comparar_computo_con_plano:      "Comparando presupuesto con plano",
  generar_grafica:                 "Generando gráfica",
  buscar_en_base_documental:       "Buscando en base documental",
  sugerir_formato:                 "Comparando con estándares del sector",
  generar_archivo:                 "Generando archivo",
  generar_presupuesto_excel:       "Generando presupuesto Excel",
  generar_memoria_descriptiva:     "Generando memoria descriptiva",
  generar_informe_pdf:             "Generando informe de auditoría PDF",
  reportar_hallazgo:               "Registrando hallazgo",
  reportar_hallazgos_batch:        "Registrando hallazgos de la auditoría",
  comparar_presupuestos:           "Generando tabla comparativa",
  analizar_estado_obra:            "Analizando estado documental de la obra",
  comparar_con_indices:            "Comparando precios con índices de mercado",
};

const SPECIAL_TOOLS = new Set([
  "generar_grafica",
  "generar_archivo",
  "generar_presupuesto_excel",
  "generar_memoria_descriptiva",
  "generar_informe_pdf",
  "reportar_hallazgo",
  "reportar_hallazgos_batch",
  "comparar_presupuestos",
]);

/* ── Segment types for the grouped renderer ── */
type TextSegment     = { kind: "text";       part: UIMessagePart<UIDataTypes, UITools> };
type SpecialSegment  = { kind: "special";    part: UIMessagePart<UIDataTypes, UITools> };
type ToolGroupSegment = { kind: "tool-group"; parts: UIMessagePart<UIDataTypes, UITools>[] };

type Segment = TextSegment | SpecialSegment | ToolGroupSegment;

// AI SDK v6: tool data lives inside part.toolInvocation (nested), not on part directly
type ToolInvocationData = {
  toolName?: string;
  state?: string;
  result?: unknown;
};

function getToolInvocation(part: UIMessagePart<UIDataTypes, UITools>): ToolInvocationData | null {
  const p = part as unknown as { toolInvocation?: ToolInvocationData };
  return p.toolInvocation ?? null;
}

function buildSegments(parts: UIMessagePart<UIDataTypes, UITools>[]): Segment[] {
  const segments: Segment[] = [];

  for (const part of parts) {
    if (isTextUIPart(part)) {
      segments.push({ kind: "text", part });
      continue;
    }

    if (isToolUIPart(part)) {
      const name = getToolInvocation(part)?.toolName ?? "";

      if (SPECIAL_TOOLS.has(name)) {
        segments.push({ kind: "special", part });
        continue;
      }

      const last = segments[segments.length - 1];
      if (last?.kind === "tool-group") {
        last.parts.push(part);
      } else {
        segments.push({ kind: "tool-group", parts: [part] });
      }
      continue;
    }
  }

  return segments;
}

/* ── Main component ── */

export function MessageBubble({ message, onFeedback }: MessageBubbleProps) {
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
      className={cn("flex gap-3 px-6 py-3", isUser ? "justify-end" : "justify-start")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Agent avatar */}
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-primary text-primary-foreground">
          <span className="font-display text-[13px] font-semibold italic leading-none select-none">E</span>
        </div>
      )}

      <div className={cn("flex max-w-[75%] flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
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
          if (seg.kind === "special") {
            const toolName = getToolInvocation(seg.part)?.toolName ?? "";
            return (
              <ErrorBoundary key={i} label={TOOL_LABELS[toolName] ?? toolName}>
                <SpecialToolPart part={seg.part} />
              </ErrorBoundary>
            );
          }
          return (
            <ErrorBoundary key={i} label="herramientas">
              <ToolGroupCard parts={seg.parts} />
            </ErrorBoundary>
          );
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
        <div className="px-4 py-2.5 text-sm leading-relaxed bg-foreground text-background rounded-[12px_12px_2px_12px] whitespace-pre-wrap">
          {displayText}
        </div>
      );
    }

    // Message with file attachment
    return (
      <div className="flex flex-col gap-2 items-end">
        {fileMeta && <FileAttachmentCard meta={fileMeta} />}
        {actionText && (
          <div className="px-4 py-2.5 text-sm leading-relaxed bg-foreground text-background rounded-[12px_12px_2px_12px] whitespace-pre-wrap">
            {actionText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-2.5 text-sm leading-relaxed bg-card border border-border text-foreground rounded-[2px_12px_12px_12px] prose prose-sm prose-neutral dark:prose-invert max-w-none">
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
        {part.text}
      </ReactMarkdown>
    </div>
  );
}

/* ── Special tool parts (chart / document proposal / etc.) ── */

const BLOCK_TOOLS: Record<string, BlockKind> = {
  proyectar_metricas:       "metrics",
  proyectar_legajo_grafico: "media",
  proyectar_comparativa:    "comparison",
  proyectar_cronograma:     "timeline",
};

function SpecialToolPart({ part }: { part: UIMessagePart<UIDataTypes, UITools> }) {
  if (!isToolUIPart(part)) return null;
  const ti = getToolInvocation(part);
  const toolName = ti?.toolName ?? "";
  const isPending = ti?.state === "call" || ti?.state === "partial-call";
  const output = ti?.result;

  // ── Nuevos bloques de respuesta estructurados ──
  const blockKind = BLOCK_TOOLS[toolName];
  if (blockKind) {
    if (isPending) return <ResponseBlock kind={blockKind} loading />;
    const parsed = BlockSpec.safeParse(output);
    if (!parsed.success) return <FallbackErrorBlock toolName={toolName} />;
    return <ResponseBlock spec={parsed.data} />;
  }

  if (toolName === "generar_grafica" && !isPending && output) {
    const spec = output as ChartSpec;
    if (spec.data?.length > 0) return <ChartBlock {...spec} />;
  }

  if (toolName === "generar_archivo" && !isPending && output) {
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
    (toolName === "generar_presupuesto_excel" ||
      toolName === "generar_memoria_descriptiva" ||
      toolName === "generar_informe_pdf") &&
    !isPending &&
    output
  ) {
    const o = output as Record<string, unknown>;
    if (o.type === "doc_generation_proposal") {
      return <GeneratedDocCard proposal={o as unknown as DocGenerationProposal} />;
    }
  }

  if (toolName === "reportar_hallazgo" && !isPending && output) {
    const spec = output as FindingSpec;
    if (spec.type === "finding_callout") return <FindingCallout spec={spec} />;
  }

  if (toolName === "reportar_hallazgos_batch" && !isPending && output) {
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

  if (toolName === "comparar_presupuestos" && !isPending && output) {
    const spec = output as ComparisonTableSpec;
    if (spec.type === "comparison_table") return <ComparisonTable spec={spec} />;
  }

  // Pending special tool — show as a single-row timeline card while streaming
  return <ToolGroupCard parts={[part]} />;
}

/* ── Grouped tool timeline card ── */

function ToolGroupCard({ parts }: { parts: UIMessagePart<UIDataTypes, UITools>[] }) {
  const relevant = parts.filter(p => isToolUIPart(p));
  if (relevant.length === 0) return null;

  return (
    <div className="w-full overflow-hidden rounded-[10px] border border-border bg-card">
      {relevant.map((p, i) => {
        if (!isToolUIPart(p)) return null;
        const ti = getToolInvocation(p);
        const name = ti?.toolName ?? "herramienta";
        const isPending = ti?.state === "call" || ti?.state === "partial-call";
        const isDone = ti?.state === "result";

        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 px-3.5 py-2.5 text-xs",
              i < relevant.length - 1 ? "border-b border-border" : "",
            )}
          >
            <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[oklch(0.58_0.15_145)]" />
              ) : isPending ? (
                <span className="eb-pulse h-2 w-2 rounded-full bg-primary" />
              ) : (
                <Circle className="h-2.5 w-2.5 text-muted-foreground/30" />
              )}
            </div>
            <Wrench className={cn("h-3 w-3 shrink-0", isDone ? "text-[oklch(0.58_0.15_145)]" : "text-muted-foreground")} />
            <span className={cn("flex-1 text-[11px]", isDone ? "text-foreground" : "text-muted-foreground")}>
              {TOOL_LABELS[name] ?? name}
            </span>
            {isPending && <span className="eb-pulse font-mono text-[10px] text-primary">en curso…</span>}
            {isDone    && <span className="font-mono text-[10px] text-[oklch(0.58_0.15_145)]">ok</span>}
          </div>
        );
      })}
    </div>
  );
}

function FallbackErrorBlock({ toolName }: { toolName: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 py-2.5 text-[12px] text-muted-foreground">
      <span className="font-mono text-[10px] text-[var(--warn)]">⚠</span>
      No se pudo renderizar el resultado de <span className="font-mono text-foreground">{toolName}</span>.
    </div>
  );
}

function formatTime(createdAt?: Date | string | number) {
  const d = createdAt ? new Date(createdAt) : new Date();
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
