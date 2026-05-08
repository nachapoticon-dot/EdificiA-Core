import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { embedText } from "@/lib/embeddings";
import { getQdrantClient, ensureCollection, COLLECTION_NAME, isQdrantConfigured } from "@/lib/qdrant/client";
import { chunkDocument } from "./chunker";
import type { ProcessedFile } from "@/lib/file-processor/types";

interface IngestOptions {
  organizationId: string;
  fileId: string | null;
  projectId?: string | null;
  accessToken?: string;
}

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

/**
 * Full ingestion pipeline:
 *   1. Delete stale chunks for the same file
 *   2. Detect construction document type (keyword-based, never LLM)
 *   3. Chunk the document with type-aware strategy (rubro groups, section headers)
 *   4. Batch-embed all chunks in parallel
 *   5. Upsert to Qdrant with enriched payload (construction_doc_type, rubro, section_title)
 *   6. Persist rows to document_chunks (PostgreSQL fallback)
 *
 * Always non-fatal — never throws, never blocks the upload response.
 */
export async function ingestDocument(
  file: ProcessedFile,
  opts: IngestOptions,
): Promise<void> {
  try {
    const constructionDocType = detectConstructionDocType(file);
    const chunks = chunkDocument(file);
    if (chunks.length === 0) return;

    const documentType    = file.type === "dwg_unsupported" ? "other" : file.type;
    const client          = getInsForgeAdminClient();
    const qdrantAvailable = isQdrantConfigured();

    if (qdrantAvailable) await ensureCollection().catch(() => null);

    // Purge previous version of this file
    const { data: stale } = await client.database
      .from("document_chunks")
      .select("qdrant_id")
      .eq("organization_id", opts.organizationId)
      .eq("file_name", file.fileName)
      .not("qdrant_id", "is", null);

    if (stale && stale.length > 0) {
      const ids = (stale as { qdrant_id: string | null }[])
        .map((c) => c.qdrant_id)
        .filter((id): id is string => id !== null);
      if (ids.length > 0 && qdrantAvailable) {
        await getQdrantClient().delete(COLLECTION_NAME, { points: ids }).catch(() => null);
      }
    }

    await client.database
      .from("document_chunks")
      .delete()
      .eq("organization_id", opts.organizationId)
      .eq("file_name", file.fileName);

    // Parallel embedding
    const qdrantIds  = chunks.map(() => crypto.randomUUID());
    const embeddings = await Promise.all(chunks.map((c) => embedText(c.text)));

    const qdrantSucceeded = new Array<boolean>(chunks.length).fill(false);

    if (qdrantAvailable) {
      const points = chunks
        .map((chunk, i) =>
          embeddings[i]
            ? {
                id: qdrantIds[i]!,
                vector: embeddings[i]!,
                payload: {
                  org_id:                opts.organizationId,
                  project_id:            opts.projectId ?? null,
                  file_id:               opts.fileId,
                  file_name:             file.fileName,
                  document_type:         documentType,
                  construction_doc_type: constructionDocType,
                  chunk_index:           chunk.chunkIndex,
                  chunk_text:            chunk.text,
                  // Promote key metadata fields to top-level for Qdrant filtering
                  rubro:                 (chunk.metadata.rubro as string | undefined) ?? null,
                  section_title:         (chunk.metadata.section_title as string | undefined) ?? null,
                  has_prices:            (chunk.metadata.has_prices as boolean | undefined) ?? false,
                  has_quantities:        (chunk.metadata.has_quantities as boolean | undefined) ?? false,
                  ...chunk.metadata,
                },
              }
            : null,
        )
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (points.length > 0) {
        try {
          await getQdrantClient().upsert(COLLECTION_NAME, { points });
          chunks.forEach((_, i) => { if (embeddings[i]) qdrantSucceeded[i] = true; });
        } catch { /* fallback to PostgreSQL */ }
      }
    }

    const rows = chunks.map((chunk, i) => ({
      organization_id: opts.organizationId,
      project_id:      opts.projectId ?? null,
      file_id:         opts.fileId,
      file_name:       file.fileName,
      document_type:   documentType,
      chunk_index:     chunk.chunkIndex,
      chunk_text:      chunk.text,
      metadata:        { ...chunk.metadata, construction_doc_type: constructionDocType },
      qdrant_id:       qdrantSucceeded[i] ? qdrantIds[i] : null,
    }));

    if (rows.length > 0) {
      await client.database.from("document_chunks").insert(rows);
    }
  } catch { /* non-fatal */ }
}
