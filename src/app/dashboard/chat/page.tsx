"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";

import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/input/ChatInput";
import { DropZone } from "@/components/chat/input/DropZone";
import { UploadProgressCard } from "@/components/chat/cards/UploadProgressCard";
import { DxfViewerModal } from "@/components/chat/DxfViewerModal";
import { AlertTriangle, Compass, TrendingUp } from "lucide-react";
import { AgentGreeting } from "@/components/chat/AgentGreeting";
import { FileReadyView } from "@/components/chat/cards/FileReadyView";
import { ComparisonReadyView } from "@/components/chat/cards/ComparisonReadyView";
import { TopBarActions } from "@/components/chat/sidebar/TopBarActions";
import { useOrgMember } from "@/hooks/useOrgMember";
import { usePriceIndices } from "@/hooks/usePriceIndices";
import type { ProcessedFile } from "@/lib/file-processor/types";
import { useSessionContext } from "@/contexts/SessionContext";
import { useProjectContext } from "@/contexts/ProjectContext";
import { saveMessages, loadMessages, fetchRemoteMessages } from "@/hooks/useMessageHistory";
import { apiErrorResponseSchema, uploadResponseSchema, type UploadResponse } from "@/lib/validators/api-responses";
import { buildComparisonPrompt, buildFilePrompt, buildImagePrompt } from "@/lib/chat/file-prompts";

type AttachedFile = UploadResponse;


// Archivo procesado que espera a que el usuario envíe el mensaje.
interface PendingFile {
  processed: AttachedFile;
  prompt: string;
  dxfBlobUrl?: string;
}

export default function ChatPage() {
  const { activeProject } = useProjectContext();
  // Ref para que el callback de headers lea la obra activa sin recrear el transport.
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const comparisonFileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileSelect = useCallback(async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    const result = await uploadFile(file, activeProjectRef.current?.id, chatSessionIdRef.current);
    setIsUploading(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    const processed = result.file;

    // Las imágenes viajan como parte inline del mensaje (data URL).
    if (processed.type === "image") {
      const imagePart: FileUIPart = { type: "file", mediaType: processed.mimeType, filename: processed.fileName, url: processed.dataUrl };
      sendMessage({ text: buildImagePrompt(processed.fileName), files: [imagePart] });
      recordSession(processed.fileName, "image", activeProjectRef.current?.id);
      return;
    }

    setPending((prev) => {
      if (prev?.dxfBlobUrl) URL.revokeObjectURL(prev.dxfBlobUrl);
      return {
        processed,
        prompt: buildFilePrompt(processed),
        dxfBlobUrl: processed.type === "dxf" ? URL.createObjectURL(file) : undefined,
      };
    });
    setPendingB(null);
  }, [sendMessage, recordSession]);

  const handleAddComparisonFile = useCallback(async (file: File) => {
    if (!pending || pending.processed.type !== "excel") {
      setUploadError("La comparación requiere un Excel cargado como archivo A.");
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    const result = await uploadFile(file, activeProjectRef.current?.id, chatSessionIdRef.current);
    setIsUploading(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    if (result.file.type !== "excel") {
      setUploadError("La comparación solo admite archivos Excel.");
      return;
    }
    setPendingB({ processed: result.file, prompt: buildFilePrompt(result.file) });
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
      : "documento";
    const payloadJson = JSON.stringify(proposal.payload).slice(0, 12_000);
    const text = `Ajustá el ${docLabel} "${proposal.fileName}" que generaste recién según estas indicaciones:

${instructions}

Volvé a llamar la herramienta de generación correspondiente con el payload modificado. Payload actual (referencia):
\`\`\`json
${payloadJson}
\`\`\`

No vuelvas a auditar: aplicá los cambios y regenerá el archivo.`;
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

  return (
    <div className="flex h-full flex-col bg-background/55">
      {/* Header */}
      <header className="relative z-40 flex shrink-0 items-center gap-2 border-b bg-card/85 px-6 py-3 backdrop-blur">
        <Compass className="h-3.5 w-3.5 text-primary" />
        <h1 className="font-display text-[13px] font-medium tracking-[-0.01em]">Chat</h1>
        {isStreaming && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-primary">
            <span className="eb-pulse h-1.5 w-1.5 rounded-full bg-primary" />
            procesando
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <TopBarActions />
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
            <span>Verificá los resultados antes de usarlos</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceIndexOnboardingBanner() {
  return (
    <div className="border-b border-[oklch(0.72_0.16_65)]/30 bg-[oklch(0.72_0.16_65)]/[0.07] px-6 py-3">
      <div className="mx-auto flex max-w-[920px] items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[oklch(0.62_0.18_60)]" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-foreground">
            No hay índices de precio cargados
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            Sin índices de referencia, la comparación de precios unitarios no está disponible.
          </p>
        </div>
        <Link
          href="/dashboard/admin/indices"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Cargar índices
        </Link>
      </div>
    </div>
  );
}

function buildChip(file: ProcessedFile) {
  let subtitle = "";
  if (file.type === "excel") {
    subtitle = `${file.itemCount} ítems${file.detectedTotal != null ? ` · $${file.detectedTotal.toLocaleString("es-AR")}` : ""}`;
  } else if (file.type === "pdf") {
    subtitle = `${file.pageCount} pág${file.isScanned ? " · escaneado" : ""}`;
  } else if (file.type === "dxf") {
    subtitle = `${file.layers.length} capas`;
  } else if (file.type === "docx") {
    subtitle = `${file.wordCount.toLocaleString("es-AR")} palabras`;
  }
  return { name: file.fileName, subtitle, fileType: file.type };
}

type UploadResult = { ok: true; file: UploadResponse } | { ok: false; error: string };

async function uploadFile(file: File, projectId: string | undefined, chatSessionId: string | null): Promise<UploadResult> {
  const { getAuthHeaders } = await import("@/lib/insforge/client");
  const headers = { ...(await getAuthHeaders()) };
  if (projectId) headers["x-project-id"] = projectId;
  if (chatSessionId) headers["x-chat-session-id"] = chatSessionId;

  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/upload", { method: "POST", body, headers });
    const data: unknown = await res.json();
    if (!res.ok) {
      const error = apiErrorResponseSchema.safeParse(data);
      if (!error.success) return { ok: false, error: "Error al procesar el archivo." };
      return { ok: false, error: [error.data.error, error.data.suggestion].filter(Boolean).join(" ") };
    }
    const parsed = uploadResponseSchema.safeParse(data);
    return parsed.success
      ? { ok: true, file: parsed.data }
      : { ok: false, error: "El servidor devolvió una respuesta inválida para el archivo." };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor." };
  }
}
