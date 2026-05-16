"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";

import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { DropZone } from "@/components/chat/DropZone";
import { UploadProgressCard } from "@/components/chat/FileCard";
import { DxfViewerModal } from "@/components/chat/DxfViewerModal";
import { Compass, Download, Sheet } from "lucide-react";
import { AgentGreeting } from "@/components/chat/AgentGreeting";
import { FileReadyView } from "@/components/chat/FileReadyView";
import { TopBarActions } from "@/components/chat/TopBarActions";
import { useOrgMember } from "@/hooks/useOrgMember";
import { Button } from "@/components/ui/button";
import { exportAuditPdf } from "@/lib/export/generate-pdf";
import { exportAuditXlsx } from "@/lib/export/generate-xlsx";
import type { ProcessedFile } from "@/lib/file-processor/types";
import { useSessionContext } from "@/contexts/SessionContext";
import { useProjectContext } from "@/contexts/ProjectContext";
import { saveMessages, loadMessages, fetchRemoteMessages } from "@/hooks/useMessageHistory";

type AttachedFile = ProcessedFile & { fileId: string | null; cacheId: string | null };

// Pending state: the full context to send when the user submits
interface PendingFile {
  processed: AttachedFile;
  prompt: string;
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
    onError: (error) => setStreamError(error.message ?? "Error de conexión con el agente."),
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: async (): Promise<Record<string, string>> => {
        const { getAuthToken } = await import("@/lib/insforge/client");
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
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
  const orgMemberState = useOrgMember();
  const currentUser = orgMemberState.status === "ok" ? orgMemberState.member : null;
  const canUpload = orgMemberState.status !== "ok" || orgMemberState.member.role !== "viewer";

  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [showDxfViewer, setShowDxfViewer] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
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
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { getAuthHeaders } = await import("@/lib/insforge/client");
      const uploadHeaders = { ...(await getAuthHeaders()) };
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
      let dxfBlobUrl: string | undefined;

      // Images: the server parser returns a dataUrl — send it as an inline image part
      if (processed.type === "image") {
        const imagePart: FileUIPart = {
          type: "file",
          mediaType: processed.mimeType,
          filename: processed.fileName,
          url: processed.dataUrl,
        };
        sendMessage({ text: buildImagePrompt(processed.fileName), files: [imagePart] });
        recordSession(processed.fileName, "image", activeProjectRef.current?.id);
        return;
      }

      // DXF: create blob URL for the WebGL viewer
      if (processed.type === "dxf") {
        dxfBlobUrl = URL.createObjectURL(file);
      }

      setPending((prev) => {
        if (prev?.dxfBlobUrl) URL.revokeObjectURL(prev.dxfBlobUrl);
        return null;
      });

      setPending({ processed, prompt: buildFilePrompt(processed), dxfBlobUrl });
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

      sendMessage({ text: finalText });

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
    sendMessage({ text: finalText });
    const fileType = pending.processed.type === "dwg_unsupported"
      ? undefined
      : pending.processed.type as Parameters<typeof recordSession>[1];
    recordSession(pending.processed.fileName, fileType, activeProjectRef.current?.id);
    if (pending.dxfBlobUrl) URL.revokeObjectURL(pending.dxfBlobUrl);
    setPending(null);
    setInput("");
  }

