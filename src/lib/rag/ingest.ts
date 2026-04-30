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
 *   1. Chunk the document by type
 *   2. Embed each chunk (null → no OPENAI_API_KEY → skip Qdrant)
 *   3. Upsert vectors into Qdrant (if Qdrant + embeddings available)
 *   4. Persist chunks + qdrant_ids into document_chunks (PostgreSQL fallback)
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

    const rows: Record<string, unknown>[] = [];

    for (const chunk of chunks) {
      const qdrantId = crypto.randomUUID();
      let storedQdrantId: string | null = null;

      const embedding = await embedText(chunk.text);

      if (embedding && qdrantAvailable) {
        try {
          await getQdrantClient().upsert(COLLECTION_NAME, {
            points: [{
              id: qdrantId,
              vector: embedding,
              payload: {
                org_id: opts.organizationId,
                file_id: opts.fileId,
                file_name: file.fileName,
                document_type: documentType,
                chunk_index: chunk.chunkIndex,
                chunk_text: chunk.text.slice(0, 500), // short preview in payload
                ...chunk.metadata,
              },
            }],
          });
          storedQdrantId = qdrantId;
        } catch {
          // Qdrant upsert failed — still persist to PostgreSQL
        }
      }

      rows.push({
        organization_id: opts.organizationId,
        file_id: opts.fileId,
        file_name: file.fileName,
        document_type: documentType,
        chunk_index: chunk.chunkIndex,
        chunk_text: chunk.text,
        metadata: chunk.metadata,
        qdrant_id: storedQdrantId,
      });
    }

    if (rows.length > 0) {
      await client.database.from("document_chunks").insert(rows);
    }
  } catch {
    // Non-fatal: ingest failures never surface to the user
  }
}
