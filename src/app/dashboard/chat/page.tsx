"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";

import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/input/ChatInput";
import { DropZone } from "@/components/chat/input/DropZone";
import { UploadProgressCard } from "@/components/chat/cards/FileCard";
import { DxfViewerModal } from "@/components/chat/DxfViewerModal";
import { AlertTriangle, Compass, Download, Sheet, TrendingUp } from "lucide-react";
import { AgentGreeting } from "@/components/chat/AgentGreeting";
import { FileReadyView } from "@/components/chat/cards/FileReadyView";
import { ComparisonReadyView } from "@/components/chat/cards/ComparisonReadyView";
import { TopBarActions } from "@/components/chat/sidebar/TopBarActions";
import { ProactivityAlertsBanner } from "@/components/chat/ProactivityAlertsBanner";
import { useOrgMember } from "@/hooks/useOrgMember";
import { usePriceIndices } from "@/hooks/usePriceIndices";
import { Button } from "@/components/ui/button";
import { exportAuditPdf } from "@/lib/export/generate-pdf";
import { exportAuditXlsx } from "@/lib/export/generate-xlsx";
import type { ProcessedFile } from "@/lib/file-processor/types";
import { useSessionContext } from "@/contexts/SessionContext";
import { useProjectContext } from "@/contexts/ProjectContext";
import { saveMessages, loadMessages, fetchRemoteMessages } from "@/hooks/useMessageHistory";
import { apiErrorResponseSchema, uploadResponseSchema, type UploadResponse } from "@/lib/validators/api-responses";

type AttachedFile = UploadResponse;

