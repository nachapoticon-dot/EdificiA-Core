-- =============================================================
-- Enterprise Context Layer - slice 1
-- Fuentes, inventario documental y corridas de sincronizacion.
-- Incluye backfill de uploaded_files como documentos empresariales.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS enterprise_sources (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_type      TEXT        NOT NULL
                                CHECK (source_type IN (
                                  'manual_upload',
                                  'google_drive',
                                  'onedrive',
                                  'sharepoint',
                                  'dropbox',
                                  'sql',
                                  'csv_export',
                                  'erp',
                                  'email',
                                  'other'
                                )),
  name             TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('discovered', 'authorized', 'syncing', 'active', 'paused', 'error', 'revoked')),
  read_only        BOOLEAN     NOT NULL DEFAULT TRUE,
  scopes           JSONB       NOT NULL DEFAULT '[]',
  sync_cursor      JSONB       NOT NULL DEFAULT '{}',
  last_synced_at   TIMESTAMPTZ,
  error_message    TEXT,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_sources_manual_upload_unique
  ON enterprise_sources(organization_id, source_type)
  WHERE deleted_at IS NULL AND source_type = 'manual_upload';

CREATE INDEX IF NOT EXISTS idx_enterprise_sources_org_status
  ON enterprise_sources(organization_id, status)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS enterprise_documents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id         UUID        REFERENCES enterprise_sources(id) ON DELETE SET NULL,
  uploaded_file_id  UUID        REFERENCES uploaded_files(id) ON DELETE SET NULL,
  project_id        UUID        REFERENCES projects(id) ON DELETE SET NULL,
  work_case_id      UUID        REFERENCES work_cases(id) ON DELETE SET NULL,
  readiness_status  TEXT        NOT NULL DEFAULT 'inventariada'
                                  CHECK (readiness_status IN (
                                    'descubierta',
                                    'inventariada',
                                    'clasificada',
                                    'normalizada',
                                    'indexada',
                                    'operativa',
                                    'observada'
                                  )),
  document_type     TEXT        NOT NULL DEFAULT 'document',
  title             TEXT        NOT NULL,
  source_path       TEXT,
  external_id       TEXT,
  sensitivity       TEXT        NOT NULL DEFAULT 'internal'
                                  CHECK (sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
  confidence        NUMERIC(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_documents_uploaded_file_unique
  ON enterprise_documents(uploaded_file_id)
  WHERE uploaded_file_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_documents_source_external_unique
  ON enterprise_documents(source_id, external_id)
  WHERE source_id IS NOT NULL AND external_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_enterprise_documents_org_status
  ON enterprise_documents(organization_id, readiness_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_enterprise_documents_org_project
  ON enterprise_documents(organization_id, project_id)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enterprise_documents_org_title
  ON enterprise_documents USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(source_path, '') || ' ' || coalesce(document_type, '')))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS enterprise_sync_runs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id         UUID        REFERENCES enterprise_sources(id) ON DELETE SET NULL,
  status            TEXT        NOT NULL DEFAULT 'running'
                                  CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  trigger_type      TEXT        NOT NULL DEFAULT 'system'
                                  CHECK (trigger_type IN ('manual', 'scheduled', 'upload', 'system')),
  discovered_count  INTEGER     NOT NULL DEFAULT 0 CHECK (discovered_count >= 0),
  inventoried_count INTEGER     NOT NULL DEFAULT 0 CHECK (inventoried_count >= 0),
  classified_count  INTEGER     NOT NULL DEFAULT 0 CHECK (classified_count >= 0),
  indexed_count     INTEGER     NOT NULL DEFAULT 0 CHECK (indexed_count >= 0),
  observed_count    INTEGER     NOT NULL DEFAULT 0 CHECK (observed_count >= 0),
  error_message     TEXT,
  metadata          JSONB       NOT NULL DEFAULT '{}',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_sync_runs_org_created
  ON enterprise_sync_runs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enterprise_sync_runs_source_created
  ON enterprise_sync_runs(source_id, created_at DESC)
  WHERE source_id IS NOT NULL;

ALTER TABLE enterprise_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enterprise_sources_select_org" ON enterprise_sources;
CREATE POLICY "enterprise_sources_select_org" ON enterprise_sources FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "enterprise_sources_insert_editor" ON enterprise_sources;
CREATE POLICY "enterprise_sources_insert_editor" ON enterprise_sources FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "enterprise_sources_update_editor" ON enterprise_sources;
CREATE POLICY "enterprise_sources_update_editor" ON enterprise_sources FOR UPDATE
  USING (
    deleted_at IS NULL AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "enterprise_documents_select_org" ON enterprise_documents;
CREATE POLICY "enterprise_documents_select_org" ON enterprise_documents FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "enterprise_documents_insert_editor" ON enterprise_documents;
CREATE POLICY "enterprise_documents_insert_editor" ON enterprise_documents FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "enterprise_documents_update_editor" ON enterprise_documents;
CREATE POLICY "enterprise_documents_update_editor" ON enterprise_documents FOR UPDATE
  USING (
    deleted_at IS NULL AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "enterprise_sync_runs_select_org" ON enterprise_sync_runs;
CREATE POLICY "enterprise_sync_runs_select_org" ON enterprise_sync_runs FOR SELECT
  USING (organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "enterprise_sync_runs_insert_editor" ON enterprise_sync_runs;
CREATE POLICY "enterprise_sync_runs_insert_editor" ON enterprise_sync_runs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_admin_policy" ON enterprise_sources;
CREATE POLICY "project_admin_policy" ON enterprise_sources FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "project_admin_policy" ON enterprise_documents;
CREATE POLICY "project_admin_policy" ON enterprise_documents FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "project_admin_policy" ON enterprise_sync_runs;
CREATE POLICY "project_admin_policy" ON enterprise_sync_runs FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);

-- Fuente manual por organización que ya tenga archivos subidos.
INSERT INTO enterprise_sources (
  organization_id,
  source_type,
  name,
  status,
  read_only,
  metadata
)
SELECT DISTINCT
  uploaded_files.organization_id,
  'manual_upload',
  'Archivos subidos a EdificIA',
  'active',
  TRUE,
  '{"origin":"uploaded_files_backfill"}'::jsonb
FROM uploaded_files
WHERE uploaded_files.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM enterprise_sources existing
    WHERE existing.organization_id = uploaded_files.organization_id
      AND existing.source_type = 'manual_upload'
      AND existing.deleted_at IS NULL
  );

-- Inventario inicial desde uploaded_files.
INSERT INTO enterprise_documents (
  organization_id,
  source_id,
  uploaded_file_id,
  project_id,
  readiness_status,
  document_type,
  title,
  source_path,
  external_id,
  sensitivity,
  metadata,
  created_at,
  updated_at
)
SELECT
  files.organization_id,
  source.id,
  files.id,
  files.project_id,
  CASE
    WHEN files.indexing_status = 'indexed' THEN 'indexada'
    WHEN files.indexing_status = 'degraded' THEN 'observada'
    WHEN files.indexing_status = 'failed' THEN 'observada'
    ELSE 'inventariada'
  END,
  COALESCE(NULLIF(files.file_type, ''), 'document'),
  files.file_name,
  files.storage_path,
  files.id::text,
  'internal',
  jsonb_build_object(
    'origin', 'uploaded_files_backfill',
    'processingStatus', files.processing_status,
    'indexingStatus', files.indexing_status,
    'indexingError', files.indexing_error,
    'fileSizeBytes', files.file_size_bytes
  ),
  files.created_at,
  NOW()
FROM uploaded_files files
JOIN enterprise_sources source
  ON source.organization_id = files.organization_id
 AND source.source_type = 'manual_upload'
 AND source.deleted_at IS NULL
WHERE files.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM enterprise_documents existing
    WHERE existing.uploaded_file_id = files.id
      AND existing.deleted_at IS NULL
  );
