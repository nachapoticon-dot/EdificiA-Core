-- Baseline consolidado del schema base de EdificIA.
-- Concatenación verbatim de docs/archive/db-migrations-legacy/001..015,
-- que es el estado que las migraciones activas (2026*) asumen como punto de partida.
-- Se excluye 016_immutable_audit_log.sql: es idéntica a la migración activa
-- 20260516140000_immutable-audit-log.sql, que la recrea.
-- No editar a mano: ante drift, corregir con una migración nueva.

-- ============================================================
-- >> 001_initial_schema.sql
-- ============================================================
-- =============================================================
-- Migración 001: Esquema multi-tenant inicial
-- Empresas constructoras (organizations) + miembros con roles
-- =============================================================

-- Tabla de organizaciones (tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Miembros de una organización — vincula auth.users con orgs y roles
CREATE TABLE IF NOT EXISTS organization_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL,  -- auth.users.id del proveedor InsForge
  role            TEXT        NOT NULL CHECK (role IN ('admin', 'engineer', 'viewer')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

-- =============================================================
-- Row-Level Security (RLS) — aislamiento estricto multi-tenant
-- =============================================================

ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Un usuario sólo ve su propia organización
CREATE POLICY "org_select_own" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id
      FROM   organization_members
      WHERE  user_id = auth.uid()
    )
  );

-- Un usuario admin puede actualizar su organización
CREATE POLICY "org_update_admin" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id
      FROM   organization_members
      WHERE  user_id = auth.uid()
        AND  role    = 'admin'
    )
  );

-- Cada usuario ve sólo las membresías de su propia organización
CREATE POLICY "members_select_own_org" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id
      FROM   organization_members
      WHERE  user_id = auth.uid()
    )
  );

-- Sólo admins pueden invitar nuevos miembros
CREATE POLICY "members_insert_admin" ON organization_members
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM   organization_members
      WHERE  user_id = auth.uid()
        AND  role    = 'admin'
    )
  );

-- ============================================================
-- >> 002_files_and_sessions.sql
-- ============================================================
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

-- ============================================================
-- >> 003_hardening.sql
-- ============================================================
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

-- ============================================================
-- >> 004_new_tables.sql
-- ============================================================
-- =============================================================
-- Migración 004: Tablas nuevas — invitaciones y resultados de auditoría
-- =============================================================

-- ── Invitaciones a organizaciones ────────────────────────────────────────────
-- Permite que un admin invite a un usuario por email con un token de un solo uso.

CREATE TABLE IF NOT EXISTS organization_invitations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by      UUID        NOT NULL,   -- auth.users.id del admin que invita
  invited_email   TEXT        NOT NULL,
  role            TEXT        NOT NULL CHECK (role IN ('admin', 'engineer', 'viewer')),
  token           TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_org_id
  ON organization_invitations(organization_id);

CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON organization_invitations(token) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_invitations_email
  ON organization_invitations(invited_email) WHERE status = 'pending';

-- ── Resultados estructurados de auditoría ─────────────────────────────────────
-- Almacena el output procesado del agente IA para persistir y exportar hallazgos.
-- El campo `payload` JSONB permite flexibilidad de schema por tipo de auditoría.

