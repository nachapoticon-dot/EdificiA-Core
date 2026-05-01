"use client";

import {
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
  type UIMessagePart,
  type UIDataTypes,
  type UITools,
} from "ai";
import { cn } from "@/lib/utils";
import { Wrench, CheckCircle2 } from "lucide-react";
import { ChartBlock, type ChartSpec } from "./ChartBlock";
import { DocumentProposalCard, type FileProposal } from "./DocumentProposalCard";

interface MessageBubbleProps {
  message: UIMessage;
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
};

const SPECIAL_TOOLS = new Set(["generar_grafica", "generar_archivo"]);

/* ── Segment types for the grouped renderer ── */
type TextSegment  = { kind: "text";  part: UIMessagePart<UIDataTypes, UITools> };
type SpecialSegment = { kind: "special"; part: UIMessagePart<UIDataTypes, UITools> };
type ToolGroupSegment = { kind: "tool-group"; parts: UIMessagePart<UIDataTypes, UITools>[] };

type Segment = TextSegment | SpecialSegment | ToolGroupSegment;

function buildSegments(parts: UIMessagePart<UIDataTypes, UITools>[]): Segment[] {
  const segments: Segment[] = [];

  for (const part of parts) {
    if (isTextUIPart(part)) {
      segments.push({ kind: "text", part });
      continue;
    }

    if (isToolUIPart(part)) {
      const toolPart = part as { toolName?: string };
      const name = toolPart.toolName ?? "";

      if (SPECIAL_TOOLS.has(name)) {
        segments.push({ kind: "special", part });
        continue;
      }

      // Regular tool → append to last tool-group or create one
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

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const segments = buildSegments(message.parts);

  return (
    <div className={cn("flex gap-3 px-6 py-3", isUser ? "justify-end" : "justify-start")}>
      {/* Agent avatar */}
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-primary text-primary-foreground">
          <span className="font-display text-[13px] font-semibold italic leading-none select-none">E</span>
        </div>
      )}

      <div className={cn("flex max-w-[75%] flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
        <span className="font-mono text-[10px] text-muted-foreground">
          {isUser ? "vos" : "EdificIA"} · {formatTime()}
        </span>

        {segments.map((seg, i) => {
          if (seg.kind === "text") {
            return <TextPart key={i} part={seg.part} isUser={isUser} />;
          }
          if (seg.kind === "special") {
            return <SpecialToolPart key={i} part={seg.part} />;
          }
          return <ToolGroupCard key={i} parts={seg.parts} />;
        })}
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
  return (
    <div
      className={cn(
        "px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
        isUser
          ? "bg-foreground text-background rounded-[12px_12px_2px_12px]"
          : "bg-card border border-border text-foreground rounded-[2px_12px_12px_12px]",
      )}
    >
      {part.text}
    </div>
  );
}

/* ── Special tool parts (chart / document proposal) ── */

function SpecialToolPart({ part }: { part: UIMessagePart<UIDataTypes, UITools> }) {
  if (!isToolUIPart(part)) return null;
  const toolPart = part as { toolName?: string; state?: string; output?: unknown };
  const toolName = toolPart.toolName ?? "";
  const isPending = toolPart.state === "call" || toolPart.state === "partial-call";

  if (toolName === "generar_grafica" && !isPending && toolPart.output) {
    const spec = toolPart.output as ChartSpec;
    if (spec.data?.length > 0) return <ChartBlock {...spec} />;
  }

  if (toolName === "generar_archivo" && !isPending && toolPart.output) {
    const output = toolPart.output as Record<string, unknown>;
    if (output.type === "file_proposal") {
      const proposal: FileProposal = {
        fileName: output.fileName as string,
        content: output.content as string,
        contentType: (output.contentType as string) ?? "text/plain",
        description: output.description as string,
        organizationId: output.organizationId as string,
      };
      return (
        <DocumentProposalCard
          proposal={proposal}
          onDecision={(accepted, name) => { void accepted; void name; }}
        />
      );
    }
  }

  // Pending special tool — show as a single-row timeline card
  return <ToolGroupCard parts={[part]} />;
}

/* ── Grouped tool timeline card ── */

function ToolGroupCard({ parts }: { parts: UIMessagePart<UIDataTypes, UITools>[] }) {
  return (
    <div className="w-full overflow-hidden rounded-[10px] border border-border bg-card">
      {parts.map((p, i) => {
        if (!isToolUIPart(p)) return null;
        const tp = p as { toolName?: string; state?: string };
        const name = tp.toolName ?? "herramienta";
        const isPending = tp.state === "call" || tp.state === "partial-call";

        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 px-3.5 py-2.5 text-xs",
              i < parts.length - 1 ? "border-b border-border" : "",
            )}
          >
            <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
              {isPending ? (
                <span className="eb-pulse h-2 w-2 rounded-full bg-primary" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-[oklch(0.62_0.13_145)]" />
              )}
            </div>
            <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="font-mono text-[11px] text-foreground">{name}</span>
            <span className="flex-1 text-[11px] text-muted-foreground">
              · {TOOL_LABELS[name] ?? name}
            </span>
            {isPending ? (
              <span className="eb-pulse font-mono text-[10px] text-primary">en curso…</span>
            ) : (
              <span className="font-mono text-[10px] text-muted-foreground">listo</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatTime() {
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
