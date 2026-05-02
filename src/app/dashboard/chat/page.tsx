"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { DropZone } from "@/components/chat/DropZone";
import { DxfViewerModal } from "@/components/chat/DxfViewerModal";
import { Compass, Download, Sheet } from "lucide-react";
import { AgentGreeting } from "@/components/chat/AgentGreeting";
import { FileReadyView } from "@/components/chat/FileReadyView";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { exportAuditPdf } from "@/lib/export/generate-pdf";
import { exportAuditXlsx } from "@/lib/export/generate-xlsx";
import type { ProcessedFile } from "@/lib/file-processor/types";
import { IMAGE_EXTENSIONS } from "@/lib/file-processor/types";
import { useSessionContext } from "@/contexts/SessionContext";
import { useProjectContext } from "@/contexts/ProjectContext";
import { saveMessages, loadMessages, fetchRemoteMessages } from "@/hooks/useMessageHistory";

type AttachedFile = ProcessedFile & { fileId: string | null };

// Pending state: the full context to send when the user submits
interface PendingFile {
  processed: AttachedFile;
  prompt: string;
  fileParts?: FileUIPart[];  // only for images / scanned PDFs
  dxfBlobUrl?: string;
}

export default function ChatPage() {
  const { activeProject } = useProjectContext();
  // Use a ref so the headers callback always reads the latest project without re-creating the transport
  const activeProjectRef = useRef(activeProject);
  // eslint-disable-next-line react-hooks/refs
  activeProjectRef.current = activeProject;

  /* eslint-disable react-hooks/refs */
  const { messages, sendMessage, setMessages, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: async (): Promise<Record<string, string>> => {
        const { getInsForgeClient } = await import("@/lib/insforge/client");
        const allHeaders = getInsForgeClient().getHttpClient().getHeaders();
        const headers: Record<string, string> = {};
        if (allHeaders.Authorization) headers.Authorization = allHeaders.Authorization;
        const project = activeProjectRef.current;
        if (project?.name) headers["x-project-name"] = project.name;
        if (project?.id)   headers["x-project-id"]   = project.id;
        const activeOrgId = localStorage.getItem("edificia:active_org_id");
        if (activeOrgId)   headers["x-org-id"]        = activeOrgId;
        return headers;
      },
    }),
  });
  /* eslint-enable react-hooks/refs */
  const { sessionId, recordSession, switchSession } = useSessionContext();
  const currentUserState = useCurrentUser();
  const currentUser = currentUserState.status === "ok" ? currentUserState.user : null;

  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [showDxfViewer, setShowDxfViewer] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";

  // Restore messages when session switches
  useEffect(() => {
    const local = loadMessages(sessionId);
    setMessages(local);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending((prev) => {
      if (prev?.dxfBlobUrl) URL.revokeObjectURL(prev.dxfBlobUrl);
      return null;
    });
    setUploadError(null);
    setShowDxfViewer(false);

    // If localStorage has nothing, try fetching from DB (cross-device access)
    if (local.length === 0) {
      void fetchRemoteMessages(sessionId).then((remote) => {
        if (remote.length > 0) {
          setMessages(remote);
          saveMessages(sessionId, remote); // populate local cache
        }
      });
    }
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save after each completed AI response
  useEffect(() => {
    if (status === "ready" && messages.length > 0) {
      saveMessages(sessionId, messages);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = useCallback(async (file: File) => {
    setUploadError(null);

    // Images → send immediately with multimodal (no text data to embed)
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (IMAGE_EXTENSIONS.includes(ext)) {
      const dataUrl = await fileToDataUrl(file);
      const imagePart: FileUIPart = { type: "file", mediaType: file.type || "image/jpeg", filename: file.name, url: dataUrl };
      sendMessage({ text: buildImagePrompt(file.name), files: [imagePart] });
      recordSession(file.name, "image", activeProjectRef.current?.id);
      return;
    }

    // Structured files → process server-side, then wait for user to send
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const { getInsForgeClient } = await import("@/lib/insforge/client");
      const allHeaders = getInsForgeClient().getHttpClient().getHeaders();
      const uploadHeaders: Record<string, string> = allHeaders.Authorization
        ? { Authorization: allHeaders.Authorization }
        : {};
      const activeProject = activeProjectRef.current;
      if (activeProject?.id) uploadHeaders["x-project-id"] = activeProject.id;
      const res = await fetch("/api/upload", { method: "POST", body: formData, headers: uploadHeaders });
      const data = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        const msg = data.error as string ?? "Error al procesar el archivo.";
        const suggestion = data.suggestion as string | undefined;
        setUploadError(suggestion ? `${msg} ${suggestion}` : msg);
        return;
      }

      const processed = data as unknown as AttachedFile;
      let fileParts: FileUIPart[] | undefined;
      let dxfBlobUrl: string | undefined;

      // Scanned PDF: prepare the PDF FileUIPart (sent alongside the text prompt)
      if (processed.type === "pdf" && processed.isScanned) {
        const dataUrl = await fileToDataUrl(file);
        fileParts = [{ type: "file", mediaType: "application/pdf", filename: file.name, url: dataUrl }];
      }

      // DXF: create blob URL for the WebGL viewer
      if (processed.type === "dxf") {
        dxfBlobUrl = URL.createObjectURL(file);
      }

      // Revoke any previous DXF blob URL
      setPending((prev) => {
        if (prev?.dxfBlobUrl) URL.revokeObjectURL(prev.dxfBlobUrl);
        return null;
      });

      setPending({ processed, prompt: buildFilePrompt(processed), fileParts, dxfBlobUrl });
    } catch {
      setUploadError("No se pudo conectar con el servidor.");
    } finally {
      setIsUploading(false);
    }
  }, [sendMessage, recordSession]);

  function handleSubmit() {
    if (isStreaming) return;

    if (pending) {
      // Combine user's custom question (if any) with the full file context
      const userText = input.trim();
      const finalText = userText
        ? `${userText}\n\n---\n${pending.prompt}`
        : pending.prompt;

      sendMessage({ text: finalText, files: pending.fileParts });

      const fileType = pending.processed.type === "dwg_unsupported"
        ? undefined
        : pending.processed.type as Parameters<typeof recordSession>[1];
      recordSession(pending.processed.fileName, fileType, activeProjectRef.current?.id);

      // Clean up DXF blob URL when the file leaves the input
      if (pending.dxfBlobUrl) URL.revokeObjectURL(pending.dxfBlobUrl);
      setPending(null);
      setInput("");
      return;
    }

    if (!input.trim()) return;
    recordSession(input.trim().slice(0, 50), undefined, activeProjectRef.current?.id);
    sendMessage({ text: input.trim() });
    setInput("");
  }

  function handleActionSubmit(actionText: string) {
    if (!pending) return;
    const finalText = actionText.trim()
      ? `${actionText}\n\n---\n${pending.prompt}`
      : pending.prompt;
    sendMessage({ text: finalText, files: pending.fileParts });
    const fileType = pending.processed.type === "dwg_unsupported"
      ? undefined
      : pending.processed.type as Parameters<typeof recordSession>[1];
    recordSession(pending.processed.fileName, fileType, activeProjectRef.current?.id);
    if (pending.dxfBlobUrl) URL.revokeObjectURL(pending.dxfBlobUrl);
    setPending(null);
    setInput("");
  }

  function handleRemoveFile() {
    setPending((prev) => {
      if (prev?.dxfBlobUrl) URL.revokeObjectURL(prev.dxfBlobUrl);
      return null;
    });
    setUploadError(null);
  }

  // Build the chip shown inside the ChatInput
  const chip = pending ? buildChip(pending.processed) : null;

  const exportTitle = pending?.processed.fileName ?? messages[0]?.id ?? "Auditoría EdificIA";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b bg-card px-6 py-3">
        <Compass className="h-3.5 w-3.5 text-primary" />
        <h1 className="font-display text-[13px] font-medium tracking-[-0.01em]">Asistente de Obra</h1>
        {isStreaming && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-primary">
            <span className="eb-pulse h-1.5 w-1.5 rounded-full bg-primary" />
            auditando…
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {messages.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
                onClick={() => exportAuditXlsx(exportTitle, messages)}
                title="Exportar auditoría a Excel"
              >
                <Sheet className="h-3 w-3" />
                XLSX
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
                onClick={() => { void exportAuditPdf(exportTitle, messages); }}
                title="Exportar auditoría a PDF"
              >
                <Download className="h-3 w-3" />
                PDF
              </Button>
              <span className="h-4 w-px bg-border" />
            </>
          )}
          <span className="rounded-[4px] border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            claude-sonnet-4-6
          </span>
        </div>
      </header>

      {/* Messages + Drop Zone */}
      <DropZone onFileDrop={handleFileSelect}>
        <ScrollArea className="flex-1">
          {messages.length === 0 && !pending ? (
            <AgentGreeting
              userName={currentUser?.profile?.name ?? currentUser?.email}
              onQuickAction={(text) => setInput(text)}
              onSessionSelect={switchSession}
              onFileSelect={handleFileSelect}
            />
          ) : messages.length === 0 && pending ? (
            <FileReadyView
              file={pending.processed}
              onActionSelect={handleActionSubmit}
              onRemove={handleRemoveFile}
            />
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

      {/* DXF viewer modal */}
      {showDxfViewer && pending?.dxfBlobUrl && (
        <DxfViewerModal
          blobUrl={pending.dxfBlobUrl}
          fileName={pending.processed.fileName}
          onClose={() => setShowDxfViewer(false)}
        />
      )}

      {/* Input area */}
      <div className="border-t bg-background px-6 py-4">
        {uploadError && (
          <p className="mb-2 max-w-[720px] mx-auto text-xs text-destructive">{uploadError}</p>
        )}
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onStop={stop}
          onFileSelect={handleFileSelect}
          isStreaming={isStreaming}
          isUploading={isUploading}
          attachedChip={chip}
          onRemoveFile={handleRemoveFile}
          onPreviewDxf={pending?.processed.type === "dxf" && pending.dxfBlobUrl
            ? () => setShowDxfViewer(true)
            : undefined}
        />
        <div className="mt-2 flex max-w-[720px] mx-auto justify-between font-mono text-[10px] text-muted-foreground">
          <span>↩ enviar &nbsp;·&nbsp; ⇧↩ nueva línea</span>
          <span>EdificIA puede equivocarse — verificá los cálculos</span>
        </div>
      </div>
    </div>
  );
}

// ── Chip builder ──────────────────────────────────────────────────────────────

function buildChip(file: ProcessedFile) {
  let subtitle = "";
  if (file.type === "excel") {
    subtitle = `${file.itemCount} ítems${file.detectedTotal != null ? ` · $${file.detectedTotal.toLocaleString("es-AR")}` : ""}`;
  } else if (file.type === "pdf") {
    subtitle = `${file.pageCount} pág${file.isScanned ? " · escaneado" : ""}`;
  } else if (file.type === "dxf") {
    subtitle = `${file.layers.length} capas`;
  } else if (file.type === "docx") {
    subtitle = `${file.wordCount.toLocaleString()} palabras`;
  }
  return { name: file.fileName, subtitle, fileType: file.type };
}

// ── Auto-prompts ──────────────────────────────────────────────────────────────

function buildFilePrompt(file: ProcessedFile): string {
  switch (file.type) {
    case "excel": {
      const totalLine = file.detectedTotal != null
        ? `\nTotal declarado en el archivo: $${file.detectedTotal.toLocaleString("es-AR")}`
        : "";
      return `Archivo Excel "${file.fileName}" (hoja: "${file.sheetName}") — ${file.itemCount} ítems.${totalLine}

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
        return `PDF escaneado "${file.fileName}" (${file.pageCount} páginas) — adjunto el archivo para lectura visual.\n\nIdentificá el tipo de documento, extraé todos los datos numéricos (ítems, cantidades, precios, totales) y si hay costos hacé un análisis de auditoría.`;
      }
      return `PDF "${file.fileName}" (${file.pageCount} páginas). Texto extraído:\n\n---\n${file.text.slice(0, 8000)}${file.text.length > 8000 ? "\n[texto truncado...]" : ""}\n---\n\n¿Es un presupuesto, cómputo métrico o memoria descriptiva? Si hay datos de costos o cantidades, extraélos y analizálos.`;
    }

    case "dxf": {
      const entitiesStr = Object.entries(file.entitySummary).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(", ");
      const dimsStr = file.dimensions.slice(0, 20).map((d) => `  - ${d.layer}: "${d.text}"${d.value != null ? ` = ${d.value}` : ""}`).join("\n");
      return `Archivo CAD DXF "${file.fileName}".\n\nCapas: ${file.layers.join(", ") || "ninguna"}\nEntidades: ${entitiesStr || "ninguna"}\nDimensiones (primeras 20):\n${dimsStr || "  - Ninguna"}\nTextos: ${file.textAnnotations.slice(0, 30).join(", ") || "ninguno"}\nBloques: ${file.blockNames.slice(0, 15).join(", ") || "ninguno"}\n\n¿Qué tipo de plano es? ¿Qué elementos constructivos identificás? Si hay dimensiones, estimá cómputos métricos básicos.`;
    }

    case "docx": {
      return `Documento Word "${file.fileName}" (${file.wordCount} palabras).\n\nContenido:\n---\n${file.text.slice(0, 8000)}${file.text.length > 8000 ? "\n[texto truncado...]" : ""}\n---\n\n¿Es relevante para un presupuesto de construcción? Identificá especificaciones técnicas, listados de materiales, memorias descriptivas o datos de costos.`;
    }

    default:
      return `Archivo "${file.fileName}" adjunto. Por favor analizá su contenido.`;
  }
}

function buildImagePrompt(fileName: string): string {
  return `Imagen "${fileName}" adjunta. Si es una planilla o presupuesto: extraé ítems, cantidades y precios. Si es un plano: describí elementos constructivos y dimensiones visibles. Si es otra cosa: describí qué ves y su relevancia para auditoría de construcción.`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

