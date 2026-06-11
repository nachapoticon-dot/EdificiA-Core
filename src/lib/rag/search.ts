import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { embedText } from "@/lib/embeddings";
import { sqlQuery } from "@/lib/db/sql";
import { isVectorSearchAvailable, toVectorLiteral } from "./vector";

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
  docTypes?: string[];
}

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

  return { docTypes: types.length > 0 ? [...new Set(types)] : undefined };
}

/**
 * Hybrid search: runs pgvector semantic and PostgreSQL full-text concurrently,
 * merges by score, deduplicates by (fileName + chunkText prefix).
 */
export async function searchDocuments(
  query: string,
  opts: SearchOptions,
): Promise<SearchResult[]> {
  const topK   = opts.topK ?? 5;
  const intent = detectQueryIntent(query);

  const [semanticResults, textResults] = await Promise.all([
    semanticSearch(query, opts, topK, intent),
    textSearchFallback(query, opts.organizationId, topK, opts.projectId),
  ]);

  // If no semantic results, return text results only
  if (semanticResults.length === 0) return textResults;

  // Merge: prefer semantic results, fill remaining slots with unique text results
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  for (const r of semanticResults) {
    const key = dedupeKey(r);
    if (!seen.has(key)) { seen.add(key); merged.push(r); }
  }

  for (const r of textResults) {
    if (merged.length >= topK) break;
    const key = dedupeKey(r);
    if (!seen.has(key)) {
      seen.add(key);
      // Re-score text results relative to semantic scores so merging is fair
      const rescored = { ...r, score: r.score * 0.7 };
      merged.push(rescored);
    }
  }

  return merged.sort((a, b) => b.score - a.score).slice(0, topK);
}

function dedupeKey(r: SearchResult): string {
  return `${r.fileName}::${r.chunkText.slice(0, 80)}`;
}

interface SemanticRow {
  file_id: string | null;
  file_name: string;
  document_type: string;
  chunk_text: string;
  metadata: Record<string, unknown> | null;
  score: number;
}

async function semanticSearch(
  query: string,
  opts: SearchOptions,
  topK: number,
  intent: QueryIntent,
): Promise<SearchResult[]> {
  if (!isVectorSearchAvailable()) return [];

  const embedding = await embedText(query);
  if (!embedding) return [];

  const vector = toVectorLiteral(embedding);

  try {
    // First pass: filtered by construction doc type when intent is clear
    if (intent.docTypes) {
      const filtered = await runVectorQuery(vector, opts, topK, intent.docTypes);
      const relevant = filtered.filter((r) => r.score >= 0.65);
      if (relevant.length >= 2) return relevant.map(toSearchResult);
    }

    const results = await runVectorQuery(vector, opts, topK, null);
    return results.filter((r) => r.score >= 0.55).map(toSearchResult);
  } catch {
    return [];
  }
}

/** Búsqueda coseno en pgvector. score = 1 - distancia (igual escala que Qdrant). */
async function runVectorQuery(
  vector: string,
  opts: SearchOptions,
  topK: number,
  docTypes: string[] | null,
): Promise<SemanticRow[]> {
  const params: unknown[] = [vector, opts.organizationId];
  let where = "organization_id = $2 AND embedding IS NOT NULL";
  if (opts.projectId) {
    params.push(opts.projectId);
    where += ` AND project_id = $${params.length}`;
  }
  if (docTypes && docTypes.length > 0) {
    params.push(docTypes);
    where += ` AND metadata->>'construction_doc_type' = ANY($${params.length})`;
  }
  params.push(topK);
  return sqlQuery<SemanticRow>(
    `SELECT file_id, file_name, document_type, chunk_text, metadata,
            1 - (embedding <=> $1::vector) AS score
     FROM document_chunks
     WHERE ${where}
     ORDER BY embedding <=> $1::vector
     LIMIT $${params.length}`,
    params,
  );
}

function toSearchResult(r: SemanticRow): SearchResult {
  const meta = r.metadata ?? {};
  return {
    fileId:              r.file_id,
    fileName:            r.file_name,
    documentType:        r.document_type,
    constructionDocType: (meta.construction_doc_type as string) ?? "",
    chunkText:           r.chunk_text,
    score:               Number(r.score),
    metadata:            meta,
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
