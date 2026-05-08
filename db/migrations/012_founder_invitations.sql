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
