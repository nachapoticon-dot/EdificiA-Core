-- M-04: token challenge for founder invitations
ALTER TABLE org_founder_invitations
  ADD COLUMN IF NOT EXISTS invite_token TEXT;

-- C-03: block direct user access to org_founder_invitations
ALTER TABLE org_founder_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON org_founder_invitations
  USING (false)
  WITH CHECK (false);

-- M-05: fix get_my_org_ids to exclude soft-deleted memberships
CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT organization_id
  FROM   organization_members
  WHERE  user_id = auth.uid()
    AND  deleted_at IS NULL;
$$;
