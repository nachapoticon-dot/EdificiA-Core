import { requireAuth } from "@/lib/auth/require-auth";
import { apiBadRequest, apiForbidden, apiInternal, apiNotFound } from "@/lib/api/errors";
import { processFile } from "@/lib/file-processor";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import { captureAppError } from "@/lib/observability/error-events";
import { ingestDocument } from "@/lib/rag/ingest";
import { documentReindexResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

const STORAGE_BUCKET = "presupuestos";

type UploadedFileRow = {
  id: string;
  file_name: string;
  storage_path: string | null;
  project_id: string | null;
};

/** POST /api/documents/[id]/reindex — reprocesses a persisted upload and reruns RAG ingestion. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: fileId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role === "viewer") return apiForbidden("Los visualizadores no pueden reindexar documentos.");

  const client = getInsForgeAdminClient();
  let fileRow: UploadedFileRow | null = null;

  try {
    const fileResult = await client.database
      .from("uploaded_files")
      .select("id, file_name, storage_path, project_id")
      .eq("id", fileId)
      .eq("organization_id", auth.orgId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (fileResult.error) throw fileResult.error;
    fileRow = fileResult.data as UploadedFileRow | null;
    if (!fileRow) return apiNotFound("Documento");
    if (!fileRow.storage_path) return apiBadRequest("El documento no tiene archivo de Storage asociado.");

    await setIndexingStatus(client, fileId, auth.orgId, "pending", null);

    const download = await client.storage.from(STORAGE_BUCKET).download(fileRow.storage_path);
    if (download.error || !download.data) {
      const message = download.error?.message ?? "No se pudo descargar el archivo desde Storage.";
      await setIndexingStatus(client, fileId, auth.orgId, "failed", message);
      return apiInternal("documents/reindex storage download");
    }

    try {
      const processed = await processFile(
        await download.data.arrayBuffer(),
        fileRow.file_name,
        download.data.type || undefined,
      );

      if (processed.type === "dwg_unsupported") {
        await setIndexingStatus(client, fileId, auth.orgId, "failed", processed.message);
        return apiBadRequest(processed.message, processed.suggestion);
      }

      await ingestDocument(processed, {
        organizationId: auth.orgId,
        fileId,
        projectId: fileRow.project_id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await setIndexingStatus(client, fileId, auth.orgId, "failed", message);
      throw err;
    }

    const statusResult = await client.database
      .from("uploaded_files")
      .select("indexing_status, indexing_error, indexed_at")
      .eq("id", fileId)
      .eq("organization_id", auth.orgId)
      .limit(1)
      .single();

    if (statusResult.error) throw statusResult.error;
    const status = statusResult.data as {
      indexing_status: "pending" | "indexed" | "degraded" | "failed";
      indexing_error: string | null;
      indexed_at: string | null;
    } | null;

    return Response.json(documentReindexResponseSchema.parse({
      ok: true,
      indexing_status: status?.indexing_status ?? "pending",
      indexing_error: status?.indexing_error ?? null,
      indexed_at: status?.indexed_at ?? null,
    }));
  } catch (err) {
    dbLogger.error({ err, fileId, fileName: fileRow?.file_name }, "POST /api/documents/[id]/reindex");
    await captureAppError({
      err,
      req,
      organizationId: auth.orgId,
      projectId: fileRow?.project_id ?? null,
      actorUserId: auth.userId,
      route: "/api/documents/[id]/reindex",
      severity: "error",
      context: { fileId, fileName: fileRow?.file_name ?? null },
    });
    return apiInternal("documents/reindex");
  }
}

async function setIndexingStatus(
  client: ReturnType<typeof getInsForgeAdminClient>,
  fileId: string,
  orgId: string,
  status: "pending" | "failed",
  errorMessage: string | null,
): Promise<void> {
  const patch: Record<string, unknown> = {
    indexing_status: status,
    indexing_error: errorMessage ? errorMessage.slice(0, 500) : null,
  };
  if (status === "pending") patch.indexed_at = null;

  await client.database
    .from("uploaded_files")
    .update(patch)
    .eq("id", fileId)
    .eq("organization_id", orgId);
}
