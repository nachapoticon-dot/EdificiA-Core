-- =============================================================
-- Knowledge graph: relaciones entre documentos de obra
-- Habilita queries del estilo "¿qué documentos se contradicen?"
-- y "¿qué documentos derivan de cuál?".
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS obra_relations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID        REFERENCES projects(id) ON DELETE CASCADE,
  source_file_id  UUID        NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  target_file_id  UUID        NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  relation_type   TEXT        NOT NULL
                              CHECK (relation_type IN ('contradicts', 'derives_from', 'supersedes', 'references', 'duplicates')),
  confidence      NUMERIC(4,3) NOT NULL DEFAULT 0.5
                              CHECK (confidence >= 0 AND confidence <= 1),
  detected_by     TEXT        NOT NULL DEFAULT 'system'
                              CHECK (detected_by IN ('system', 'agent', 'user')),
  evidence        JSONB       NOT NULL DEFAULT '{}',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT obra_relations_distinct_files CHECK (source_file_id <> target_file_id)
);

CREATE INDEX IF NOT EXISTS idx_obra_relations_org_project
  ON obra_relations(organization_id, project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_obra_relations_source
  ON obra_relations(source_file_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_obra_relations_target
  ON obra_relations(target_file_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_obra_relations_type
  ON obra_relations(organization_id, relation_type)
  WHERE deleted_at IS NULL;

-- Una sola relación system-detected por (org, source, target, tipo). Los
-- escrituras del agente o usuarios manuales pueden coexistir.
CREATE UNIQUE INDEX IF NOT EXISTS idx_obra_relations_system_unique
  ON obra_relations(organization_id, source_file_id, target_file_id, relation_type)
  WHERE deleted_at IS NULL AND detected_by = 'system';

ALTER TABLE obra_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_relations_select_org" ON obra_relations;
CREATE POLICY "obra_relations_select_org" ON obra_relations FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "obra_relations_insert_editor" ON obra_relations;
CREATE POLICY "obra_relations_insert_editor" ON obra_relations FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "obra_relations_update_editor" ON obra_relations;
CREATE POLICY "obra_relations_update_editor" ON obra_relations FOR UPDATE
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

DROP POLICY IF EXISTS "obra_relations_delete_admin" ON obra_relations;
CREATE POLICY "obra_relations_delete_admin" ON obra_relations FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_admin_policy" ON obra_relations;
CREATE POLICY "project_admin_policy" ON obra_relations FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);
