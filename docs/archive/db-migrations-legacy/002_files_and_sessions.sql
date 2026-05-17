-- =============================================================
-- Migración 002: Proyectos, archivos, sesiones y mensajes
-- =============================================================

-- Proyectos de obra por organización
CREATE TABLE IF NOT EXISTS projects (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  created_by      UUID        NOT NULL,  -- auth.users.id
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Metadata de archivos subidos (el binario vive en Storage bucket "legajos")
CREATE TABLE IF NOT EXISTS uploaded_files (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  uploaded_by     UUID        NOT NULL,  -- auth.users.id
  file_name       TEXT        NOT NULL,
  file_type       TEXT        NOT NULL,  -- 'excel' | 'pdf' | 'word' | 'image' | 'other'
  storage_path    TEXT        NOT NULL,  -- path dentro del bucket "legajos"
  file_size_bytes BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sesiones de auditoría (una por conversación/análisis)
CREATE TABLE IF NOT EXISTS audit_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  file_id         UUID        REFERENCES uploaded_files(id) ON DELETE SET NULL,
  created_by      UUID        NOT NULL,  -- auth.users.id
  title           TEXT,                  -- título generado por la IA al resumir
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'completed', 'error')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historial de mensajes del chat (audit trail completo)
CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- RLS — aislamiento multi-tenant estricto en todas las tablas
-- =============================================================

ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages  ENABLE ROW LEVEL SECURITY;

-- Helper reutilizable: ¿el usuario pertenece a esta organización?
-- (usado en los USING de las policies abajo)

-- PROJECTS
CREATE POLICY "projects_select_org" ON projects FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "projects_insert_org" ON projects FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "projects_update_org" ON projects FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "projects_delete_admin" ON projects FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- UPLOADED FILES
CREATE POLICY "files_select_org" ON uploaded_files FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "files_insert_org" ON uploaded_files FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "files_delete_owner_or_admin" ON uploaded_files FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- AUDIT SESSIONS
CREATE POLICY "sessions_select_org" ON audit_sessions FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "sessions_insert_org" ON audit_sessions FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "sessions_update_owner" ON audit_sessions FOR UPDATE
  USING (created_by = auth.uid());

-- CHAT MESSAGES
CREATE POLICY "messages_select_org" ON chat_messages FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "messages_insert_org" ON chat_messages FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
