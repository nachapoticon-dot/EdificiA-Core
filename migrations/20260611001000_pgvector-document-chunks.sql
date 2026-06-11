-- pgvector reemplaza Qdrant: los embeddings viven junto a los chunks.
-- baai/bge-m3 (NVIDIA NIM) = 1024 dimensiones, distancia coseno.
-- qdrant_id queda por compatibilidad histórica pero deja de poblarse.

ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector(1024);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON document_chunks USING hnsw (embedding vector_cosine_ops);
