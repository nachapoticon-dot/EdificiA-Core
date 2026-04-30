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
import { Bot, User, Wrench, CheckCircle2, Loader2 } from "lucide-react";
import { ChartBlock, type ChartSpec } from "./ChartBlock";

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        {message.parts.map((part, i) => (
          <MessagePart key={i} part={part} isUser={isUser} />
        ))}
      </div>

      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
          <User className="h-4 w-4" />
        </div>
      )}
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
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
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

    // generar_grafica: render a full chart instead of a pill
    if (toolName === "generar_grafica" && !isPending && toolPart.output) {
      const spec = toolPart.output as ChartSpec;
      if (spec.data?.length > 0) {
        return <ChartBlock {...spec} />;
      }
    }

    const labels: Record<string, string> = {
      calcular_totales:                "Calculando totales del presupuesto",
      validar_cierre_de_total:         "Validando cierre de totales",
      detectar_exclusiones_logicas:    "Detectando inconsistencias (9 reglas)",
      calcular_incidencia_de_subgrupo: "Calculando incidencia del subgrupo",
      analizar_geometria_plano:        "Analizando geometría del plano",
      comparar_computo_con_plano:      "Comparando presupuesto con plano",
      generar_grafica:                 "Generando gráfica",
    };

    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        )}
        <Wrench className="h-3.5 w-3.5" />
        <span>{labels[toolName] ?? toolName}</span>
        {!isPending && (
          <span className="text-green-600 font-medium">listo</span>
        )}
      </div>
    );
  }

  return null;
}
