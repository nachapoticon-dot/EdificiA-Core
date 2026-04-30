import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { embedText } from "@/lib/embeddings";
import { getQdrantClient, COLLECTION_NAME, isQdrantConfigured } from "@/lib/qdrant/client";

export interface SearchResult {
  fileId: string | null;
  fileName: string;
  documentType: string;
  chunkText: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface SearchOptions {
  organizationId: string;
  topK?: number;
}

/**
 * Semantic search over company documents.
 *
 * Priority:
 *   1. Qdrant vector search (when QDRANT_URL + OPENAI_API_KEY are set)
 *   2. PostgreSQL full-text search (Spanish stemming via tsvector)
 *   3. PostgreSQL ILIKE fallback (simplest, always works)
 */
export async function searchDocuments(
  query: string,
  opts: SearchOptions,
): Promise<SearchResult[]> {
  const topK = opts.topK ?? 5;

  // Try semantic search first
  if (isQdrantConfigured()) {
    const embedding = await embedText(query);
    if (embedding) {
      try {
        const results = await getQdrantClient().search(COLLECTION_NAME, {
          vector: embedding,
          limit: topK,
          filter: {
            must: [{ key: "org_id", match: { value: opts.organizationId } }],
          },
          with_payload: true,
        });

        if (results.length > 0) {
          return results.map((r) => ({
            fileId: (r.payload?.file_id as string) ?? null,
            fileName: (r.payload?.file_name as string) ?? "",
            documentType: (r.payload?.document_type as string) ?? "",
            chunkText: (r.payload?.chunk_text as string) ?? "",
            score: r.score,
            metadata: (r.payload ?? {}) as Record<string, unknown>,
          }));
        }
      } catch {
        // Fall through to text search
      }
    }
  }

  // Text search fallback (PostgreSQL)
  return textSearchFallback(query, opts.organizationId, topK);
}

async function textSearchFallback(
  query: string,
  organizationId: string,
  topK: number,
): Promise<SearchResult[]> {
  const client = getInsForgeAdminClient();

  // Full-text search
  try {
    const ftsQuery = query.trim().split(/\s+/).map((w) => w + ":*").join(" & ");
    const ftsResult = await client.database
      .from("document_chunks")
      .select("file_id, file_name, document_type, chunk_text, metadata")
      .eq("organization_id", organizationId)
      .textSearch("chunk_text", ftsQuery, { config: "spanish" })
      .limit(topK);

    if (ftsResult.data && ftsResult.data.length > 0) {
      return (ftsResult.data as RawChunk[]).map((r, i) => ({
        fileId: r.file_id ?? null,
        fileName: r.file_name,
        documentType: r.document_type,
        chunkText: r.chunk_text,
        score: 1 - i * 0.1,
        metadata: (r.metadata as Record<string, unknown>) ?? {},
      }));
    }
  } catch {
    // Fall through to ILIKE
  }

  // ILIKE fallback
  try {
    const ilikeResult = await client.database
      .from("document_chunks")
      .select("file_id, file_name, document_type, chunk_text, metadata")
      .eq("organization_id", organizationId)
      .ilike("chunk_text", `%${query.slice(0, 100)}%`)
      .limit(topK);

    return ((ilikeResult.data ?? []) as RawChunk[]).map((r, i) => ({
      fileId: r.file_id ?? null,
      fileName: r.file_name,
      documentType: r.document_type,
      chunkText: r.chunk_text,
      score: 0.5 - i * 0.05,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    }));
  } catch {
    return [];
  }
}

interface RawChunk {
  file_id?: string | null;
  file_name: string;
  document_type: string;
  chunk_text: string;
  metadata?: unknown;
}
