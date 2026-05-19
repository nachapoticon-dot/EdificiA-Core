-- =============================================================
-- Enterprise Context Layer - slice 2 (perfil empresarial vivo)
-- Entidades detectadas, patrones internos, cobertura documental
-- por obra y snapshots del perfil completo.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS enterprise_entities (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type        TEXT         NOT NULL
                                    CHECK (entity_type IN (
                                      'supplier',
                                      'subcontractor',
                                      'trade',
                                      'location',
                                      'cost_center',
                                      'document_type',
                                      'currency',
                                      'naming_convention'
                                    )),
  canonical_name     TEXT         NOT NULL,
  display_name       TEXT         NOT NULL,
  occurrence_count   INTEGER      NOT NULL DEFAULT 0 CHECK (occurrence_count >= 0),
  confidence         NUMERIC(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  last_seen_at       TIMESTAMPTZ,
  metadata           JSONB        NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_entities_unique
  ON enterprise_entities(organization_id, entity_type, canonical_name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_enterprise_entities_org_type
  ON enterprise_entities(organization_id, entity_type, occurrence_count DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS enterprise_entity_aliases (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_id          UUID         NOT NULL REFERENCES enterprise_entities(id) ON DELETE CASCADE,
  alias              TEXT         NOT NULL,
  occurrence_count   INTEGER      NOT NULL DEFAULT 1 CHECK (occurrence_count >= 0),
  last_seen_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_entity_aliases_unique
  ON enterprise_entity_aliases(entity_id, alias);

CREATE INDEX IF NOT EXISTS idx_enterprise_entity_aliases_org
  ON enterprise_entity_aliases(organization_id, entity_id);

CREATE TABLE IF NOT EXISTS enterprise_patterns (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pattern_kind       TEXT         NOT NULL
                                    CHECK (pattern_kind IN (
                                      'naming_convention',
                                      'document_format',
                                      'currency',
                                      'trade_vocabulary',
                                      'source_reliability',
                                      'frequent_supplier',
                                      'frequent_subcontractor',
                                      'sensitivity_default'
                                    )),
  pattern_key        TEXT         NOT NULL,
  pattern_value      JSONB        NOT NULL DEFAULT '{}',
  confidence         NUMERIC(4,3) NOT NULL DEFAULT 0.5
                                    CHECK (confidence >= 0 AND confidence <= 1),
  evidence_count     INTEGER      NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  last_observed_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_patterns_unique
  ON enterprise_patterns(organization_id, pattern_kind, pattern_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_enterprise_patterns_org_kind
  ON enterprise_patterns(organization_id, pattern_kind, evidence_count DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS enterprise_project_coverage (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id           UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  documents_total      INTEGER      NOT NULL DEFAULT 0 CHECK (documents_total >= 0),
  documents_indexed    INTEGER      NOT NULL DEFAULT 0 CHECK (documents_indexed >= 0),
  documents_observed   INTEGER      NOT NULL DEFAULT 0 CHECK (documents_observed >= 0),
  subcontracts_count   INTEGER      NOT NULL DEFAULT 0 CHECK (subcontracts_count >= 0),
  supplies_count       INTEGER      NOT NULL DEFAULT 0 CHECK (supplies_count >= 0),
  hse_records_count    INTEGER      NOT NULL DEFAULT 0 CHECK (hse_records_count >= 0),
  schedule_tasks_count INTEGER      NOT NULL DEFAULT 0 CHECK (schedule_tasks_count >= 0),
  findings_open        INTEGER      NOT NULL DEFAULT 0 CHECK (findings_open >= 0),
  reports_count        INTEGER      NOT NULL DEFAULT 0 CHECK (reports_count >= 0),
  coverage_score       NUMERIC(4,3) NOT NULL DEFAULT 0
                                      CHECK (coverage_score >= 0 AND coverage_score <= 1),
  risk_level           TEXT         NOT NULL DEFAULT 'bajo'
                                      CHECK (risk_level IN ('bajo', 'medio', 'alto', 'critico')),
  last_activity_at     TIMESTAMPTZ,
  metadata             JSONB        NOT NULL DEFAULT '{}',
  computed_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_project_coverage_unique
  ON enterprise_project_coverage(organization_id, project_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_project_coverage_risk
  ON enterprise_project_coverage(organization_id, risk_level, coverage_score);

CREATE TABLE IF NOT EXISTS enterprise_profile_snapshots (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version            INTEGER      NOT NULL,
  entity_count       INTEGER      NOT NULL DEFAULT 0 CHECK (entity_count >= 0),
  pattern_count      INTEGER      NOT NULL DEFAULT 0 CHECK (pattern_count >= 0),
  coverage_count     INTEGER      NOT NULL DEFAULT 0 CHECK (coverage_count >= 0),
  summary            TEXT,
  payload            JSONB        NOT NULL DEFAULT '{}',
  built_by_user_id   UUID,
  trigger_source     TEXT         NOT NULL DEFAULT 'manual'
                                    CHECK (trigger_source IN ('manual', 'scheduled', 'upload', 'system')),
  built_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_profile_snapshots_version
  ON enterprise_profile_snapshots(organization_id, version);

CREATE INDEX IF NOT EXISTS idx_enterprise_profile_snapshots_org_built
  ON enterprise_profile_snapshots(organization_id, built_at DESC);

-- RLS
ALTER TABLE enterprise_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_entity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_project_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_profile_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enterprise_entities_select_org" ON enterprise_entities;
CREATE POLICY "enterprise_entities_select_org" ON enterprise_entities FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "enterprise_entities_insert_editor" ON enterprise_entities;
CREATE POLICY "enterprise_entities_insert_editor" ON enterprise_entities FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "enterprise_entities_update_editor" ON enterprise_entities;
CREATE POLICY "enterprise_entities_update_editor" ON enterprise_entities FOR UPDATE
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

DROP POLICY IF EXISTS "enterprise_entity_aliases_select_org" ON enterprise_entity_aliases;
CREATE POLICY "enterprise_entity_aliases_select_org" ON enterprise_entity_aliases FOR SELECT
  USING (organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "enterprise_entity_aliases_insert_editor" ON enterprise_entity_aliases;
CREATE POLICY "enterprise_entity_aliases_insert_editor" ON enterprise_entity_aliases FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "enterprise_entity_aliases_update_editor" ON enterprise_entity_aliases;
CREATE POLICY "enterprise_entity_aliases_update_editor" ON enterprise_entity_aliases FOR UPDATE
  USING (
    organization_id IN (
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

DROP POLICY IF EXISTS "enterprise_patterns_select_org" ON enterprise_patterns;
CREATE POLICY "enterprise_patterns_select_org" ON enterprise_patterns FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "enterprise_patterns_insert_editor" ON enterprise_patterns;
CREATE POLICY "enterprise_patterns_insert_editor" ON enterprise_patterns FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "enterprise_patterns_update_editor" ON enterprise_patterns;
CREATE POLICY "enterprise_patterns_update_editor" ON enterprise_patterns FOR UPDATE
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

DROP POLICY IF EXISTS "enterprise_project_coverage_select_org" ON enterprise_project_coverage;
CREATE POLICY "enterprise_project_coverage_select_org" ON enterprise_project_coverage FOR SELECT
  USING (organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "enterprise_project_coverage_insert_editor" ON enterprise_project_coverage;
CREATE POLICY "enterprise_project_coverage_insert_editor" ON enterprise_project_coverage FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "enterprise_project_coverage_update_editor" ON enterprise_project_coverage;
CREATE POLICY "enterprise_project_coverage_update_editor" ON enterprise_project_coverage FOR UPDATE
  USING (
    organization_id IN (
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

DROP POLICY IF EXISTS "enterprise_profile_snapshots_select_org" ON enterprise_profile_snapshots;
CREATE POLICY "enterprise_profile_snapshots_select_org" ON enterprise_profile_snapshots FOR SELECT
  USING (organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "enterprise_profile_snapshots_insert_editor" ON enterprise_profile_snapshots;
CREATE POLICY "enterprise_profile_snapshots_insert_editor" ON enterprise_profile_snapshots FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

-- project_admin role total access
DROP POLICY IF EXISTS "project_admin_policy" ON enterprise_entities;
CREATE POLICY "project_admin_policy" ON enterprise_entities FOR ALL TO project_admin USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "project_admin_policy" ON enterprise_entity_aliases;
CREATE POLICY "project_admin_policy" ON enterprise_entity_aliases FOR ALL TO project_admin USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "project_admin_policy" ON enterprise_patterns;
CREATE POLICY "project_admin_policy" ON enterprise_patterns FOR ALL TO project_admin USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "project_admin_policy" ON enterprise_project_coverage;
CREATE POLICY "project_admin_policy" ON enterprise_project_coverage FOR ALL TO project_admin USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "project_admin_policy" ON enterprise_profile_snapshots;
CREATE POLICY "project_admin_policy" ON enterprise_profile_snapshots FOR ALL TO project_admin USING (true) WITH CHECK (true);
