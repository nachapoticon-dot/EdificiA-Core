-- Sprint 28: Persistent chat sessions + message snapshots
-- Uses chat_snapshots (not chat_messages) to avoid conflict with the
-- legacy chat_messages table from migration 002 (per-message audit trail).
-- chat_snapshots stores the full UIMessage[] JSON per session as a single row.
--
-- Access: ALL access goes through the InsForge admin/service_role client.
-- RLS is enabled with no user-facing policies — service_role bypasses RLS.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id              TEXT        PRIMARY KEY,   -- UUID v4, generated client-side
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         TEXT        NOT NULL,      -- UUID como string (auth.users.id)
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  file_type       TEXT        CHECK (file_type IN ('excel', 'pdf', 'dxf', 'docx', 'image')),
  started_at      BIGINT      NOT NULL,      -- Unix ms timestamp (matches localStorage)
  last_message_at TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- Regular users cannot access this table directly.
CREATE POLICY "chat_sessions_service_only" ON chat_sessions
  USING (false);

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_snapshots (
  session_id      TEXT        PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  messages        JSONB       NOT NULL DEFAULT '[]',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_snapshots_service_only" ON chat_snapshots
  USING (false);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_user
  ON chat_sessions(organization_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_started_at
  ON chat_sessions(started_at DESC)
  WHERE deleted_at IS NULL;
