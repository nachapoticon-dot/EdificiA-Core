import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { embedText } from "@/lib/embeddings";
import { getQdrantClient, COLLECTION_NAME, isQdrantConfigured } from "@/lib/qdrant/client";

export interface SearchResult {
  fileId: string | null;
  fileName: string;
  documentType: string;
  constructionDocType: string;
  chunkText: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface SearchOptions {
  organizationId: string;
  projectId?: string;
  topK?: number;
}

interface QueryIntent {
  /** Construction doc types to pre-filter. Undefined = search all. */
  docTypes?: string[];
}

/**
 * Detects which construction document type(s) the query is about.
 * Uses simple keyword matching — fast and deterministic.
 */
function detectQueryIntent(query: string): QueryIntent {
  const q = query;
  const types: string[] = [];

  if (/presupuesto|precio|costo|cotizac|oferta|monto|importe|precio\s*unit|PU\b/i.test(q))
    types.push("presupuesto", "computo_metrico");

  if (/memoria|descriptiva|especificac|descripci[oó]n.*t[eé]cnic/i.test(q))
    types.push("memoria_descriptiva");

  if (/plano|geometr[íi]a|[áa]rea|superficie|dimensi[oó]n|capa|cad\b|dxf\b/i.test(q))
    types.push("plano");

  if (/pliego|condicion|requisito|normativa|exigencia|eepp/i.test(q))
    types.push("pliego_de_condiciones");

  if (/certific|habilitac|aprobac|inspecc/i.test(q))
    types.push("certificado");

  // Deduplicate
  return { docTypes: types.length > 0 ? [...new Set(types)] : undefined };
}

/**
 * Semantic search over company documents.
 *
 * Priority:
 *   1. Qdrant vector search with intent-based pre-filter on construction_doc_type
 *      If the filtered search returns nothing, retries without the type filter.
 *   2. PostgreSQL full-text search (Spanish stemming)
 *   3. PostgreSQL ILIKE fallback
 */
export async function searchDocuments(
  query: string,
  opts: SearchOptions,
): Promise<SearchResult[]> {
  const topK   = opts.topK ?? 5;
  const intent = detectQueryIntent(query);

  if (isQdrantConfigured()) {
    const embedding = await embedText(query);
    if (embedding) {
      try {
        const baseMust: object[] = [
          { key: "org_id", match: { value: opts.organizationId } },
        ];
        if (opts.projectId) {
          baseMust.push({ key: "project_id", match: { value: opts.projectId } });
        }

        // First pass: filtered by construction doc type when intent is clear
        if (intent.docTypes) {
          const filtered = await getQdrantClient().search(COLLECTION_NAME, {
            vector: embedding,
            limit: topK,
            filter: {
              must: [
                ...baseMust,
                { key: "construction_doc_type", match: { any: intent.docTypes } },
              ],
            },
            with_payload: true,
          });

          const relevant = filtered.filter((r) => r.score >= 0.65);
          if (relevant.length >= 2) {
            return relevant.map(toSearchResult);
          }
          // Not enough typed results — fall through to unfiltered search
        }

        // Unfiltered search
        const results = await getQdrantClient().search(COLLECTION_NAME, {
          vector: embedding,
          limit: topK,
          filter: { must: baseMust },
          with_payload: true,
        });

        const relevant = results.filter((r) => r.score >= 0.55);
        if (relevant.length > 0) return relevant.map(toSearchResult);
      } catch { /* fall through */ }
    }
  }

  return textSearchFallback(query, opts.organizationId, topK, opts.projectId);
}

function toSearchResult(r: {
  payload?: Record<string, unknown> | null;
  score: number;
}): SearchResult {
  const p = r.payload ?? {};
  return {
    fileId:              (p.file_id as string) ?? null,
    fileName:            (p.file_name as string) ?? "",
    documentType:        (p.document_type as string) ?? "",
    constructionDocType: (p.construction_doc_type as string) ?? "",
    chunkText:           (p.chunk_text as string) ?? "",
    score:               r.score,
    metadata:            p,
  };
}

async function textSearchFallback(
  query: string,
  organizationId: string,
  topK: number,
  projectId?: string,
): Promise<SearchResult[]> {
  const client = getInsForgeAdminClient();
  const cols   = "file_id, file_name, document_type, chunk_text, metadata";

  try {
    const ftsQuery = query.trim().split(/\s+/).map((w) => w + ":*").join(" & ");
    let q = client.database
      .from("document_chunks")
      .select(cols)
      .eq("organization_id", organizationId)
      .textSearch("chunk_text", ftsQuery, { config: "spanish" })
      .limit(topK);
    if (projectId) q = q.eq("project_id", projectId);

    const { data } = await q;
    if (data && data.length > 0) {
      return (data as RawChunk[]).map((r, i) => rawToResult(r, 1 - i * 0.1));
    }
  } catch { /* fall through */ }

  try {
    let q = client.database
      .from("document_chunks")
      .select(cols)
      .eq("organization_id", organizationId)
      .ilike("chunk_text", `%${query.slice(0, 100)}%`)
      .limit(topK);
    if (projectId) q = q.eq("project_id", projectId);

    const { data } = await q;
    return ((data ?? []) as RawChunk[]).map((r, i) => rawToResult(r, 0.5 - i * 0.05));
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

function rawToResult(r: RawChunk, score: number): SearchResult {
  const meta = (r.metadata as Record<string, unknown>) ?? {};
  return {
    fileId:              r.file_id ?? null,
    fileName:            r.file_name,
    documentType:        r.document_type,
    constructionDocType: (meta.construction_doc_type as string) ?? "",
    chunkText:           r.chunk_text,
    score,
    metadata:            meta,
  };
}
