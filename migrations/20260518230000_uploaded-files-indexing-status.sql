-- Tracks RAG indexing health per uploaded file.
--
-- 'pending'   : ingest no se ejecutó todavía (default).
-- 'indexed'   : chunks insertados en Postgres y vectorizados en Qdrant.
-- 'degraded'  : Postgres OK pero Qdrant falló o no estaba disponible — la
--               búsqueda usa fallback FTS. El usuario puede reintentar.
-- 'failed'    : el pipeline tiró antes de persistir chunks. El archivo es
--               invisible para RAG.
--
-- Es independiente de `processing_status` (que se refiere a la extracción del
-- archivo: parse de PDF, lectura de Excel, etc.). Un archivo puede tener
-- processing_status='ready' y indexing_status='degraded' simultáneamente.

ALTER TABLE uploaded_files
  ADD COLUMN IF NOT EXISTS indexing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (indexing_status IN ('pending', 'indexed', 'degraded', 'failed'));

ALTER TABLE uploaded_files
  ADD COLUMN IF NOT EXISTS indexing_error TEXT;

ALTER TABLE uploaded_files
  ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_uploaded_files_indexing_status
  ON uploaded_files (organization_id, indexing_status)
  WHERE indexing_status IN ('degraded', 'failed');
