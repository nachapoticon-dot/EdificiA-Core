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
import type { ProcessedFile } from "@/lib/file-processor/types";
import { IMAGE_EXTENSIONS } from "@/lib/file-processor/types";

type AttachedFile = ProcessedFile & { fileId: string | null };

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

  const handleFileSelect = useCallback(
    async (file: File) => {
      setUploadError(null);

      // Images → handled via Claude multimodal, no upload needed
      const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
      if (IMAGE_EXTENSIONS.includes(ext)) {
        const dataUrl = await fileToDataUrl(file);
        const imagePrompt = buildImagePrompt(file.name);
        // Send directly as multimodal message
        const fileUiPart = { type: "file" as const, data: dataUrl, mimeType: file.type || "image/jpeg", filename: file.name };
        sendMessage({ text: imagePrompt, files: [fileUiPart] as unknown as FileList });
        return;
      }

      // Structured files (Excel, PDF, DXF, DOCX) → server-side processing
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json() as Record<string, unknown>;

        if (!res.ok) {
          const msg = data.error as string ?? "Error al procesar el archivo.";
          const suggestion = data.suggestion as string | undefined;
          setUploadError(suggestion ? `${msg} ${suggestion}` : msg);
          return;
        }

        const processed = data as unknown as AttachedFile;
        setAttachedFile(processed);
        sendMessage({ text: buildFilePrompt(processed) });
      } catch {
        setUploadError("No se pudo conectar con el servidor.");
      } finally {
        setIsUploading(false);
      }
    },
    [sendMessage],
  );

  function handleSubmit() {
    if (!input.trim() || isStreaming) return;
    sendMessage({ text: input.trim() });
    setInput("");
  }

  const fileLabel = attachedFile?.type === "excel" ? attachedFile.fileName
    : attachedFile?.fileName ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b px-6 py-3.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold">Auditoría IA</h1>
        {fileLabel && (
          <span className="ml-2 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600">
            {fileLabel}
          </span>
        )}
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          claude-sonnet-4-6
        </span>
      </header>

      {/* Messages + Drop Zone */}
      <DropZone onFileDrop={handleFileSelect}>
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

      {/* File card (Excel / PDF / DXF / DOCX) */}
      {attachedFile && attachedFile.type !== "image" && (
        <FileCard
          file={attachedFile}
          onRemove={() => setAttachedFile(null)}
        />
      )}

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
          onFileSelect={handleFileSelect}
          isStreaming={isStreaming}
          isUploading={isUploading}
        />
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          Enter para enviar · Arrastrá Excel, PDF, DXF, DOCX o imagen
        </p>
      </div>
    </div>
  );
}

// ── Auto-prompts by file type ─────────────────────────────────────────────────

function buildFilePrompt(file: ProcessedFile): string {
  switch (file.type) {
    case "excel": {
      const totalLine = file.detectedTotal != null
        ? `\nTotal declarado en el archivo: $${file.detectedTotal.toLocaleString("es-AR")}`
        : "";
      return `Acabo de subir el archivo Excel "${file.fileName}" (hoja: "${file.sheetName}").
Extraje ${file.itemCount} ítems del presupuesto.${totalLine}

Datos estructurados:
\`\`\`json
${JSON.stringify(file.items, null, 2)}
\`\`\`

Realizá una auditoría completa:
1. Calculá el costo directo con calcular_totales.
2. Verificá el cierre con validar_cierre_de_total (si hay total declarado).
3. Detectá exclusiones lógicas con detectar_exclusiones_logicas.
4. Dame un resumen ejecutivo con los rubros más importantes y cualquier anomalía.`;
    }

    case "pdf": {
      if (file.isScanned) {
        return `Subí un PDF escaneado "${file.fileName}" (${file.pageCount} páginas). El documento no tiene texto seleccionable — es una imagen.

Por favor analizá su contenido visualmente: ¿es un presupuesto, cómputo métrico, plano, o memoria descriptiva? Extraé todo el dato numérico que puedas leer.`;
      }
      return `Subí el PDF "${file.fileName}" (${file.pageCount} páginas). Aquí está el texto extraído:

---
${file.text.slice(0, 8000)}${file.text.length > 8000 ? "\n[texto truncado...]" : ""}
---

¿Podés identificar si esto es un presupuesto, cómputo métrico, o memoria descriptiva? Si encontrás datos de costos o cantidades, extraélos y analizálos.`;
    }

    case "dxf": {
      const entitiesStr = Object.entries(file.entitySummary)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const dimsStr = file.dimensions.slice(0, 20)
        .map((d) => `  - ${d.layer}: "${d.text}" ${d.value != null ? `= ${d.value}` : ""}`)
        .join("\n");
      const textsStr = file.textAnnotations.slice(0, 30).join(", ");

      return `Subí el archivo CAD DXF "${file.fileName}".

**Capas detectadas**: ${file.layers.join(", ") || "ninguna"}
**Entidades**: ${entitiesStr || "ninguna"}
**Dimensiones anotadas** (primeras 20):
${dimsStr || "  - Ninguna detectada"}
**Textos y anotaciones**: ${textsStr || "ninguno"}
**Bloques**: ${file.blockNames.slice(0, 15).join(", ") || "ninguno"}

¿Podés interpretar qué tipo de plano es (estructura, arquitectura, instalaciones, etc.)? ¿Qué elementos constructivos identificás? Si hay dimensiones, ¿podés estimar cómputos métricos básicos?`;
    }

    case "docx": {
      return `Subí el documento Word "${file.fileName}" (${file.wordCount} palabras).

Contenido:
---
${file.text.slice(0, 8000)}${file.text.length > 8000 ? "\n[texto truncado...]" : ""}
---

¿Este documento es relevante para un presupuesto de construcción? Identificá especificaciones técnicas, listados de materiales, memorias descriptivas o cualquier dato de costos.`;
    }

    default:
      return `Subí el archivo "${file.fileName}". Por favor analizá su contenido.`;
  }
}

function buildImagePrompt(fileName: string): string {
  return `Subí la imagen "${fileName}". Por favor analizá su contenido:
- Si es una planilla o presupuesto impreso/fotografiado: extraé todos los ítems, cantidades y precios que puedas leer.
- Si es un plano de arquitectura o estructura: describí los elementos constructivos, dimensiones y anotaciones visibles.
- Si es otra cosa: describí qué ves y cómo podría ser relevante para una auditoría de construcción.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Bot className="h-7 w-7 text-primary" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold">Gemini Construcción listo</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Arrastrá cualquier documento de obra: Excel, PDF, DXF, DOCX o foto de una planilla.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <span key={s} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "Arrastrá un Excel de presupuesto",
  "Subí un PDF de pliego",
  "Adjuntá un DXF de plano",
  "Fotografiá una planilla impresa",
];
