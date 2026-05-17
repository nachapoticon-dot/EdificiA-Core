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
