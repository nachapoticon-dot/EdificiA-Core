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
