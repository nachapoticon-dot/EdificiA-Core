import { requireAuth } from "@/lib/auth/require-auth";
import { processFile } from "@/lib/file-processor";
import type { ProcessedFile } from "@/lib/file-processor/types";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { resolveOrgProjectId } from "@/lib/projects";
import { detectPhaseKey, detectDocType } from "@/lib/obra/phases";
import { ingestDocument } from "@/lib/rag/ingest";
import { cacheItems } from "@/lib/file-cache";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited, apiTooLarge, apiBadRequest, apiForbidden, apiInternal } from "@/lib/api/errors";
import { dbLogger, ragLogger, getRequestLogger, REQUEST_ID_HEADER } from "@/lib/logger";
import { scanForPii } from "@/lib/security/pii-detector";
import { uploadResponseSchema } from "@/lib/validators/api-responses";
import { writeAuditLogEvent } from "@/lib/audit/audit-log";
import { scanDocumentContext } from "@/lib/documents/context-scan";
import { captureAppError } from "@/lib/observability/error-events";

export const runtime = "nodejs";

const STORAGE_BUCKET = "presupuestos";

const ACCEPTED_EXTENSIONS = [
  ".xlsx", ".xls", ".csv",
  ".pdf",
  ".dxf",
  ".docx", ".doc",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
];

const ACCEPTED_MIME: Record<string, string[]> = {
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".xls":  ["application/vnd.ms-excel"],
  ".csv":  ["text/csv", "text/plain", "application/csv"],
  ".pdf":  ["application/pdf"],
  ".dxf":  [],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".doc":  ["application/msword"],
  ".png":  ["image/png"],
  ".jpg":  ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".gif":  ["image/gif"],
  ".webp": ["image/webp"],
};

export async function POST(req: Request) {
  if (!checkRateLimit(rateLimitKey(req, "upload"), "upload")) {
    return apiRateLimited("Límite de subidas alcanzado. Intentá en una hora.");
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { userId, orgId, role } = auth;

  if (role === "viewer") {
    return apiForbidden("Los visualizadores no pueden subir archivos. Contactá a un admin de tu empresa.");
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiBadRequest("Formato de request inválido.");
  }

  const file = formData.get("file") as File | null;
  if (!file) return apiBadRequest("No se recibió ningún archivo.");

  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
  if (file.size > MAX_BYTES) {
    return apiTooLarge("El archivo supera el límite de 50 MB.", "Dividí el archivo en partes más pequeñas.");
  }

  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return apiBadRequest(`Formato "${ext}" no soportado.`);
  }

  const allowedMimes: string[] = ACCEPTED_MIME[ext] ?? [];
  const actualMime = ((file.type || "").split(";")[0] ?? "").trim().toLowerCase();
  if (allowedMimes.length > 0 && actualMime && !allowedMimes.includes(actualMime)) {
    return apiBadRequest(`Tipo de contenido inválido para "${ext}".`);
  }

  const requestedProjectId = req.headers.get("x-project-id") ?? null;
  const chatSessionId = req.headers.get("x-chat-session-id") ?? null;
  const client = getInsForgeAdminClient();
  const headerProjectId = await resolveOrgProjectId(orgId, requestedProjectId);

  if (requestedProjectId && !headerProjectId) {
    return apiBadRequest("Obra inválida.");
  }

  const projectId = headerProjectId ?? (chatSessionId ? await sessionProjectId(client, orgId, userId, chatSessionId) : null);

  const buffer = await file.arrayBuffer();
  const processed = await processFile(buffer, file.name, file.type || undefined);

  if (processed.type === "dwg_unsupported") {
    return Response.json({ error: processed.message, suggestion: processed.suggestion }, { status: 422 });
  }

  let fileId: string | null = null;
  try {
    const blob = new Blob([buffer], { type: file.type || "application/octet-stream" });

    const storageResult = await client.storage
      .from(STORAGE_BUCKET)
      .upload(`${Date.now()}_${file.name}`, blob);

    const storagePath = storageResult.data?.key ?? `local/${file.name}`;

    const fileTypeForDb =
      processed.type === "excel" ? "excel"
      : processed.type === "pdf" ? "pdf"
      : processed.type === "image" ? "image"
      : "other";

    const dbResult = await client.database
      .from("uploaded_files")
      .insert({
        organization_id: orgId,
        project_id: projectId,
        uploaded_by: userId,
        file_name: file.name,
        file_type: fileTypeForDb,
        storage_path: storagePath,
        file_size_bytes: file.size,
        processing_status: "ready",
      })
      .select("id")
      .single();

    if (dbResult.data) {
      fileId = (dbResult.data as { id: string }).id;
    }
  } catch (err) {
    dbLogger.warn({ err }, "upload: storage/DB persist failed (non-fatal)");
    void captureAppError({
      err,
      req,
      organizationId: orgId,
      projectId,
      actorUserId: userId,
      route: "/api/upload",
      severity: "warning",
      context: { stage: "storage_or_db_persist", fileName: file.name },
    });
  }

  void ingestInBackground(processed, userId, orgId, fileId, projectId);

  const cacheId = processed.type === "excel" ? cacheItems(processed.items) : null;

  const piiScan = scanForPii(extractTextForPii(processed));
  const contextScan = await scanDocumentContext(processed, {
    organizationId: orgId,
    projectId,
    fileId,
  });

  if (piiScan.hasMatches) {
    const log = getRequestLogger(req, dbLogger);
    log.warn(
      { orgId, fileId, fileName: file.name, piiTotal: piiScan.totalCount, piiTypes: piiScan.matches.map((m) => m.type) },
      "upload: PII detected",
    );
  }

  if (contextScan.hasFindings) {
    const log = getRequestLogger(req, dbLogger);
    log.warn(
      {
        orgId,
        projectId,
        fileId,
        fileName: file.name,
        contextFindings: contextScan.findings.map((finding) => ({
          type: finding.type,
          severity: finding.severity,
          relatedFileName: finding.relatedFileName,
          deltaPct: finding.evidence.deltaPct,
        })),
      },
      "upload: contextual contradictions detected",
    );
  }

  const response = uploadResponseSchema.safeParse({ ...processed, fileId, cacheId, piiScan, contextScan });
  if (!response.success) {
    dbLogger.error(
      { err: response.error.flatten(), fileName: file.name, processedType: processed.type },
      "upload: response schema mismatch",
    );
    void captureAppError({
      err: response.error,
      req,
      organizationId: orgId,
      projectId,
      actorUserId: userId,
      route: "/api/upload",
      severity: "critical",
      context: { stage: "response_schema", fileName: file.name, processedType: processed.type },
    });
    return apiInternal("upload response schema mismatch");
  }

  void writeAuditLogEvent({
    organizationId: orgId,
    projectId,
    actorUserId: userId,
    eventType: piiScan.hasMatches ? "upload.pii_detected" : "upload.file_ready",
    entityType: "uploaded_file",
    entityId: fileId,
    severity: piiScan.hasMatches ? "warning" : "info",
    requestId: req.headers.get(REQUEST_ID_HEADER),
    payload: {
      fileName: file.name,
      fileType: processed.type,
      fileSizeBytes: file.size,
      piiTotal: piiScan.totalCount,
      piiTypes: piiScan.matches.map((m) => m.type),
      contextFindings: contextScan.totalCount,
      contextFindingTypes: contextScan.findings.map((finding) => finding.type),
      persisted: fileId !== null,
    },
    piiScan: piiScan.hasMatches ? piiScan : null,
  });

  return Response.json(response.data);
}

