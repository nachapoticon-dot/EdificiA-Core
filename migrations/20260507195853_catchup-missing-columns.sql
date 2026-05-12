-- =============================================================
-- Catchup: columnas soft-delete + campos faltantes
-- Todas las sentencias usan IF NOT EXISTS para ser idempotentes
-- =============================================================

-- Soft-delete en tablas mutables
ALTER TABLE organizations        ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;
ALTER TABLE organizations        ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;
ALTER TABLE projects             ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;
ALTER TABLE projects             ADD COLUMN IF NOT EXISTS status            TEXT NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active', 'archived', 'deleted'));
ALTER TABLE uploaded_files       ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;
ALTER TABLE uploaded_files       ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending'
                                   CHECK (processing_status IN ('pending', 'processing', 'ready', 'error'));
ALTER TABLE audit_sessions       ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;

-- Indices de rendimiento (requieren que deleted_at exista)
CREATE INDEX IF NOT EXISTS idx_org_members_user_id
  ON organization_members(user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_members_org_id
  ON organization_members(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_members_email
  ON organization_members(email);

CREATE INDEX IF NOT EXISTS idx_projects_org_id
  ON projects(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_org_id
  ON uploaded_files(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_project_id
  ON uploaded_files(project_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_org_id
  ON audit_sessions(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_session_id
  ON chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_messages_org_id
  ON chat_messages(organization_id);

-- Invitacion fundador principal
INSERT INTO org_founder_invitations (email, company_name, status, notes, expires_at)
VALUES (
  'pedroluisfuentesprieto@gmail.com',
  'EdificIA',
  'pending',
  'Cuenta fundador principal',
  NOW() + INTERVAL '365 days'
)
ON CONFLICT (email) DO UPDATE
  SET status     = 'pending',
      expires_at = NOW() + INTERVAL '365 days';
