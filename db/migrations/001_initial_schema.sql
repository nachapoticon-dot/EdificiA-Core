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
