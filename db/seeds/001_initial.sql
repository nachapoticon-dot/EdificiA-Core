-- =============================================================
-- Seed 001: Configuración inicial de EdificIA
-- Ejecutar en InsForge Database Studio → SQL Editor
-- =============================================================

-- ── Migración 013: email en organization_members ─────────────
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_org_members_email
  ON organization_members (email);

-- ── Invitación del fundador principal ────────────────────────
-- Reemplazá 'tu@email.com' con tu email real.
-- Después de esto, andá a /register y usá ese email.
INSERT INTO org_founder_invitations (email, company_name, status, notes, expires_at)
VALUES (
  'pedroluisfuentesprieto@gmail.com',
  'EdificIA',
  'pending',
  'Cuenta fundador principal',
  NOW() + INTERVAL '365 days'
)
ON CONFLICT (email) DO UPDATE
  SET status = 'pending',
      expires_at = NOW() + INTERVAL '365 days';

-- ── Verificar que quedó bien ──────────────────────────────────
SELECT email, company_name, status, expires_at
FROM org_founder_invitations
ORDER BY created_at DESC
LIMIT 5;
