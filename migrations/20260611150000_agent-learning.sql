-- Aprendizaje real del agente (Fase 6 del plan de desconexión).
-- Reemplaza las heurísticas TS (profile-aggregator/session-learner) por un loop:
-- reflexión LLM post-turno + feedback explícito del usuario → memorias con
-- embedding → retrieval semántico por scope → refuerzo/decaimiento por uso.

CREATE TABLE IF NOT EXISTS agent_memories (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL,
  project_id      UUID,
  work_case_id    UUID,
  scope           TEXT        NOT NULL CHECK (scope IN ('org', 'project', 'work_case')),
  kind            TEXT        NOT NULL CHECK (kind IN ('preference', 'correction', 'fact', 'procedure')),
  content         TEXT        NOT NULL,
  embedding       vector(1024),
  confidence      REAL        NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  use_count       INT         NOT NULL DEFAULT 0,
  last_used_at    TIMESTAMPTZ,
  source          TEXT        NOT NULL CHECK (source IN ('reflection', 'feedback', 'explicit')),
  source_run_id   UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_org ON agent_memories (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_memories_project ON agent_memories (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding ON agent_memories USING hnsw (embedding vector_cosine_ops);

ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_memories_select_org" ON agent_memories;
CREATE POLICY "agent_memories_select_org" ON agent_memories
  FOR SELECT USING (organization_id IN (SELECT get_my_org_ids()));
DROP POLICY IF EXISTS "project_admin_policy" ON agent_memories;
CREATE POLICY "project_admin_policy" ON agent_memories FOR ALL TO project_admin USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS agent_feedback (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL,
  chat_session_id TEXT,
  message_id      TEXT,
  agent_run_id    UUID,
  user_id         UUID        NOT NULL,
  rating          SMALLINT    NOT NULL CHECK (rating IN (-1, 1)),
  comment         TEXT,
  correction      TEXT,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_org ON agent_feedback (organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_unprocessed ON agent_feedback (created_at) WHERE processed_at IS NULL;

ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_feedback_select_org" ON agent_feedback;
CREATE POLICY "agent_feedback_select_org" ON agent_feedback
  FOR SELECT USING (organization_id IN (SELECT get_my_org_ids()));
DROP POLICY IF EXISTS "project_admin_policy" ON agent_feedback;
CREATE POLICY "project_admin_policy" ON agent_feedback FOR ALL TO project_admin USING (true) WITH CHECK (true);
