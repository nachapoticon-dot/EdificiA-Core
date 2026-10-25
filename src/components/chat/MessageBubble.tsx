"use client";

import {
  getToolName,
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
import { Wrench, CheckCircle2, ThumbsDown, FileSpreadsheet, FileText, FileCode2, FileType2 } from "lucide-react";
import { ChartBlock, type ChartSpec } from "./cards/ChartBlock";
import { FindingCallout, type FindingSpec } from "./cards/FindingCallout";
import { ComparisonTable, type ComparisonTableSpec } from "./cards/ComparisonTable";
import { GeneratedDocCard, type DocGenerationProposal } from "./cards/GeneratedDocCard";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useState } from "react";

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

const FILE_ACCENTS: Record<FileMeta["type"], { tile: string; icon: string; badge: string }> = {
  excel: { tile: "bg-[oklch(0.62_0.13_145/0.18)]", icon: "text-[oklch(0.78_0.16_145)]", badge: "XLSX" },
  pdf:   { tile: "bg-[oklch(0.62_0.18_25/0.18)]",  icon: "text-[oklch(0.78_0.16_25)]",  badge: "PDF"  },
  dxf:   { tile: "bg-[oklch(0.62_0.14_240/0.18)]", icon: "text-[oklch(0.78_0.14_240)]", badge: "DXF"  },
  docx:  { tile: "bg-[oklch(0.62_0.18_260/0.18)]", icon: "text-[oklch(0.80_0.14_260)]", badge: "DOCX" },
  image: { tile: "bg-[oklch(0.62_0.16_310/0.18)]", icon: "text-[oklch(0.80_0.14_310)]", badge: "IMG"  },
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
    <div className="group flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.06] px-3.5 py-3 backdrop-blur-sm transition-colors hover:bg-white/[0.09] max-w-[340px]">
      <div className={cn(
        "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-white/10",
        accent.tile,
      )}>
        <Icon className={cn("h-5 w-5", accent.icon)} strokeWidth={1.5} />
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-[13.5px] font-medium leading-tight text-background">
          {meta.fileName}
        </p>
        <p className="truncate font-mono text-[10.5px] text-background/55 tracking-[0.01em]">
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

const TOOL_LABELS: Record<string, string> = {
  calcular_totales: "Calculando totales",
  validar_cierre_de_total: "Validando cierre del total",
  detectar_exclusiones_logicas: "Revisando consistencia",
  calcular_incidencia_de_subgrupo: "Calculando incidencia",
  comparar_con_indices: "Comparando con índices de precio",
  analizar_geometria_plano: "Analizando geometría del plano",
  comparar_computo_con_plano: "Comparando cómputo con plano",
  comparar_presupuestos: "Armando tabla comparativa",
  generar_grafica: "Generando gráfica",
  buscar_en_base_documental: "Buscando en documentos",
  analizar_estado_obra: "Revisando documentación de la obra",
  reportar_hallazgos: "Preparando hallazgos",
  generar_presupuesto_excel: "Preparando presupuesto Excel",
  generar_memoria_descriptiva: "Preparando memoria descriptiva",
  generar_informe_pdf: "Preparando informe PDF",
  proponer_cierre_expediente: "Cerrando expediente",
};

/** Tools cuyo resultado se dibuja como un componente propio debajo del timeline. */
const RENDERED_TOOLS = new Set([
  "generar_grafica",
  "generar_presupuesto_excel",
  "generar_memoria_descriptiva",
  "generar_informe_pdf",
  "reportar_hallazgos",
  "comparar_presupuestos",
]);

type TextSegment        = { kind: "text";          part: UIMessagePart<UIDataTypes, UITools> };
type ToolTimelineSegment = { kind: "tool-timeline"; parts: UIMessagePart<UIDataTypes, UITools>[] };
type BlockResultSegment = { kind: "block-result"; part: UIMessagePart<UIDataTypes, UITools> };

type Segment = TextSegment | ToolTimelineSegment | BlockResultSegment;

type ToolPart = Extract<UIMessagePart<UIDataTypes, UITools>, { toolCallId: string }>;

function isDone(part: ToolPart): boolean {
  return part.state === "output-available" || part.state === "output-error";
}

/**
 * Agrupa las tool calls consecutivas en un único timeline y, a continuación,
 * los resultados que tienen componente propio (gráficas, hallazgos, documentos).
 */
function buildSegments(parts: UIMessagePart<UIDataTypes, UITools>[]): Segment[] {
  const segments: Segment[] = [];
  let pending: UIMessagePart<UIDataTypes, UITools>[] = [];

  function flush() {
    if (pending.length === 0) return;
    segments.push({ kind: "tool-timeline", parts: pending });
    for (const p of pending) {
      if (isToolUIPart(p) && RENDERED_TOOLS.has(getToolName(p))) {
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
          if (seg.kind === "tool-timeline") {
            return (
              <ErrorBoundary key={i}>
                <ToolTimeline parts={seg.parts} />
              </ErrorBoundary>
            );
          }
          if (seg.kind === "block-result") {
            const toolName = isToolUIPart(seg.part) ? getToolName(seg.part) : "";
            return (
              <ErrorBoundary key={i} label={TOOL_LABELS[toolName] ?? toolName}>
                <BlockResultPart part={seg.part} onAdjustDocument={onAdjustDocument} />
              </ErrorBoundary>
            );
          }
          return null;
        })}

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

    // El texto del usuario va antes del separador; después viene el contexto del archivo.
    let actionText = "";
    const sepIdx = part.text.indexOf("\n\n---\n");
    if (sepIdx > 0) {
      actionText = part.text.slice(0, sepIdx).trim();
    } else if (!fileMeta) {
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

  const cleanText = part.text.trim();
  return (
    <div className="flex w-full flex-col gap-2">
      {cleanText && (
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
            {cleanText}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function BlockResultPart({
  part,
  onAdjustDocument,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
  onAdjustDocument?: (proposal: DocGenerationProposal, instructions: string) => void;
}) {
  if (!isToolUIPart(part) || part.state !== "output-available") return null;
  const toolName = getToolName(part);
  const output = part.output as Record<string, unknown> | null;
  if (!output) return null;

  if (toolName === "generar_grafica") {
    const spec = output as unknown as ChartSpec;
    return spec.data?.length > 0 ? <ChartBlock {...spec} /> : null;
  }
  if (output.type === "doc_generation_proposal") {
    return <GeneratedDocCard proposal={output as unknown as DocGenerationProposal} onAdjust={onAdjustDocument} />;
  }
  if (output.type === "finding_batch" && Array.isArray(output.hallazgos)) {
    return (
      <div className="flex w-full flex-col gap-2">
        {(output.hallazgos as FindingSpec[]).map((spec, i) => (
          <FindingCallout key={i} spec={spec} />
        ))}
      </div>
    );
  }
  if (output.type === "comparison_table") {
    return <ComparisonTable spec={output as unknown as ComparisonTableSpec} />;
  }
  return null;
}

/** Resume las tool calls de un turno en una tarjeta plegable. */
function ToolTimeline({ parts }: { parts: UIMessagePart<UIDataTypes, UITools>[] }) {
  const [expanded, setExpanded] = useState(false);
  const relevant = parts.filter(isToolUIPart) as ToolPart[];
  if (relevant.length === 0) return null;

  const done = relevant.filter(isDone).length;
  const allDone = done === relevant.length;
  const currentPending = relevant.find((p) => !isDone(p));
  const currentLabel = currentPending ? (TOOL_LABELS[getToolName(currentPending)] ?? "Procesando") : null;

  return (
    <div className="w-full overflow-hidden rounded-[10px] border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        disabled={!allDone}
        className={cn(
          "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs transition-colors",
          allDone ? "cursor-pointer hover:bg-accent/40" : "cursor-default",
        )}
      >
        <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
          {allDone ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-[oklch(0.58_0.15_145)]" />
          ) : (
            <span className="eb-pulse h-2 w-2 rounded-full bg-primary" />
          )}
        </div>
        <span className={cn("flex-1 text-[11.5px]", allDone ? "text-foreground" : "text-muted-foreground")}>
          {allDone
            ? `${relevant.length} paso${relevant.length === 1 ? "" : "s"} completado${relevant.length === 1 ? "" : "s"}`
            : currentLabel ?? "Procesando…"}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {done}/{relevant.length}
        </span>
        {allDone && (
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {expanded ? "ocultar" : "ver pasos"}
          </span>
        )}
      </button>

      {expanded && allDone && (
        <div className="border-t border-border">
          {relevant.map((p, i) => {
            const name = getToolName(p);
            const failed = p.state === "output-error";
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2.5 px-3.5 py-2 text-[11px]",
                  i < relevant.length - 1 ? "border-b border-border" : "",
                )}
              >
                <Wrench className="h-3 w-3 shrink-0 text-[oklch(0.58_0.15_145)]" />
                <span className="flex-1 text-foreground/85">
                  {TOOL_LABELS[name] ?? name}
                </span>
                <span className={cn("font-mono text-[10px]", failed ? "text-destructive" : "text-[oklch(0.58_0.15_145)]")}>
                  {failed ? "error" : "ok"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTime(createdAt?: Date | string | number) {
  const d = createdAt ? new Date(createdAt) : new Date();
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
