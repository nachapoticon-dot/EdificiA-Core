-- =============================================================
-- Add missing columns to org_founder_invitations
-- The original schema uses "token" but the code expects "invite_token"
-- and "organization_id" for pre-creating the org.
-- =============================================================

-- Add organization_id column (nullable — old invitations won't have it)
ALTER TABLE org_founder_invitations
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Add invite_token column (code expects this name instead of "token")
ALTER TABLE org_founder_invitations
  ADD COLUMN IF NOT EXISTS invite_token TEXT;

-- Backfill invite_token from the existing "token" column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_founder_invitations' AND column_name = 'token'
  ) THEN
    UPDATE org_founder_invitations
    SET invite_token = token::text
    WHERE invite_token IS NULL;
  END IF;
END $$;

-- Drop the unique constraint on email to allow re-invitations
-- (the code revokes old invitations before creating new ones)
ALTER TABLE org_founder_invitations DROP CONSTRAINT IF EXISTS org_founder_invitations_email_key;

-- Index for org lookup
CREATE INDEX IF NOT EXISTS idx_founder_inv_org_id
  ON org_founder_invitations(organization_id);
