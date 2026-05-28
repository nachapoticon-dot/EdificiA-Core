import { getInsForgeAdminClient } from "@/lib/insforge/server";
import type { ProcessedFile } from "@/lib/file-processor/types";
import { structureMetadata, type DocumentStructureSummary } from "@/lib/rag/structure";

type IndexingStatus = "pending" | "indexed" | "degraded" | "failed";

interface SyncEnterpriseDocumentInput {
  organizationId: string;
  fileId: string | null;
  projectId?: string | null;
  file: ProcessedFile;
  indexingStatus: IndexingStatus;
  indexingError?: string | null;
}

interface ManualSourceRow {
  id: string;
}

interface ExistingEnterpriseDocumentRow {
  id: string;
  metadata: Record<string, unknown> | null;
}

export function readinessFromIndexingStatus(status: IndexingStatus): "inventariada" | "indexada" | "observada" {
  if (status === "indexed") return "indexada";
  if (status === "degraded" || status === "failed") return "observada";
  return "inventariada";
}

export async function syncEnterpriseDocumentForFile(input: SyncEnterpriseDocumentInput): Promise<void> {
  if (!input.fileId) return;

  const client = getInsForgeAdminClient();
  const sourceId = await ensureManualUploadSource(input.organizationId);
  const existingResult = await client.database
    .from("enterprise_documents")
    .select("id, metadata")
    .eq("organization_id", input.organizationId)
    .eq("uploaded_file_id", input.fileId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (existingResult.error) throw existingResult.error;

  const existing = existingResult.data as ExistingEnterpriseDocumentRow | null;
  const metadata = buildEnterpriseDocumentMetadata(input, existing?.metadata ?? {});
  const patch = {
    organization_id: input.organizationId,
    source_id: sourceId,
    uploaded_file_id: input.fileId,
    project_id: input.projectId ?? null,
    readiness_status: readinessFromIndexingStatus(input.indexingStatus),
    document_type: detectEnterpriseDocumentType(input.file),
    title: input.file.fileName,
    external_id: input.fileId,
    sensitivity: "internal",
    metadata,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const updateResult = await client.database
      .from("enterprise_documents")
      .update(patch)
      .eq("id", existing.id)
      .eq("organization_id", input.organizationId);
    if (updateResult.error) throw updateResult.error;
    return;
  }

  const insertResult = await client.database
    .from("enterprise_documents")
    .insert({
      ...patch,
      created_at: new Date().toISOString(),
    });
  if (insertResult.error) throw insertResult.error;
}

async function ensureManualUploadSource(organizationId: string): Promise<string | null> {
  const client = getInsForgeAdminClient();

  const existingResult = await client.database
    .from("enterprise_sources")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source_type", "manual_upload")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (existingResult.error) throw existingResult.error;
  const existing = existingResult.data as ManualSourceRow | null;
  if (existing) return existing.id;

  const insertResult = await client.database
    .from("enterprise_sources")
    .insert({
      organization_id: organizationId,
      source_type: "manual_upload",
      name: "Archivos subidos a EdificIA",
      status: "active",
      read_only: true,
      metadata: { origin: "runtime_upload" },
    })
    .select("id")
    .single();

  if (insertResult.error) {
    const retryResult = await client.database
      .from("enterprise_sources")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("source_type", "manual_upload")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (retryResult.error) throw retryResult.error;
    const retry = retryResult.data as ManualSourceRow | null;
    if (retry) return retry.id;
    throw insertResult.error;
  }
  return ((insertResult.data as ManualSourceRow | null)?.id) ?? null;
}

function buildEnterpriseDocumentMetadata(
  input: SyncEnterpriseDocumentInput,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const documentStructure = structureMetadata(input.file).document_structure as DocumentStructureSummary;
  return {
    ...existing,
    origin: existing.origin ?? "uploaded_file",
    indexingStatus: input.indexingStatus,
    indexingError: input.indexingError ?? null,
    fileSizeBytes: input.file.fileSize,
    processedType: input.file.type,
    documentStructure,
  };
}

function detectEnterpriseDocumentType(file: ProcessedFile): string {
  if (file.type === "dxf") return "plano";
  if (file.type === "excel") {
    return file.items.some((item) => item.unitPrice > 0) ? "presupuesto" : "computo_metrico";
  }
  if (file.type === "pdf" && file.isScanned) return "pdf_escaneado";
  if (file.type === "docx") return "documento_word";
  if (file.type === "image") return "imagen";
  if (file.type === "dwg_unsupported") return "dwg_no_soportado";
  return file.type;
}
