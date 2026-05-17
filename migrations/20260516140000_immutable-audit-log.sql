-- =============================================================
-- Immutable audit log
-- Append-only register for legal/operational events.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_log_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  actor_user_id   UUID,
  event_type      TEXT        NOT NULL,
  entity_type     TEXT        NOT NULL,
  entity_id       UUID,
  severity        TEXT        NOT NULL DEFAULT 'info'
                              CHECK (severity IN ('info', 'warning', 'error', 'security')),
  source          TEXT        NOT NULL DEFAULT 'app',
  request_id      TEXT,
  payload         JSONB       NOT NULL DEFAULT '{}',
  pii_scan        JSONB,
  prev_hash       TEXT,
  event_hash      TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_events_org_created
  ON audit_log_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_events_project_created
  ON audit_log_events(project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_events_entity
  ON audit_log_events(entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_events_type_created
  ON audit_log_events(event_type, created_at DESC);

CREATE OR REPLACE FUNCTION set_audit_log_event_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  previous_hash TEXT;
BEGIN
  SELECT event_hash
  INTO previous_hash
  FROM audit_log_events
  WHERE organization_id = NEW.organization_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  NEW.prev_hash := previous_hash;
  NEW.event_hash := encode(
    digest(
      concat_ws(
        '|',
        NEW.organization_id::TEXT,
        COALESCE(NEW.project_id::TEXT, ''),
        COALESCE(NEW.actor_user_id::TEXT, ''),
        NEW.event_type,
        NEW.entity_type,
        COALESCE(NEW.entity_id::TEXT, ''),
        NEW.severity,
        NEW.source,
        COALESCE(NEW.request_id, ''),
        NEW.payload::TEXT,
        COALESCE(NEW.pii_scan::TEXT, ''),
        COALESCE(previous_hash, ''),
        NEW.created_at::TEXT
      ),
      'sha256'
    ),
    'hex'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_audit_log_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_events_hash ON audit_log_events;
CREATE TRIGGER trg_audit_log_events_hash
  BEFORE INSERT ON audit_log_events
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_log_event_hash();

DROP TRIGGER IF EXISTS trg_audit_log_events_no_update ON audit_log_events;
CREATE TRIGGER trg_audit_log_events_no_update
  BEFORE UPDATE ON audit_log_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_event_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_events_no_delete ON audit_log_events;
CREATE TRIGGER trg_audit_log_events_no_delete
  BEFORE DELETE ON audit_log_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_event_mutation();

ALTER TABLE audit_log_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_events_select_org" ON audit_log_events FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- No INSERT/UPDATE/DELETE policies: clients cannot write or mutate the log.
-- The server uses service-role; triggers still block UPDATE/DELETE.