async function sessionProjectId(
  client: ReturnType<typeof getInsForgeAdminClient>,
  orgId: string,
  userId: string,
  chatSessionId: string,
): Promise<string | null> {
  const result = await client.database
    .from("chat_sessions")
    .select("project_id")
    .eq("id", chatSessionId)
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  return (result.data as { project_id: string | null } | null)?.project_id ?? null;
}

/** Extrae el texto auditable de un archivo procesado para escanear PII. */
function extractTextForPii(p: ProcessedFile): string {
  switch (p.type) {
    case "excel":
      return p.items
        .map((it) => [it.code, it.description, it.unit].filter(Boolean).join(" "))
        .join("\n");
    case "pdf":
    case "docx":
      return p.text;
    case "dxf":
      return p.textAnnotations.join("\n");
    case "image":
    case "dwg_unsupported":
      return "";
  }
}

/** Indexa en el RAG y, si hay obra, registra a qué fase corresponde el documento. */
async function ingestInBackground(
  processed: ProcessedFile,
  userId: string,
  orgId: string,
  fileId: string | null,
  projectId: string | null,
): Promise<void> {
  try {
    await ingestDocument(processed, { organizationId: orgId, fileId, projectId });

    if (!projectId || !fileId) return;
    const contentHint = "text" in processed ? processed.text.slice(0, 500) : undefined;
    const hasPrices = processed.type === "excel" && processed.items.some((i) => i.unitPrice > 0);
    const phaseKey = detectPhaseKey(processed.fileName, contentHint);
    if (!phaseKey) return;

    await getInsForgeAdminClient()
      .database.from("project_phase_docs")
      .upsert({
        project_id: projectId,
        organization_id: orgId,
        phase_key: phaseKey,
        doc_type: detectDocType(processed.type, hasPrices),
        file_id: fileId,
        file_name: processed.fileName,
      }, { onConflict: "project_id,phase_key,doc_type" });
  } catch (err) {
    ragLogger.warn({ err }, "upload: background ingest failed");
    void captureAppError({
      err,
      organizationId: orgId,
      projectId,
      actorUserId: userId,
      route: "/api/upload",
      severity: "warning",
      context: { stage: "background_ingest", fileId },
    });
  }
}