const STREAMING_WORDS = [
  "encofrando",
  "mezclando",
  "replanteando",
  "nivelando",
  "cubicando",
  "hormigonando",
  "apuntalando",
  "afinando",
  "levantando",
  "trazando",
];

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
  const chatSessionIdRef = useRef<string | null>(null);
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
        const sessionId = chatSessionIdRef.current;
        if (sessionId) headers["x-chat-session-id"] = sessionId;
        return headers;
      },
    }),
  });
  /* eslint-enable react-hooks/refs */
  const { sessionId, recordSession, switchSession } = useSessionContext();
  // eslint-disable-next-line react-hooks/refs
  chatSessionIdRef.current = sessionId;
  const orgMemberState = useOrgMember();
  const currentUser = orgMemberState.status === "ok" ? orgMemberState.member : null;
  const canUpload = orgMemberState.status !== "ok" || orgMemberState.member.role !== "viewer";
  const { data: priceIndices = [], isLoading: priceIndicesLoading } = usePriceIndices();
  const needsIndexOnboarding =
    currentUser?.role === "admin" &&
    !priceIndicesLoading &&
    priceIndices.length === 0;

  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [pendingB, setPendingB] = useState<PendingFile | null>(null);
  const [showDxfViewer, setShowDxfViewer] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamingWord, setStreamingWord] = useState(
    () => STREAMING_WORDS[Math.floor(Math.random() * STREAMING_WORDS.length)] ?? "trabajando",
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const comparisonFileInputRef = useRef<HTMLInputElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";
  const streamingWordPool = useMemo(() => STREAMING_WORDS, []);

  // Restore messages when session switches
  useEffect(() => {
    const local = loadMessages(sessionId);
    setMessages(local);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending((prev) => {
      if (prev?.dxfBlobUrl) URL.revokeObjectURL(prev.dxfBlobUrl);
      return null;
    });
    setPendingB(null);
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

  useEffect(() => {
    if (!isStreaming) return;
    const id = window.setInterval(() => {
      setStreamingWord((current) => {
        const nextPool = streamingWordPool.filter((word) => word !== current);
        return nextPool[Math.floor(Math.random() * nextPool.length)] ?? current;
      });
    }, 2200);
    return () => window.clearInterval(id);
  }, [isStreaming, streamingWordPool]);

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
      if (chatSessionIdRef.current) uploadHeaders["x-chat-session-id"] = chatSessionIdRef.current;

      const res = await fetch("/api/upload", { method: "POST", body: formData, headers: uploadHeaders });
      const data: unknown = await res.json();

      if (!res.ok) {
        const error = apiErrorResponseSchema.safeParse(data);
        const msg = error.success ? error.data.error : "Error al procesar el archivo.";
        const suggestion = error.success ? error.data.suggestion : undefined;
        setUploadError(suggestion ? `${msg} ${suggestion}` : msg);
        return;
      }

      const parsed = uploadResponseSchema.safeParse(data);
      if (!parsed.success) {
        console.error("Invalid /api/upload response", parsed.error.flatten());
        setUploadError("El servidor devolvió una respuesta inválida para el archivo.");
        return;
      }

      const processed = parsed.data;
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
      setPendingB(null);

      setPending({ processed, prompt: buildFilePrompt(processed), dxfBlobUrl });
    } catch {
      setUploadError("No se pudo conectar con el servidor.");
    } finally {
      setIsUploading(false);
    }
  }, [sendMessage, recordSession]);

  const handleAddComparisonFile = useCallback(async (file: File) => {
    if (!pending || pending.processed.type !== "excel") {
      setUploadError("La comparativa A vs B requiere un Excel cargado como archivo A.");
      return;
    }
    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { getAuthHeaders } = await import("@/lib/insforge/client");
      const uploadHeaders = { ...(await getAuthHeaders()) };
      const ap = activeProjectRef.current;
      if (ap?.id) uploadHeaders["x-project-id"] = ap.id;
      if (chatSessionIdRef.current) uploadHeaders["x-chat-session-id"] = chatSessionIdRef.current;

      const res = await fetch("/api/upload", { method: "POST", body: formData, headers: uploadHeaders });
      const data: unknown = await res.json();

      if (!res.ok) {
        const error = apiErrorResponseSchema.safeParse(data);
        const msg = error.success ? error.data.error : "Error al procesar el archivo.";
        setUploadError(msg);
        return;
      }

      const parsed = uploadResponseSchema.safeParse(data);
      if (!parsed.success) {
        setUploadError("El servidor devolvió una respuesta inválida para el archivo.");
        return;
      }

      const processed = parsed.data;
      if (processed.type !== "excel") {
        setUploadError("La comparativa A vs B solo admite Excel por ahora.");
        return;
      }

      setPendingB({ processed, prompt: buildFilePrompt(processed) });
    } catch {
      setUploadError("No se pudo conectar con el servidor.");
    } finally {
      setIsUploading(false);
    }
  }, [pending]);

  const handleStartComparison = useCallback(() => {
    comparisonFileInputRef.current?.click();
  }, []);

  const handleComparisonInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleAddComparisonFile(file);
  }, [handleAddComparisonFile]);

  function handleRemoveB() {
    setPendingB(null);
  }

  const handleSubmitComparison = useCallback(() => {
    if (!pending || !pendingB || pending.processed.type !== "excel" || pendingB.processed.type !== "excel") return;
    if (isStreaming) return;

    const a = pending.processed;
    const b = pendingB.processed;
    const text = buildComparisonPrompt(a, b);

    sendMessage({ text });
    recordSession(`A vs B · ${a.fileName}`, "excel", activeProjectRef.current?.id);

    if (pending.dxfBlobUrl) URL.revokeObjectURL(pending.dxfBlobUrl);
    setPending(null);
    setPendingB(null);
    setInput("");
  }, [pending, pendingB, isStreaming, sendMessage, recordSession]);

  function handleSubmit() {
    if (isStreaming) return;

    if (pending) {
      // Combine user's custom question (if any) with the full file context
      const userText = input.trim();
      const finalText = userText
        ? `${userText}\n\n---\n${pending.prompt}`
        : pending.prompt;

      sendMessage({ text: finalText });

      const fileType = pending.processed.type as Parameters<typeof recordSession>[1];
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
    const fileType = pending.processed.type as Parameters<typeof recordSession>[1];
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
      : proposal.docType === "orden_compra" ? "orden de compra"
      : proposal.docType === "acta_obra" ? "parte diario de obra"
      : "documento";
    const payloadJson = JSON.stringify(proposal.payload).slice(0, 12_000);
    const text = `Ajustá el ${docLabel} "${proposal.fileName}" que generaste recién según estas indicaciones:

${instructions}

Volvé a llamar la herramienta de generación correspondiente con el payload modificado. Payload actual (referencia):
\`\`\`json
${payloadJson}
\`\`\`

No vuelvas a auditar ni a buscar en fuentes empresariales: aplicá los cambios solicitados y regenerá el archivo.`;
    sendMessage({ text });
  }

  function handleRemoveFile() {
    setPending((prev) => {
      if (prev?.dxfBlobUrl) URL.revokeObjectURL(prev.dxfBlobUrl);
      return null;
    });
    setPendingB(null);
    setUploadError(null);
  }

  // Build the chip shown inside the ChatInput
  const chip = pending && pendingB
    ? { name: `${pending.processed.fileName}  vs  ${pendingB.processed.fileName}`, subtitle: "comparativa A vs B lista", fileType: "excel" as const }
    : pending ? buildChip(pending.processed) : null;

  const exportTitle = pending?.processed.fileName ?? messages[0]?.id ?? "Auditoría EdificIA";

  return (
    <div className="flex h-full flex-col bg-background/55">
      {/* Header */}
      <header className="relative z-40 flex shrink-0 flex-wrap items-center gap-2 border-b bg-card/88 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-border bg-background text-primary">
            <Compass className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[13px] font-medium tracking-[-0.01em]">Asistente de Obra</h1>
            <p className="hidden font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground sm:block">
              {activeProject?.name ?? "Mesa empresarial"}
            </p>
          </div>
        </div>
        {isStreaming && (
          <div className="order-3 flex w-full items-center gap-1.5 rounded-[7px] border border-primary/20 bg-primary/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-primary sm:order-none sm:w-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <span className="eb-pulse h-1.5 w-1.5 rounded-full bg-primary" />
            {streamingWord}…
          </div>
        )}
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
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
          <span className="hidden rounded-[4px] border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
            DeepSeek V4 Flash
          </span>
        </div>
      </header>

      {/* Hidden input used by FileReadyView's "Comparar con otra versión" CTA */}
      <input
        ref={comparisonFileInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleComparisonInputChange}
      />

      {/* Messages + Drop Zone */}
      <DropZone onFileDrop={handleFileSelect} canUpload={canUpload}>
        <div className="flex-1 overflow-y-auto ed-blueprint-bg">
          {needsIndexOnboarding && <PriceIndexOnboardingBanner />}
          <ProactivityAlertsBanner projectId={activeProject?.id ?? null} />
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
          ) : messages.length === 0 && pending && pendingB && pending.processed.type === "excel" && pendingB.processed.type === "excel" ? (
            <ComparisonReadyView
              fileA={pending.processed}
              fileB={pendingB.processed}
              onSubmit={handleSubmitComparison}
              onRemoveB={handleRemoveB}
            />
          ) : messages.length === 0 && pending ? (
            <FileReadyView
              file={pending.processed}
              piiScan={pending.processed.piiScan}
              contextScan={pending.processed.contextScan}
              onActionSelect={handleActionSubmit}
              onRemove={handleRemoveFile}
              onStartComparison={pending.processed.type === "excel" ? handleStartComparison : undefined}
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
          <div className="mx-auto max-w-[760px] px-4 md:px-6">
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

function PriceIndexOnboardingBanner() {
  return (
    <div className="border-b border-[var(--warn)]/30 bg-[color-mix(in_oklch,var(--warn)_8%,transparent)] px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-[920px] items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--warn)]" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-foreground">
            Todavía no cargaste la base de datos de tu empresa
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            Sin tus precios, contratos y referencias internas, EdificIA trabaja con contexto limitado y pierde precisión al comparar valores.
          </p>
        </div>
        <Link
          href="/dashboard/admin/indices"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Cargar datos
        </Link>
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
function fileMeta(file: ProcessedFile & { cacheId?: string | null; contextScan?: UploadResponse["contextScan"] }): string {
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
  if (file.contextScan?.hasFindings) {
    meta.contextFindings = file.contextScan.findings.map((finding) => ({
      type: finding.type,
      severity: finding.severity,
      message: finding.message,
      relatedFileName: finding.relatedFileName,
      deltaPct: finding.evidence.deltaPct,
    }));
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

Leé este Excel como documento operativo de construcción, no asumas que siempre es un presupuesto. Primero clasificá qué es y para qué sirve: presupuesto, cómputo, lista de precios, certificado, acopio, comparativa de proveedor u otro.

Si tiene estructura de presupuesto/cómputo con cantidades e ítems de obra:
1. calcular_totales${cacheId ? ` con cacheId="${cacheId}"` : ""}.
2. validar_cierre_de_total${cacheId ? ` con cacheId="${cacheId}"` : ""}${file.detectedTotal != null ? ` y declaredTotal=${file.detectedTotal}` : " (solo si hay total declarado)"}.
3. detectar_exclusiones_logicas${cacheId ? ` con cacheId="${cacheId}"` : ""}.
4. generar_grafica cuando la distribución de rubros ayude a decidir.

Si es lista de precios/proveedor/catálogo:
- No lo trates como "no sirve"; explicá qué decisiones habilita (comparar contra presupuesto, registrar referencia, armar compra, buscar artículos).
- Extraé proveedor, fecha, moneda, rubros, unidades y ejemplos representativos.
- Si el usuario ya dijo qué quiere hacer, avanzá con ese objetivo sin devolver una encuesta genérica.

Cierre: decí qué entendiste del archivo, qué datos confiables extrajiste, qué acción concreta recomendás y qué faltaría si el usuario quisiera convertirlo en presupuesto de obra.`;
    }

    case "pdf": {
      if (file.isScanned) {
        return `${fileMeta(file)}
PDF escaneado "${safeStr(file.fileName)}" (${file.pageCount} páginas). Procesado con OCR.

Leé este PDF como documento operativo de construcción. Clasificá qué es y para qué sirve antes de juzgarlo: lista de precios, contrato, memoria, certificado, legajo, remito, presupuesto, plano escaneado u otro. Extraé datos útiles (proveedor, fecha, moneda, rubros, precios, cantidades, vencimientos o responsables) y conectalos con una acción concreta. No lo descartes por no ser presupuesto; si es referencia de proveedor, tratala como insumo para compras/cotización.`;
      }
      return `${fileMeta(file)}
PDF "${safeStr(file.fileName)}" (${file.pageCount} páginas). Texto extraído:

---
${sanitizeDocText(file.text)}${file.text.length > 8000 ? "\n[texto truncado...]" : ""}
---

Leé este documento como Project Manager de obra. Primero clasificá qué es y qué decisión habilita; después extraé señales útiles: proveedor/obra/fecha/moneda/rubros/precios/cantidades/vencimientos/responsables según corresponda.

No respondas "no es un presupuesto" como conclusión principal. Si no es presupuesto, explicá qué sí es y cómo se puede usar en la operación: comparar precios, alimentar una compra, contrastar contra presupuesto, registrar referencia o pedir datos faltantes. Si el usuario ya indicó una intención, respondé a esa intención.`;
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

Leé este Word como documento operativo de construcción. Clasificá tipo, propósito, responsables, fechas, especificaciones, materiales, costos o restricciones si aparecen. No lo fuerces a presupuesto: explicá para qué sirve y qué acción concreta habilita.`;
    }

    default:
      return `${fileMeta(file)}\nArchivo "${safeStr(file.fileName)}" adjunto. Por favor analizá su contenido.`;
  }
}

function buildImagePrompt(fileName: string): string {
  const safe = safeStr(fileName);
  return `__file_meta__:${JSON.stringify({ fileName, type: "image" })}\nImagen "${safe}" adjunta. Leela como insumo operativo de construcción. Si es una planilla/lista de precios: extraé proveedor, artículos, unidades y valores. Si es un plano: describí elementos constructivos y dimensiones visibles. Si es foto de obra o documento visual: explicá qué muestra, qué señales útiles hay y qué acción concreta habilita.`;
}

function buildComparisonPrompt(a: AttachedFile & { type: "excel" }, b: AttachedFile & { type: "excel" }): string {
  const nameA = safeStr(a.fileName);
  const nameB = safeStr(b.fileName);
  const cacheA = a.cacheId;
  const cacheB = b.cacheId;

  const cacheRefA = cacheA ? `cacheId="${cacheA}"` : "items inline";
  const cacheRefB = cacheB ? `cacheId="${cacheB}"` : "items inline";

  const declaredLineA = a.detectedTotal != null ? ` · total declarado $${a.detectedTotal.toLocaleString("es-AR")}` : "";
  const declaredLineB = b.detectedTotal != null ? ` · total declarado $${b.detectedTotal.toLocaleString("es-AR")}` : "";

  const declaredA = a.detectedTotal != null ? ` y declaredTotal=${a.detectedTotal}` : " (omitir si no hay total declarado)";
  const declaredB = b.detectedTotal != null ? ` y declaredTotal=${b.detectedTotal}` : " (omitir si no hay total declarado)";

  return `${fileMeta(a)}
${fileMeta(b)}
Auditoría comparativa de dos versiones del mismo presupuesto.

- A: "${nameA}" — ${a.itemCount} ítems${declaredLineA} · ${cacheRefA}
- B: "${nameB}" — ${b.itemCount} ítems${declaredLineB} · ${cacheRefB}

Plan:
1. calcular_totales con ${cacheRefA}.
2. calcular_totales con ${cacheRefB}.
3. validar_cierre_de_total con ${cacheRefA}${declaredA}.
4. validar_cierre_de_total con ${cacheRefB}${declaredB}.
5. detectar_exclusiones_logicas con ${cacheRefA} y con ${cacheRefB} para listar errores/warnings de cada versión.
6. comparar_presupuestos con title="A vs B", columnA="A · ${nameA}", columnB="B · ${nameB}" y rows que incluyan: Total declarado, Costo directo calculado, Cantidad de ítems, Errores detectados, Warnings detectados, Brecha A→B.
7. Resumen ejecutivo: qué cambió entre A y B, qué rubros divergen más, cuál es más confiable y qué decisión recomendás.

Citá provenance en cada cifra crítica.`;
}
