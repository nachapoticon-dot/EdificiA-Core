-- =============================================================
-- Migración 003: Hardening — índices, soft deletes, columnas faltantes, RLS fixes
-- =============================================================

-- ── Columnas faltantes en tablas existentes ──────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'deleted'));

ALTER TABLE uploaded_files
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'ready', 'error'));

-- ── Soft deletes en todas las tablas mutables ─────────────────────────────────

ALTER TABLE organizations        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE uploaded_files       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE audit_sessions       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── Índices de rendimiento ────────────────────────────────────────────────────
-- organization_members es la tabla más crítica: se ejecuta como subquery en CADA política RLS

CREATE INDEX IF NOT EXISTS idx_org_members_user_id
  ON organization_members(user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_members_org_id
  ON organization_members(organization_id) WHERE deleted_at IS NULL;

-- projects
CREATE INDEX IF NOT EXISTS idx_projects_org_id
  ON projects(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_created_by
  ON projects(created_by) WHERE deleted_at IS NULL;

-- uploaded_files
CREATE INDEX IF NOT EXISTS idx_files_org_id
  ON uploaded_files(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_project_id
  ON uploaded_files(project_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_uploaded_by
  ON uploaded_files(uploaded_by) WHERE deleted_at IS NULL;

-- audit_sessions
CREATE INDEX IF NOT EXISTS idx_sessions_org_id
  ON audit_sessions(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_project_id
  ON audit_sessions(project_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_file_id
  ON audit_sessions(file_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_created_by
  ON audit_sessions(created_by) WHERE deleted_at IS NULL;

-- chat_messages (alto volumen — siempre consultado por session_id)
CREATE INDEX IF NOT EXISTS idx_messages_session_id
  ON chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_messages_org_id
  ON chat_messages(organization_id);

-- ── RLS — reemplazar policies para filtrar soft deletes + WITH CHECK en UPDATE ─

-- ORGANIZATIONS
DROP POLICY IF EXISTS "org_select_own"    ON organizations;
DROP POLICY IF EXISTS "org_update_admin"  ON organizations;

CREATE POLICY "org_select_own" ON organizations FOR SELECT
  USING (
    deleted_at IS NULL
    AND id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "org_update_admin" ON organizations FOR UPDATE
  USING (
    deleted_at IS NULL
    AND id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

-- ORGANIZATION_MEMBERS
DROP POLICY IF EXISTS "members_select_own_org" ON organization_members;
DROP POLICY IF EXISTS "members_insert_admin"   ON organization_members;

CREATE POLICY "members_select_own_org" ON organization_members FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "members_insert_admin" ON organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

CREATE POLICY "members_update_admin" ON organization_members FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

-- PROJECTS
DROP POLICY IF EXISTS "projects_select_org" ON projects;
DROP POLICY IF EXISTS "projects_insert_org" ON projects;
DROP POLICY IF EXISTS "projects_update_org" ON projects;
DROP POLICY IF EXISTS "projects_delete_admin" ON projects;

CREATE POLICY "projects_select_org" ON projects FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "projects_insert_org" ON projects FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "projects_update_org" ON projects FOR UPDATE
  USING (
    deleted_at IS NULL
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "projects_delete_admin" ON projects FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

-- UPLOADED_FILES
DROP POLICY IF EXISTS "files_select_org"           ON uploaded_files;
DROP POLICY IF EXISTS "files_insert_org"           ON uploaded_files;
DROP POLICY IF EXISTS "files_delete_owner_or_admin" ON uploaded_files;

CREATE POLICY "files_select_org" ON uploaded_files FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "files_insert_org" ON uploaded_files FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "files_update_owner" ON uploaded_files FOR UPDATE
  USING (
    deleted_at IS NULL
    AND uploaded_by = auth.uid()
  )
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "files_delete_owner_or_admin" ON uploaded_files FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

-- AUDIT_SESSIONS
DROP POLICY IF EXISTS "sessions_select_org"    ON audit_sessions;
DROP POLICY IF EXISTS "sessions_insert_org"    ON audit_sessions;
DROP POLICY IF EXISTS "sessions_update_owner"  ON audit_sessions;

CREATE POLICY "sessions_select_org" ON audit_sessions FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "sessions_insert_org" ON audit_sessions FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "sessions_update_owner" ON audit_sessions FOR UPDATE
  USING (
    deleted_at IS NULL
    AND created_by = auth.uid()
  )
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "sessions_delete_owner_or_admin" ON audit_sessions FOR DELETE
  USING (
    created_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

-- CHAT_MESSAGES
DROP POLICY IF EXISTS "messages_select_org" ON chat_messages;
DROP POLICY IF EXISTS "messages_insert_org" ON chat_messages;

CREATE POLICY "messages_select_org" ON chat_messages FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "messages_insert_org" ON chat_messages FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "messages_delete_admin" ON chat_messages FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );
