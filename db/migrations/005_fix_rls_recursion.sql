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