CREATE TABLE IF NOT EXISTS audit_results (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  file_id         UUID        REFERENCES uploaded_files(id)          ON DELETE SET NULL,
  project_id      UUID        REFERENCES projects(id)                ON DELETE SET NULL,
  -- 'quantity_check' | 'budget_analysis' | 'conformance_check' | 'summary'
  result_type     TEXT        NOT NULL,
  payload         JSONB       NOT NULL DEFAULT '{}',
  created_by      UUID        NOT NULL,   -- auth.users.id
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_results_session_id
  ON audit_results(session_id);

CREATE INDEX IF NOT EXISTS idx_audit_results_org_id
  ON audit_results(organization_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_results_project_id
  ON audit_results(project_id) WHERE deleted_at IS NULL;

-- GIN index para consultas sobre el payload JSONB (ej. buscar por campo específico)
CREATE INDEX IF NOT EXISTS idx_audit_results_payload
  ON audit_results USING GIN (payload);

-- =============================================================
-- RLS
-- =============================================================

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_results            ENABLE ROW LEVEL SECURITY;

-- ORGANIZATION_INVITATIONS
-- Admins pueden ver y crear invitaciones de su org
CREATE POLICY "invitations_select_admin" ON organization_invitations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

CREATE POLICY "invitations_insert_admin" ON organization_invitations FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

-- Cualquier usuario autenticado puede leer su propia invitación por token
-- (usado en el flujo de aceptación de invitación — no requiere ser miembro aún)
CREATE POLICY "invitations_select_by_token" ON organization_invitations FOR SELECT
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
    AND expires_at > NOW()
  );

-- El invitado puede actualizar el status a 'accepted' (admin puede revocar)
CREATE POLICY "invitations_update_admin_or_invitee" ON organization_invitations FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    status IN ('accepted', 'revoked')
  );

-- AUDIT_RESULTS
CREATE POLICY "audit_results_select_org" ON audit_results FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "audit_results_insert_org" ON audit_results FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "audit_results_update_creator" ON audit_results FOR UPDATE
  USING (
    deleted_at IS NULL
    AND created_by = auth.uid()
  )
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "audit_results_delete_admin" ON audit_results FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

-- ============================================================
-- >> 005_fix_rls_recursion.sql
-- ============================================================
-- =============================================================
-- Migración 005: Fix infinite recursion en RLS de organization_members
-- =============================================================
-- El policy "members_select_own_org" se referenciaba a sí mismo:
-- SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
-- → dispara el mismo policy → recursión infinita.
--
-- Solución: un usuario puede ver las rows de organization_members donde él
-- es el user_id, O donde pertenece a la misma org (via función SECURITY DEFINER).

-- 1. Eliminar el policy recursivo
DROP POLICY IF EXISTS "members_select_own_org" ON organization_members;

-- 2. Función auxiliar SECURITY DEFINER: obtiene las orgs del usuario actual
--    sin triggear el RLS de organization_members (corre como postgres).
CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id
  FROM   organization_members
  WHERE  user_id = auth.uid()
$$;

-- 3. Nuevo policy: sin recursión
CREATE POLICY "members_select_own_org" ON organization_members
  FOR SELECT USING (
    organization_id IN (SELECT get_my_org_ids())
  );

-- 4. También hay que arreglar "org_select_own" por las mismas razones
DROP POLICY IF EXISTS "org_select_own" ON organizations;

CREATE POLICY "org_select_own" ON organizations
  FOR SELECT USING (
    id IN (SELECT get_my_org_ids())
  );

-- ============================================================
-- >> 006_agent_learning.sql
-- ============================================================
-- Migration 006: Company learning system + branding
-- Run this in the InsForge dashboard SQL editor.

-- ── 1. Patrones aprendidos por empresa ──────────────────────────────────────────
-- 1 row per (org, document_type, pattern_key). Updated on each upload.
CREATE TABLE IF NOT EXISTS company_learned_patterns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL CHECK (document_type IN ('excel', 'pdf', 'dxf', 'docx')),
  pattern_key     TEXT NOT NULL,
  pattern_value   JSONB NOT NULL DEFAULT '{}',
  confidence      FLOAT NOT NULL DEFAULT 1.0,
  sample_count    INT NOT NULL DEFAULT 1,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, document_type, pattern_key)
);

-- ── 2. Benchmarks anónimos cross-empresa ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS industry_benchmarks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type   TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('civil', 'electrical', 'architecture', 'general')),
  benchmark_key   TEXT NOT NULL,
  benchmark_value JSONB NOT NULL DEFAULT '{}',
  org_count       INT NOT NULL DEFAULT 1,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_type, category, benchmark_key)
);

