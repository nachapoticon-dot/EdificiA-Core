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
import { Wrench, CheckCircle2, Loader2 } from "lucide-react";
import { ChartBlock, type ChartSpec } from "./ChartBlock";
import { DocumentProposalCard, type FileProposal } from "./DocumentProposalCard";

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 px-6 py-3", isUser ? "justify-end" : "justify-start")}>
      {/* Agent avatar — square terracotta, Fraunces italic "E" */}
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-primary text-primary-foreground">
          <span className="font-display text-[13px] font-semibold italic leading-none select-none">E</span>
        </div>
      )}

      <div className={cn("flex max-w-[75%] flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
        {/* Timestamp */}
        <span className="font-mono text-[10px] text-muted-foreground">
          {isUser ? "vos" : "EdificIA"} · {formatTime()}
        </span>

        {message.parts.map((part, i) => (
          <MessagePart key={i} part={part} isUser={isUser} />
        ))}
      </div>
    </div>
  );
}

function MessagePart({
  part,
  isUser,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
  isUser: boolean;
}) {
  if (isTextUIPart(part)) {
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

  if (isToolUIPart(part)) {
    const toolPart = part as { toolName?: string; state?: string; output?: unknown };
    const toolName = toolPart.toolName ?? "herramienta";
    const isPending = toolPart.state === "call" || toolPart.state === "partial-call";

    // generar_grafica → full inline chart
    if (toolName === "generar_grafica" && !isPending && toolPart.output) {
      const spec = toolPart.output as ChartSpec;
      if (spec.data?.length > 0) {
        return <ChartBlock {...spec} />;
      }
    }

    // generar_archivo → approval card
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

    const labels: Record<string, string> = {
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

    /* Tool timeline row — left-border indented card */
    return (
      <div className="w-full rounded-[10px] border border-border bg-card overflow-hidden">
        <div
          className={cn(
            "flex items-center gap-3 px-3.5 py-2.5 text-xs border-l-2",
            isPending ? "border-l-primary/60" : "border-l-[var(--ok)]",
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
          <span className="font-mono text-[11px] text-foreground">{toolName}</span>
          <span className="flex-1 text-[11px] text-muted-foreground">
            · {labels[toolName] ?? toolName}
          </span>
          {isPending ? (
            <span className="font-mono text-[10px] text-primary eb-pulse">en curso…</span>
          ) : (
            <span className="font-mono text-[10px] text-muted-foreground">listo</span>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function formatTime() {
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
