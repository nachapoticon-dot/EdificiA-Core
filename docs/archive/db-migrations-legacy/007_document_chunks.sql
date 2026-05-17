-- =============================================================
-- Migración 007: Base documental — tabla de chunks para text search fallback
-- =============================================================
-- Qdrant Cloud almacena los vectores. Esta tabla almacena el texto
-- de cada chunk + metadata, sirviendo como fallback de búsqueda
-- cuando no hay OPENAI_API_KEY configurada (ILIKE sobre chunk_text).
-- También sincroniza el qdrant_id para correlacionar resultados.

CREATE TABLE IF NOT EXISTS document_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_id         UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,
  file_name       TEXT NOT NULL,
  document_type   TEXT NOT NULL,  -- 'excel' | 'pdf' | 'dxf' | 'docx' | 'image'
  chunk_index     INT NOT NULL DEFAULT 0,
  chunk_text      TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  qdrant_id       TEXT,           -- UUID del vector en Qdrant (null si no hay embedding)
  generated_by    TEXT,           -- 'edificia' si fue generado por el agente
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chunks_select_own_org" ON document_chunks
  FOR SELECT USING (organization_id IN (SELECT get_my_org_ids()));

CREATE POLICY "chunks_insert_own_org" ON document_chunks
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_my_org_ids()));

CREATE POLICY "chunks_delete_own_org" ON document_chunks
  FOR DELETE USING (organization_id IN (SELECT get_my_org_ids()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_chunks_org  ON document_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_file ON document_chunks(file_id);
-- Full-text search fallback (spanish stemming)
CREATE INDEX IF NOT EXISTS idx_document_chunks_fts
  ON document_chunks USING GIN(to_tsvector('spanish', chunk_text));