-- ── 3. Branding columns on organizations ────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#6366f1';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url      TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS agent_name    TEXT DEFAULT 'EdificIA';

-- ── 4. Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patterns_org_type
  ON company_learned_patterns (organization_id, document_type);

-- ── 5. RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE company_learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_benchmarks      ENABLE ROW LEVEL SECURITY;

-- Members can read their own org's patterns
CREATE POLICY "patterns_select_own_org" ON company_learned_patterns
  FOR SELECT USING (
    organization_id IN (SELECT get_my_org_ids())
  );

-- Members can insert patterns for their own org
CREATE POLICY "patterns_insert_own_org" ON company_learned_patterns
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_my_org_ids())
  );

-- Members can update patterns for their own org
CREATE POLICY "patterns_update_own_org" ON company_learned_patterns
  FOR UPDATE USING (
    organization_id IN (SELECT get_my_org_ids())
  );

-- Benchmarks are public read-only
CREATE POLICY "benchmarks_select_all" ON industry_benchmarks
  FOR SELECT USING (true);

-- ============================================================
-- >> 007_document_chunks.sql
-- ============================================================
-- =============================================================
-- Migración 007: Base documental — tabla de chunks para text search fallback
-- =============================================================
-- Qdrant Cloud almacena los vectores. Esta tabla almacena el texto
-- de cada chunk + metadata, sirviendo como fallback de búsqueda
-- cuando no hay OPENAI_API_KEY configurada (ILIKE sobre chunk_text).
-- También sincroniza el qdrant_id para correlacionar resultados.

CREATE TABLE IF NOT EXISTS document_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_id         UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,
  file_name       TEXT NOT NULL,
  document_type   TEXT NOT NULL,  -- 'excel' | 'pdf' | 'dxf' | 'docx' | 'image'
  chunk_index     INT NOT NULL DEFAULT 0,
  chunk_text      TEXT NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  qdrant_id       TEXT,           -- UUID del vector en Qdrant (null si no hay embedding)
  generated_by    TEXT,           -- 'edificia' si fue generado por el agente
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chunks_select_own_org" ON document_chunks
  FOR SELECT USING (organization_id IN (SELECT get_my_org_ids()));

CREATE POLICY "chunks_insert_own_org" ON document_chunks
  FOR INSERT WITH CHECK (organization_id IN (SELECT get_my_org_ids()));

CREATE POLICY "chunks_delete_own_org" ON document_chunks
  FOR DELETE USING (organization_id IN (SELECT get_my_org_ids()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_chunks_org  ON document_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_file ON document_chunks(file_id);
-- Full-text search fallback (spanish stemming)
CREATE INDEX IF NOT EXISTS idx_document_chunks_fts
  ON document_chunks USING GIN(to_tsvector('spanish', chunk_text));

-- ============================================================
-- >> 008_project_scoped_docs.sql
-- ============================================================
-- =============================================================
-- Migración 008: project_id en document_chunks para búsqueda
--               contextual por obra (RAG project-scoped)
-- =============================================================

-- document_chunks ya tiene file_id → uploaded_files(project_id).
-- Denormalizamos project_id para evitar JOINs en cada búsqueda
-- y para filtrar directamente en Qdrant mediante payload filter.

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Index parcial (solo filas con proyecto — la mayoría de la base)
CREATE INDEX IF NOT EXISTS idx_document_chunks_project
  ON document_chunks(project_id) WHERE project_id IS NOT NULL;

-- Index compuesto para la búsqueda más común: org + proyecto
CREATE INDEX IF NOT EXISTS idx_document_chunks_org_project
  ON document_chunks(organization_id, project_id) WHERE project_id IS NOT NULL;

-- ============================================================
-- >> 009_project_phase_docs.sql
-- ============================================================
-- =============================================================
-- Migración 009: Cobertura documental por fase de obra
-- =============================================================
-- Almacena qué documentos existen por fase en cada proyecto.
-- Las definiciones de fases viven en src/lib/obra/phases.ts (TypeScript).
-- Esta tabla es la fuente de verdad de "estado de la obra".

CREATE TABLE IF NOT EXISTS project_phase_docs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phase_key       TEXT        NOT NULL,  -- 'fundaciones', 'estructura', etc.
  doc_type        TEXT        NOT NULL,  -- 'plano' | 'computo' | 'presupuesto' | 'memoria' | 'remito'
  file_id         UUID        REFERENCES uploaded_files(id) ON DELETE SET NULL,
  file_name       TEXT,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, phase_key, doc_type)  -- one entry per phase+doc combination
);

