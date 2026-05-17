-- =============================================================
-- Migración 008: project_id en document_chunks para búsqueda
--               contextual por obra (RAG project-scoped)
-- =============================================================

-- document_chunks ya tiene file_id → uploaded_files(project_id).
-- Denormalizamos project_id para evitar JOINs en cada búsqueda
-- y para filtrar directamente en Qdrant mediante payload filter.

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Index parcial (solo filas con proyecto — la mayoría de la base)
CREATE INDEX IF NOT EXISTS idx_document_chunks_project
  ON document_chunks(project_id) WHERE project_id IS NOT NULL;

-- Index compuesto para la búsqueda más común: org + proyecto
CREATE INDEX IF NOT EXISTS idx_document_chunks_org_project
  ON document_chunks(organization_id, project_id) WHERE project_id IS NOT NULL;
