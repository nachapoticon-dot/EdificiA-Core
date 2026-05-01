-- Sprint 28: Persistent chat sessions + messages
-- Replaces the localStorage-only system with DB-backed storage.
-- localStorage is kept as a write-through cache; DB is the source of truth.
-- started_at is BIGINT (ms timestamp) for direct compatibility with the
-- existing SessionEntry.startedAt: number field — no conversion needed.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id            TEXT PRIMARY KEY,          -- UUID v4, generated client-side
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  file_type     TEXT CHECK (file_type IN ('excel', 'pdf', 'dxf', 'docx', 'image')),
  started_at    BIGINT NOT NULL,           -- Unix ms timestamp
  last_message_at TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  session_id      TEXT PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  messages        JSONB NOT NULL DEFAULT '[]',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_user
  ON chat_sessions(organization_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_started_at
  ON chat_sessions(started_at DESC)
  WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_access_sessions"
  ON chat_sessions FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()::TEXT AND deleted_at IS NULL
    )
  );

CREATE POLICY "org_members_can_access_messages"
  ON chat_messages FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()::TEXT AND deleted_at IS NULL
    )
  );