  function handleAdjustDocument(
    proposal: { docType: string; fileName: string; payload: Record<string, unknown> },
    instructions: string,
  ) {
    if (isStreaming) return;
    const docLabel =
      proposal.docType === "presupuesto_excel" ? "presupuesto Excel"
      : proposal.docType === "memoria_descriptiva" ? "memoria descriptiva"
      : proposal.docType === "informe_pdf" ? "informe PDF"
      : "documento";
    const payloadJson = JSON.stringify(proposal.payload).slice(0, 12_000);
    const text = `Ajustá el ${docLabel} "${proposal.fileName}" que generaste recién según estas indicaciones:

${instructions}

Volvé a llamar la herramienta de generación correspondiente con el payload modificado. Payload actual (referencia):
\`\`\`json
${payloadJson}
\`\`\`

No vuelvas a auditar ni a buscar en la base documental: aplicá los cambios solicitados y regenerá el archivo.`;
    sendMessage({ text });
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
    <div className="flex h-full flex-col bg-background/55">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-2 border-b bg-card/85 px-6 py-3 backdrop-blur">
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
          <TopBarActions />
          <span className="rounded-[4px] border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            DeepSeek V4 Flash
          </span>
        </div>
      </header>

      {/* Messages + Drop Zone */}
      <DropZone onFileDrop={handleFileSelect} canUpload={canUpload}>
        <div className="flex-1 overflow-y-auto ed-blueprint-bg">
          {messages.length === 0 && !pending ? (
            <div className="min-h-full flex flex-col justify-center">
              <AgentGreeting
                userName={currentUser?.displayName ?? currentUser?.email ?? undefined}
                companyName={currentUser?.orgName ?? undefined}
                agentName={currentUser?.branding.agentName ?? undefined}
                onQuickAction={(text) => setInput(text)}
                onSessionSelect={switchSession}
                onFileSelect={handleFileSelect}
              />
            </div>
          ) : messages.length === 0 && pending ? (
            <FileReadyView
              file={pending.processed}
              onActionSelect={handleActionSubmit}
              onRemove={handleRemoveFile}
            />
          ) : (
            <div className="pb-4">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onFeedback={m.role === "assistant" ? () => {
                    void sendMessage({ text: "Esa respuesta no fue correcta. Por favor corrígela y explicá qué estuvo mal." });
                  } : undefined}
                  onAdjustDocument={handleAdjustDocument}
                />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
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
      <div className="shrink-0 border-t bg-background/85 py-4 backdrop-blur">
        <div className="mx-auto max-w-[720px] px-6">
          {isUploading && <UploadProgressCard />}

          {(uploadError ?? streamError) && (
            <div className="mb-2 flex items-center justify-between rounded-[8px] bg-destructive/10 px-3 py-2">
              <p className="text-xs text-destructive">{uploadError ?? streamError}</p>
              <button
                onClick={() => { setUploadError(null); setStreamError(null); }}
                className="ml-2 text-xs text-destructive/70 hover:text-destructive"
              >
                ✕
              </button>
            </div>
          )}
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            onStop={stop}
            onFileSelect={handleFileSelect}
            isStreaming={isStreaming}
            isUploading={isUploading}
            canUpload={canUpload}
            attachedChip={chip}
            onRemoveFile={handleRemoveFile}
            onPreviewDxf={pending?.processed.type === "dxf" && pending.dxfBlobUrl
              ? () => setShowDxfViewer(true)
              : undefined}
          />
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>↩ enviar &nbsp;·&nbsp; ⇧↩ nueva línea</span>
            <span>EdificIA puede equivocarse — verificá los cálculos</span>
          </div>
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

// Embed a machine-readable marker as the first line so MessageBubble can render a file card
// without displaying raw JSON to the user. The AI model also sees this metadata.
function fileMeta(file: ProcessedFile & { cacheId?: string | null }): string {
  const meta: Record<string, unknown> = {
    fileName: file.fileName,
    type: file.type,
    fileSize: file.fileSize,
  };
  if (file.type === "excel") {
    meta.itemCount = file.itemCount;
    meta.sheetName = file.sheetName;
    if (file.detectedTotal != null) meta.detectedTotal = file.detectedTotal;
    if (file.cacheId) meta.cacheId = file.cacheId;
  } else if (file.type === "pdf") {
    meta.pageCount = file.pageCount;
    meta.isScanned = file.isScanned;
  } else if (file.type === "docx") {
    meta.wordCount = file.wordCount;
  }
  return `__file_meta__:${JSON.stringify(meta)}`;
}

// Strip control chars + cap length to prevent prompt injection via filenames
function safeStr(s: string, max = 120): string {
  return s.replace(/[\x00-\x1f\x7f]/g, "").slice(0, max);
}

// Strip common prompt-injection patterns from document text content
function sanitizeDocText(text: string, max = 8000): string {
  return text
    .replace(/ignore\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompt|context|directives?)/gi, "[filtrado]")
    .replace(/<\|(?:im_start|im_end|system|endoftext)\|>/gi, "")
    .replace(/\[INST\]|\[\/INST\]/gi, "")
    .replace(/^\s*#{1,3}\s*(system|assistant|user|instruction|override|reset|forget)\b.*$/gim, "")
    .slice(0, max);
}

function buildFilePrompt(file: AttachedFile): string {
  switch (file.type) {
    case "excel": {
      const totalLine = file.detectedTotal != null
        ? `\nTotal declarado: $${file.detectedTotal.toLocaleString("es-AR")}`
        : "";
      const cacheId = file.cacheId;
      const dataSection = cacheId
        ? `\ncacheId del presupuesto: "${cacheId}" — pasalo a calcular_totales, validar_cierre_de_total y detectar_exclusiones_logicas.`
        : `\n\nDatos estructurados:\n\`\`\`json\n${JSON.stringify(file.items)}\n\`\`\``;

      return `${fileMeta(file)}
Archivo Excel "${safeStr(file.fileName)}" — ${file.itemCount} ítems, hoja "${safeStr(file.sheetName ?? "")}".${totalLine}${dataSection}

Realizá una auditoría completa:
1. calcular_totales${cacheId ? ` con cacheId="${cacheId}"` : ""}.
2. validar_cierre_de_total${cacheId ? ` con cacheId="${cacheId}"` : ""}${file.detectedTotal != null ? ` y declaredTotal=${file.detectedTotal}` : " (omitir si no hay total declarado)"}.
3. detectar_exclusiones_logicas${cacheId ? ` con cacheId="${cacheId}"` : ""}.
4. generar_grafica con la distribución de rubros.
5. Resumen ejecutivo con veredicto.`;
    }

    case "pdf": {
      if (file.isScanned) {
        return `${fileMeta(file)}
PDF escaneado "${safeStr(file.fileName)}" (${file.pageCount} páginas). Procesado con OCR.

Identificá el tipo de documento, extraé todos los datos numéricos (ítems, cantidades, precios, totales) y si hay costos hacé un análisis de auditoría.`;
      }
      return `${fileMeta(file)}
PDF "${safeStr(file.fileName)}" (${file.pageCount} páginas). Texto extraído:

---
${sanitizeDocText(file.text)}${file.text.length > 8000 ? "\n[texto truncado...]" : ""}
---

¿Es un presupuesto, cómputo métrico o memoria descriptiva? Si hay datos de costos o cantidades, extraélos y analizálos.`;
    }

    case "dxf": {
      const entitiesStr = Object.entries(file.entitySummary).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(", ");
      const dimsStr = file.dimensions.slice(0, 20).map((d) => `  - ${d.layer}: "${d.text}"${d.value != null ? ` = ${d.value}` : ""}`).join("\n");
      return `${fileMeta(file)}
Archivo CAD DXF "${safeStr(file.fileName)}".

Capas: ${file.layers.join(", ") || "ninguna"}
Entidades: ${entitiesStr || "ninguna"}
Dimensiones (primeras 20):
${dimsStr || "  - Ninguna"}
Textos: ${file.textAnnotations.slice(0, 30).join(", ") || "ninguno"}
Bloques: ${file.blockNames.slice(0, 15).join(", ") || "ninguno"}

¿Qué tipo de plano es? ¿Qué elementos constructivos identificás? Si hay dimensiones, estimá cómputos métricos básicos.`;
    }

    case "docx": {
      return `${fileMeta(file)}
Documento Word "${safeStr(file.fileName)}" (${file.wordCount} palabras).

Contenido:
---
${sanitizeDocText(file.text)}${file.text.length > 8000 ? "\n[texto truncado...]" : ""}
---

¿Es relevante para un presupuesto de construcción? Identificá especificaciones técnicas, listados de materiales, memorias descriptivas o datos de costos.`;
    }

    default:
      return `${fileMeta(file)}\nArchivo "${safeStr(file.fileName)}" adjunto. Por favor analizá su contenido.`;
  }
}

function buildImagePrompt(fileName: string): string {
  const safe = safeStr(fileName);
  return `__file_meta__:${JSON.stringify({ fileName, type: "image" })}\nImagen "${safe}" adjunta. Si es una planilla o presupuesto: extraé ítems, cantidades y precios. Si es un plano: describí elementos constructivos y dimensiones visibles. Si es otra cosa: describí qué ves y su relevancia para auditoría de construcción.`;
}
