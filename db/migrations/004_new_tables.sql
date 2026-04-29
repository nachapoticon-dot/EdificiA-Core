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
