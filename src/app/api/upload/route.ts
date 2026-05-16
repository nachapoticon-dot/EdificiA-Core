import { requireAuth } from "@/lib/auth/require-auth";
import { processFile } from "@/lib/file-processor";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { extractPatterns } from "@/lib/pattern-extractor";
import { ingestDocument } from "@/lib/rag/ingest";
import { cacheItems } from "@/lib/file-cache";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited, apiTooLarge, apiBadRequest, apiForbidden } from "@/lib/api/errors";
import { dbLogger, ragLogger } from "@/lib/logger";

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

  const projectId = req.headers.get("x-project-id") ?? null;

  const buffer = await file.arrayBuffer();
  const processed = await processFile(buffer, file.name, file.type || undefined);

  if (processed.type === "dwg_unsupported") {
    return Response.json({ error: processed.message, suggestion: processed.suggestion }, { status: 422 });
  }

  let fileId: string | null = null;
  try {
    const client = getInsForgeAdminClient();
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
  }

  void persistPatternsAndIngest(processed, userId, orgId, fileId, projectId);

  const cacheId = processed.type === "excel" ? cacheItems(processed.items) : null;

  return Response.json({ ...processed, fileId, cacheId });
}

async function persistPatternsAndIngest(
  processed: Awaited<ReturnType<typeof processFile>>,
  userId: string,
  orgId: string,
  fileId: string | null,
  projectId: string | null,
): Promise<void> {
  try {
    void ingestDocument(processed, { organizationId: orgId, fileId, projectId });

    if (projectId && fileId) {
      const { detectPhaseKey, detectDocType } = await import("@/lib/obra/phases");
      const contentHint = "text" in processed ? (processed.text as string).slice(0, 500) : undefined;
      const hasPrices = "items" in processed && Array.isArray(processed.items)
        ? (processed.items as { unitPrice?: number }[]).some((i) => (i.unitPrice ?? 0) > 0)
        : false;

      const phaseKey = detectPhaseKey(processed.fileName, contentHint);
      const docType  = detectDocType(processed.type, hasPrices);

      if (phaseKey) {
        const client = getInsForgeAdminClient();
        await client.database
          .from("project_phase_docs")
          .upsert({
            project_id:      projectId,
            organization_id: orgId,
            phase_key:       phaseKey,
            doc_type:        docType,
            file_id:         fileId,
            file_name:       processed.fileName,
          }, { onConflict: "project_id,phase_key,doc_type" });
      }
    }

    const extracted = extractPatterns(processed);
    if (!extracted) return;

    const client = getInsForgeAdminClient();

    const existingResult = await client.database
      .from("company_learned_patterns")
      .select("id, pattern_key, sample_count")
      .eq("organization_id", orgId)
      .eq("document_type", extracted.documentType);

    const existingMap = new Map(
      ((existingResult.data ?? []) as { id: string; pattern_key: string; sample_count: number }[])
        .map((row) => [row.pattern_key, row]),
    );

    for (const [key, value] of Object.entries(extracted.patterns)) {
      const existing = existingMap.get(key);
      if (existing) {
        await client.database
          .from("company_learned_patterns")
          .update({
            pattern_value: value,
            sample_count: existing.sample_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await client.database
          .from("company_learned_patterns")
          .insert({
            organization_id: orgId,
            document_type: extracted.documentType,
            pattern_key: key,
            pattern_value: value,
          });
      }
    }
  } catch (err) {
    ragLogger.warn({ err }, "upload: pattern/ingest background task failed (non-fatal)");
  }
}
