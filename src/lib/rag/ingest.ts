import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { embedText } from "@/lib/embeddings";
import { getQdrantClient, ensureCollection, COLLECTION_NAME, isQdrantConfigured } from "@/lib/qdrant/client";
import { chunkDocument } from "./chunker";
import type { ProcessedFile } from "@/lib/file-processor/types";

interface IngestOptions {
  organizationId: string;
  fileId: string | null;
  accessToken?: string;
}

/**
 * Full ingestion pipeline:
 *   1. Delete stale chunks for the same file (document versioning — prevents duplicates)
 *   2. Chunk the document by type
 *   3. Batch-embed ALL chunks in parallel via Promise.all (no more sequential awaits)
 *   4. Single batch upsert to Qdrant
 *   5. Persist chunks + qdrant_ids into document_chunks (PostgreSQL fallback)
 *
 * Always non-fatal — never throws, never blocks upload response.
 */
export async function ingestDocument(
  file: ProcessedFile,
  opts: IngestOptions,
): Promise<void> {
  try {
    const chunks = chunkDocument(file);
    if (chunks.length === 0) return;

    const documentType = file.type === "dwg_unsupported" ? "other" : file.type;
    const client = getInsForgeAdminClient();
    const qdrantAvailable = isQdrantConfigured();

    if (qdrantAvailable) {
      await ensureCollection().catch(() => null);
    }

    // --- Fix #4: Purge previous version before ingesting the new one ---
    const { data: stale } = await client.database
      .from("document_chunks")
      .select("qdrant_id")
      .eq("organization_id", opts.organizationId)
      .eq("file_name", file.fileName)
      .not("qdrant_id", "is", null);

    if (stale && stale.length > 0) {
      const staleIds = (stale as { qdrant_id: string | null }[])
        .map((c) => c.qdrant_id)
        .filter((id): id is string => id !== null);

      if (staleIds.length > 0 && qdrantAvailable) {
        await getQdrantClient().delete(COLLECTION_NAME, { points: staleIds }).catch(() => null);
      }
    }

    // Delete all stale rows (including those without a qdrant_id)
    await client.database
      .from("document_chunks")
      .delete()
      .eq("organization_id", opts.organizationId)
      .eq("file_name", file.fileName);

    // --- Fix #1: Batch-embed in parallel instead of sequential await ---
    const qdrantIds = chunks.map(() => crypto.randomUUID());
    const embeddings = await Promise.all(chunks.map((chunk) => embedText(chunk.text)));

    // --- Single batch upsert to Qdrant ---
    const qdrantSucceeded = new Array<boolean>(chunks.length).fill(false);

    if (qdrantAvailable) {
      const validPoints = chunks
        .map((chunk, i) =>
          embeddings[i]
            ? {
                id: qdrantIds[i]!,
                vector: embeddings[i]!,
                payload: {
                  org_id: opts.organizationId,
                  file_id: opts.fileId,
                  file_name: file.fileName,
                  document_type: documentType,
                  chunk_index: chunk.chunkIndex,
                  chunk_text: chunk.text.slice(0, 500),
                  ...chunk.metadata,
                },
              }
            : null,
        )
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (validPoints.length > 0) {
        try {
          await getQdrantClient().upsert(COLLECTION_NAME, { points: validPoints });
          chunks.forEach((_, i) => {
            if (embeddings[i]) qdrantSucceeded[i] = true;
          });
        } catch {
          // Qdrant upsert failed — still persist to PostgreSQL
        }
      }
    }

    const rows = chunks.map((chunk, i) => ({
      organization_id: opts.organizationId,
      file_id: opts.fileId,
      file_name: file.fileName,
      document_type: documentType,
      chunk_index: chunk.chunkIndex,
      chunk_text: chunk.text,
      metadata: chunk.metadata,
      qdrant_id: qdrantSucceeded[i] ? qdrantIds[i] : null,
    }));

    if (rows.length > 0) {
      await client.database.from("document_chunks").insert(rows);
    }
  } catch {
    // Non-fatal: ingest failures never surface to the user
  }
}
