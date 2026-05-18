-- =============================================================
-- Agent runs
-- Trazabilidad granular por ejecución del agente.
-- Complementa `audit_log_events` (evidencia inmutable) y `work_case_events`
-- (bitácora de expediente) con telemetría consultable por turno.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agent_runs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id          UUID        REFERENCES projects(id) ON DELETE SET NULL,
  work_case_id        UUID        REFERENCES work_cases(id) ON DELETE SET NULL,
  chat_session_id     TEXT        REFERENCES chat_sessions(id) ON DELETE SET NULL,
  actor_user_id       UUID,
  status              TEXT        NOT NULL DEFAULT 'completed'
                                      CHECK (status IN ('completed', 'failed', 'cancelled')),
  model_provider      TEXT        NOT NULL DEFAULT 'deepseek',
  model               TEXT        NOT NULL,
  tier                TEXT        NOT NULL CHECK (tier IN ('fast', 'deep')),
  route_reason        TEXT,
  capability_ids      TEXT[]      NOT NULL DEFAULT '{}',
  step_budget         INTEGER     NOT NULL CHECK (step_budget >= 0),
  steps               INTEGER     NOT NULL CHECK (steps >= 0),
  usage               JSONB       NOT NULL DEFAULT '{}',
  tool_telemetry      JSONB       NOT NULL DEFAULT '[]',
  tool_calls_total    INTEGER     NOT NULL DEFAULT 0 CHECK (tool_calls_total >= 0),
  tool_errors_total   INTEGER     NOT NULL DEFAULT 0 CHECK (tool_errors_total >= 0),
  tool_retries_total  INTEGER     NOT NULL DEFAULT 0 CHECK (tool_retries_total >= 0),
  latency_ms          INTEGER     NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  request_id          TEXT,
  started_at          TIMESTAMPTZ NOT NULL,
  finished_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_org_created
  ON agent_runs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_org_project_created
  ON agent_runs(organization_id, project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_runs_work_case_created
  ON agent_runs(work_case_id, created_at DESC)
  WHERE work_case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_runs_chat_session
  ON agent_runs(chat_session_id, created_at DESC)
  WHERE chat_session_id IS NOT NULL;

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_runs_select_org" ON agent_runs;
CREATE POLICY "agent_runs_select_org" ON agent_runs FOR SELECT
  USING (organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "agent_runs_insert_editor" ON agent_runs;
CREATE POLICY "agent_runs_insert_editor" ON agent_runs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "agent_runs_delete_admin" ON agent_runs;
CREATE POLICY "agent_runs_delete_admin" ON agent_runs FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_admin_policy" ON agent_runs;
CREATE POLICY "project_admin_policy" ON agent_runs FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);