ALTER TABLE project_phase_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phase_docs_org" ON project_phase_docs
  FOR ALL USING (organization_id IN (SELECT get_my_org_ids()));

CREATE INDEX IF NOT EXISTS idx_phase_docs_project
  ON project_phase_docs(project_id);

CREATE INDEX IF NOT EXISTS idx_phase_docs_org_project
  ON project_phase_docs(organization_id, project_id);

-- ============================================================
-- >> 010_price_indices.sql
-- ============================================================
-- =============================================================
-- Migración 010: Sistema de índices de precio append-only
--
-- DISEÑO INTENCIONAL:
--   - NO hay DELETE policy  → ningún usuario puede borrar registros
--   - NO hay UPDATE policy  → ningún usuario puede modificar registros
--   - TODOS los miembros pueden INSERT → cualquier arquitecto sube una lista
--   - Super-admin puede marcar is_active=false SOLO vía service_role
--   - La "corrección" de un precio erróneo se hace agregando uno nuevo
--     con created_at más reciente — el sistema resuelve la precedencia
-- =============================================================

CREATE TABLE IF NOT EXISTS price_indices (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NULL = índice global (CAC / INDEC) visible a todas las orgs
  -- SET  = índice propio de esa empresa (company_list / company_learned)
  organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,

  -- Fuente del dato (determina precedencia en comparaciones)
  -- Precedencia: company_list > company_learned > CAC > INDEC
  source          TEXT        NOT NULL CHECK (source IN ('CAC', 'INDEC', 'company_list', 'company_learned')),

  -- Categoría de obra (alineada con OBRA_PHASES de phases.ts)
  category        TEXT        NOT NULL,
  -- Subcategoría opcional para mayor granularidad
  subcategory     TEXT,

  -- Descripción del ítem de referencia (ej: "Hormigón H-21", "Mano de obra yeso")
  description     TEXT,

  -- Unidad de medida del precio (m², ml, kg, hs, sac, un, gl)
  unit            TEXT,

  -- Valores de precio en ARS — el agente usa value_avg para comparar
  value_min       NUMERIC(14,2),
  value_max       NUMERIC(14,2),
  value_avg       NUMERIC(14,2) NOT NULL,

  currency        TEXT        NOT NULL DEFAULT 'ARS',

  -- Período al que corresponde el índice (mes y año de publicación/relevamiento)
  period_month    SMALLINT    CHECK (period_month BETWEEN 1 AND 12),
  period_year     SMALLINT    NOT NULL,

  -- Fecha de publicación del índice externo (para CAC/INDEC)
  published_at    TIMESTAMPTZ,

  -- Trazabilidad: quién cargó este dato
  uploaded_by     UUID,       -- auth.users.id
  source_file     TEXT,       -- nombre del archivo origen (para auditoría)
  notes           TEXT,

  -- Soft-flag para super-admin: marca una entrada como superada sin borrarla
  -- Solo modificable vía service_role, nunca por el agente ni usuarios regulares
  is_active       BOOLEAN     NOT NULL DEFAULT true,

  -- Inmutabilidad garantizada: ningún policy de UPDATE existe
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes para consultas frecuentes ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_price_indices_org_category
  ON price_indices (organization_id, category, period_year, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_price_indices_global
  ON price_indices (source, category, period_year, period_month DESC)
  WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_price_indices_active
  ON price_indices (organization_id, category, is_active)
  WHERE is_active = true;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE price_indices ENABLE ROW LEVEL SECURITY;

-- Todos los miembros pueden VER:
--   a) sus propios índices (organization_id = su org)
--   b) índices globales (organization_id IS NULL → CAC/INDEC)
CREATE POLICY "indices_select_own_or_global" ON price_indices
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_my_org_ids())
  );

