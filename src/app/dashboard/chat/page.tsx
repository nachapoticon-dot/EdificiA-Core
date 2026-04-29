"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { FileCard } from "@/components/chat/FileCard";
import { DropZone } from "@/components/chat/DropZone";
import { Bot, Sparkles } from "lucide-react";
import type { BudgetItem } from "@/lib/math-engine/validators";

interface AttachedFile {
  fileName: string;
  sheetName: string;
  itemCount: number;
  detectedTotal: number | null;
  items: BudgetItem[];
  fileId: string | null;
}

export default function ChatPage() {
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        setUploadError(data.error as string ?? "Error al procesar el archivo.");
        return;
      }

      const parsed: AttachedFile = {
        fileName: data.fileName as string,
        sheetName: data.sheetName as string,
        itemCount: data.itemCount as number,
        detectedTotal: data.detectedTotal as number | null,
        items: data.items as BudgetItem[],
        fileId: data.fileId as string | null,
      };

      setAttachedFile(parsed);

      // Auto-trigger immediate audit
      const auditPrompt = buildAuditPrompt(parsed);
      sendMessage({ text: auditPrompt });
    } catch {
      setUploadError("No se pudo conectar con el servidor.");
    } finally {
      setIsUploading(false);
    }
  }, [sendMessage]);

  function handleSubmit() {
    if (!input.trim() || isStreaming) return;
    sendMessage({ text: input.trim() });
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b px-6 py-3.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold">Auditoría IA</h1>
        {attachedFile && (
          <span className="ml-2 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600">
            {attachedFile.fileName}
          </span>
        )}
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          claude-sonnet-4-6
        </span>
      </header>

      {/* Messages + Drop Zone */}
      <DropZone onFileDrop={uploadFile}>
        <ScrollArea className="flex-1">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="pb-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </ScrollArea>
      </DropZone>

      {/* File card */}
      {attachedFile && (
        <FileCard
          fileName={attachedFile.fileName}
          sheetName={attachedFile.sheetName}
          itemCount={attachedFile.itemCount}
          detectedTotal={attachedFile.detectedTotal}
          onRemove={() => setAttachedFile(null)}
        />
      )}

      {/* Upload error */}
      {uploadError && (
        <p className="px-4 pb-1 text-xs text-destructive">{uploadError}</p>
      )}

      {/* Input */}
      <div className="border-t bg-background px-4 py-3">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onStop={stop}
          onFileSelect={uploadFile}
          isStreaming={isStreaming}
          isUploading={isUploading}
        />
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          Enter para enviar · Shift+Enter para nueva línea · Arrastrá un Excel para auditar
        </p>
      </div>
    </div>
  );
}

function buildAuditPrompt(file: AttachedFile): string {
  const itemsJson = JSON.stringify(file.items, null, 2);
  const totalLine = file.detectedTotal != null
    ? `\nTotal declarado en el archivo: $${file.detectedTotal.toLocaleString("es-AR")}`
    : "";

  return `Acabo de subir el archivo "${file.fileName}" (hoja: "${file.sheetName}").
Extraje ${file.itemCount} ítems del presupuesto.${totalLine}

Aquí están los datos estructurados:
\`\`\`json
${itemsJson}
\`\`\`

Por favor realizá una auditoría completa:
1. Calculá el costo directo real usando la herramienta calcular_totales.
2. Si hay un total declarado, verificá que cierre con validar_cierre_de_total.
3. Detectá exclusiones lógicas con detectar_exclusiones_logicas.
4. Dame un resumen ejecutivo: rubros más importantes, incidencias relevantes, y cualquier anomalía que encuentres.`;
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Bot className="h-7 w-7 text-primary" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold">Gemini Construcción listo</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Arrastrá un Excel de presupuesto o usá el clip para adjuntarlo. También podés hacer preguntas directas sobre costos e incidencias.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <span
            key={s}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "Arrastrá un Excel de presupuesto",
  "¿Cierra el total?",
  "Calculá la incidencia de subcontratos",
  "Detectá errores lógicos",
];
