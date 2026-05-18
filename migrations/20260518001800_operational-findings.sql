-- =============================================================
-- Operational findings read model
-- Hallazgos vivos/accionables separados del audit log inmutable.
-- Ver ROADMAP §2.6: `audit_log_events` queda como evidencia append-only,
-- no como tabla primaria de estado de producto.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS operational_findings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_name      TEXT        NOT NULL,
  finding_key       TEXT        NOT NULL,
  type              TEXT        NOT NULL
                                  CHECK (type IN (
                                    'schedule.overdue',
                                    'schedule.upcoming',
                                    'schedule.blocked',
                                    'hse.non_compliant',
                                    'hse.expiring',
                                    'supply.delayed',
                                    'supply.required_soon',
                                    'financial.overrun',
                                    'project.stale_docs'
                                  )),
  severity          TEXT        NOT NULL
                                  CHECK (severity IN ('info', 'warning', 'critical')),
  status            TEXT        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open', 'resolved', 'dismissed')),
  title             TEXT        NOT NULL,
  detail            TEXT        NOT NULL,
  entity_type       TEXT        NOT NULL,
  entity_id         UUID,
  due_date          DATE,
  source            TEXT        NOT NULL DEFAULT 'proactivity_scan',
  metadata          JSONB       NOT NULL DEFAULT '{}',
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  scanned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (organization_id, project_id, finding_key)
);

CREATE INDEX IF NOT EXISTS idx_operational_findings_org_project_status
  ON operational_findings(organization_id, project_id, status, severity)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_operational_findings_org_status_updated
  ON operational_findings(organization_id, status, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_operational_findings_org_type
  ON operational_findings(organization_id, type, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_operational_findings_entity
  ON operational_findings(entity_type, entity_id)
  WHERE deleted_at IS NULL AND entity_id IS NOT NULL;

ALTER TABLE operational_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operational_findings_select_org" ON operational_findings;
CREATE POLICY "operational_findings_select_org" ON operational_findings FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "operational_findings_insert_editor" ON operational_findings;
CREATE POLICY "operational_findings_insert_editor" ON operational_findings FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "operational_findings_update_editor" ON operational_findings;
CREATE POLICY "operational_findings_update_editor" ON operational_findings FOR UPDATE
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

DROP POLICY IF EXISTS "operational_findings_delete_admin" ON operational_findings;
CREATE POLICY "operational_findings_delete_admin" ON operational_findings FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_admin_policy" ON operational_findings;
CREATE POLICY "project_admin_policy" ON operational_findings FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);
