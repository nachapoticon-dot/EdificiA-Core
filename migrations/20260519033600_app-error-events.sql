-- =============================================================
-- App error events
-- Lightweight alerting/read model for production errors without
-- adding a third-party dependency.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_error_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  actor_user_id   UUID,
  request_id      TEXT,
  route           TEXT        NOT NULL,
  method          TEXT,
  severity        TEXT        NOT NULL DEFAULT 'error'
                                CHECK (severity IN ('warning', 'error', 'critical')),
  fingerprint     TEXT        NOT NULL,
  message         TEXT        NOT NULL,
  stack           TEXT,
  context         JSONB       NOT NULL DEFAULT '{}',
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_error_events_org_created
  ON app_error_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_error_events_fingerprint_created
  ON app_error_events(fingerprint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_error_events_unresolved
  ON app_error_events(organization_id, severity, created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE app_error_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_error_events_select_admin" ON app_error_events;
CREATE POLICY "app_error_events_select_admin" ON app_error_events FOR SELECT
  USING (
    organization_id IS NULL OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "app_error_events_insert_editor" ON app_error_events;
CREATE POLICY "app_error_events_insert_editor" ON app_error_events FOR INSERT
  WITH CHECK (
    organization_id IS NULL OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "app_error_events_update_admin" ON app_error_events;
CREATE POLICY "app_error_events_update_admin" ON app_error_events FOR UPDATE
  USING (
    organization_id IS NULL OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IS NULL OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_admin_policy" ON app_error_events;
CREATE POLICY "project_admin_policy" ON app_error_events FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);