-- TODOS los miembros de una org pueden INSERTAR índices para su org
-- (no solo admins — cualquier arquitecto puede subir una lista de precios)
CREATE POLICY "indices_insert_any_member" ON price_indices
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_my_org_ids())
  );

-- !! SIN DELETE POLICY — la ausencia de policy bloquea cualquier DELETE !!
-- !! SIN UPDATE POLICY — los registros son inmutables para usuarios regulares !!
-- El service_role de InsForge puede UPDATE is_active=false si es necesario,
-- pero eso se hace fuera de banda, nunca desde el agente ni la UI.

-- ============================================================
-- >> 011_chat_sessions.sql
-- ============================================================
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

-- ============================================================
-- >> 012_founder_invitations.sql
-- ============================================================
-- =============================================================
-- Migración 012: Invitaciones de fundadores de organización
-- Permite al equipo EdificIA pre-autorizar emails que crearán
-- una nueva empresa al registrarse (rol admin automático).
-- =============================================================

CREATE TABLE IF NOT EXISTS org_founder_invitations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        NOT NULL UNIQUE,
  company_name TEXT        NOT NULL,
  token        UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'revoked')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_founder_inv_email  ON org_founder_invitations (email);
CREATE INDEX IF NOT EXISTS idx_founder_inv_status ON org_founder_invitations (status);

-- ============================================================
-- >> 013_member_email.sql
-- ============================================================
-- =============================================================
-- Migración 013: email en organization_members
-- Almacena el email al momento de unirse para que los admins
-- puedan identificar miembros sin necesitar la API de auth.
-- =============================================================

ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_org_members_email
  ON organization_members (email)
  WHERE deleted_at IS NULL;

-- ============================================================
-- >> 014_project_metadata.sql
-- ============================================================
-- Add metadata columns to projects table (ActiveProjectCard feature)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status          TEXT    NOT NULL DEFAULT 'en_obra'
    CHECK (status IN ('en_obra', 'planificacion', 'finalizado', 'pausado')),
  ADD COLUMN IF NOT EXISTS code            TEXT,
  ADD COLUMN IF NOT EXISTS location        TEXT,
  ADD COLUMN IF NOT EXISTS contract_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;

-- Organizations: add storage quota and subscription columns
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS storage_quota_bytes  BIGINT NOT NULL DEFAULT 5368709120, -- 5 GB default
  ADD COLUMN IF NOT EXISTS subscription_status  TEXT   NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'trial', 'suspended', 'cancelled'));

-- ============================================================
-- >> 015_founder_invitation_org.sql
-- ============================================================
-- =============================================================
-- Migración 015: organization_id en org_founder_invitations
-- Permite crear la org inmediatamente al activar la empresa
-- desde el panel super-admin, sin esperar al registro.
-- =============================================================

ALTER TABLE org_founder_invitations
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- También agregar invite_token como alias de token para compatibilidad
-- (el código usa invite_token pero la migración 012 usa token)
ALTER TABLE org_founder_invitations
  ADD COLUMN IF NOT EXISTS invite_token TEXT;

CREATE INDEX IF NOT EXISTS idx_founder_inv_org ON org_founder_invitations (organization_id) WHERE organization_id IS NOT NULL;
