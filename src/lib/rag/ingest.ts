import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { embedText } from "@/lib/embeddings";
import { toVectorLiteral } from "./vector";
import { chunkDocument } from "./chunker";
import type { ProcessedFile } from "@/lib/file-processor/types";
import { structureMetadata } from "./structure";
import { syncEnterpriseDocumentForFile } from "@/lib/enterprise-context/document-sync";

interface IngestOptions {
  organizationId: string;
  fileId: string | null;
  projectId?: string | null;
  accessToken?: string;
}

type IndexingStatus = "pending" | "indexed" | "degraded" | "failed";

/**
 * Infers a construction-specific document type from the file name and content.
 * Uses keyword matching — intentionally avoids LLM calls (fast, deterministic).
 */
function detectConstructionDocType(file: ProcessedFile): string {
  if (file.type === "dxf") return "plano";

  const name = file.fileName.toLowerCase();

  if (file.type === "excel") {
    const hasPrices = "items" in file && file.items.some((i) => i.unitPrice > 0);
    if (/computo|cubicac|medici[oó]n|metrado/i.test(name)) return "computo_metrico";
    return hasPrices ? "presupuesto" : "computo_metrico";
  }

  // PDF / DOCX — filename heuristic first, then content scan
  if (/pliego|especificac|condicion|eepp/i.test(name)) return "pliego_de_condiciones";
  if (/certific|habilitac|aprobac|inspecc/i.test(name)) return "certificado";
  if (/computo|cubicac|medici[oó]n|metrado/i.test(name)) return "computo_metrico";
  if (/memoria|descriptiva/i.test(name)) return "memoria_descriptiva";
  if (/presupuesto|cotizac|oferta|precio/i.test(name)) return "presupuesto";

  // Content scan for PDF text (skip scanned documents)
  if (file.type === "pdf" && !file.isScanned && file.text) {
    const head = file.text.slice(0, 3000).toLowerCase();
    if (/pliego.*condicion|especificacion.*tecnica/i.test(head)) return "pliego_de_condiciones";
    if (/memoria.*descriptiva|se describe.*trabajo/i.test(head))  return "memoria_descriptiva";
    if (/presupuesto.*obra|precio.*unitario|costo.*directo/i.test(head)) return "presupuesto";
  }

  if (file.type === "docx") {
    const head = file.text?.slice(0, 3000).toLowerCase() ?? "";
    if (/memoria.*descriptiva|se describe/i.test(head)) return "memoria_descriptiva";
    if (/pliego|condiciones.*generales/i.test(head))    return "pliego_de_condiciones";
  }

  return "documento";
}

async function markIndexingStatus(
  client: ReturnType<typeof getInsForgeAdminClient>,
  fileId: string | null,
  status: IndexingStatus,
  errorMessage?: string,
): Promise<void> {
  if (!fileId) return;
  try {
    const patch: Record<string, unknown> = { indexing_status: status };
    if (status === "indexed" || status === "degraded") {
      patch.indexed_at = new Date().toISOString();
    }
    if (errorMessage) {
      patch.indexing_error = errorMessage.slice(0, 500);
    } else if (status === "indexed") {
      patch.indexing_error = null;
    }
    await client.database.from("uploaded_files").update(patch).eq("id", fileId);
  } catch (err) {
    console.warn("[rag] markIndexingStatus failed", { fileId, status, err });
  }
}

async function markEnterpriseDocument(
  file: ProcessedFile,
  opts: IngestOptions,
  status: IndexingStatus,
  errorMessage?: string,
): Promise<void> {
  try {
    await syncEnterpriseDocumentForFile({
      organizationId: opts.organizationId,
      fileId: opts.fileId,
      projectId: opts.projectId,
      file,
      indexingStatus: status,
      indexingError: errorMessage ?? null,
    });
  } catch (err) {
    console.warn("[rag] syncEnterpriseDocumentForFile failed", { fileId: opts.fileId, status, err });
  }
}

/**
 * Full ingestion pipeline:
 *   1. Delete stale chunks for the same file
 *   2. Detect construction document type (keyword-based, never LLM)
 *   3. Chunk the document with type-aware strategy
 *   4. Batch-embed all chunks in parallel (NVIDIA NIM)
 *   5. Persist rows to document_chunks con embedding pgvector inline
 *   6. Stamp uploaded_files.indexing_status with the final state
 *
 * Never throws — deja rastro estructurado del resultado en la fila de
 * uploaded_files. Estados: 'indexed' | 'degraded' (sin embeddings) | 'failed'.
 */
export async function ingestDocument(
  file: ProcessedFile,
  opts: IngestOptions,
): Promise<void> {
  const client = getInsForgeAdminClient();
  let lastError: string | undefined;

  try {
    const constructionDocType = detectConstructionDocType(file);
    const chunks = chunkDocument(file);
    const documentStructure = structureMetadata(file).document_structure;
    if (chunks.length === 0) {
      await markIndexingStatus(client, opts.fileId, "failed", "no chunks produced");
      await markEnterpriseDocument(file, opts, "failed", "no chunks produced");
      return;
    }

    const documentType = file.type === "dwg_unsupported" ? "other" : file.type;

    // Purge previous version of this file (los vectores viven en la misma fila)
    await client.database
      .from("document_chunks")
      .delete()
      .eq("organization_id", opts.organizationId)
      .eq("file_name", file.fileName);

    // Parallel embedding (null si NVIDIA_API_KEY falta o la llamada falla)
    const embeddings = await Promise.all(chunks.map((c) => embedText(c.text)));

    const rows = chunks.map((chunk, i) => ({
      organization_id: opts.organizationId,
      project_id:      opts.projectId ?? null,
      file_id:         opts.fileId,
      file_name:       file.fileName,
      document_type:   documentType,
      chunk_index:     chunk.chunkIndex,
      chunk_text:      chunk.text,
      metadata:        { ...chunk.metadata, construction_doc_type: constructionDocType, document_structure: documentStructure },
      embedding:       embeddings[i] ? toVectorLiteral(embeddings[i]!) : null,
    }));

    if (rows.length === 0) {
      await markIndexingStatus(client, opts.fileId, "failed", "no rows to persist");
      await markEnterpriseDocument(file, opts, "failed", "no rows to persist");
      return;
    }

    const insertResult = await client.database.from("document_chunks").insert(rows);
    if (insertResult.error) throw new Error(insertResult.error.message);

    const degraded = embeddings.every((e) => e === null);
    const finalStatus = degraded ? "degraded" : "indexed";
    const finalError = degraded ? lastError ?? "sin embeddings (NVIDIA_API_KEY ausente o falló)" : undefined;

    await markIndexingStatus(
      client,
      opts.fileId,
      finalStatus,
      finalError,
    );
    await markEnterpriseDocument(file, opts, finalStatus, finalError);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.warn("[rag] ingestDocument fatal", { fileId: opts.fileId, err: lastError });
    await markIndexingStatus(client, opts.fileId, "failed", lastError);
    await markEnterpriseDocument(file, opts, "failed", lastError);
  }
}
