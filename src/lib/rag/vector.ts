/**
 * Helpers de búsqueda vectorial sobre pgvector (reemplazo de Qdrant).
 * Los vectores viven en document_chunks.embedding (vector(1024), bge-m3).
 */

export const EMBEDDING_DIM = 1024;

/** Serializa un embedding al formato de texto de pgvector: "[0.1,0.2,...]". */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/** La búsqueda semántica está disponible si podemos generar embeddings. */
export function isVectorSearchAvailable(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}
