-- Bootstrap para Postgres local autosuficiente (sin InsForge).
-- Recrea las piezas que la plataforma InsForge proveía implícitamente:
-- extensiones, roles, schema auth, auth.uid() y la tabla de usuarios.
-- Debe correr antes que el baseline y que toda migración de la app.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Roles shim: las policies RLS existentes los nombran (TO project_admin, etc.).
-- El backend conecta como owner y los bypassea; quedan como defensa en profundidad.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'project_admin') THEN
    CREATE ROLE project_admin NOLOGIN;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

-- En InsForge auth.uid() devolvía el sub del JWT de la request.
-- Localmente lee la GUC request.jwt.claim.sub (NULL si no está seteada,
-- que es el caso del backend admin: las queries ya filtran por organization_id).
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Tabla canónica de usuarios (reemplaza la auth.users gestionada por InsForge).
-- Los ids se preservan al importar desde InsForge para no romper
-- organization_members.user_id y demás referencias.
-- password_hash NULL = usuario importado sin credencial local (flujo reset password).
CREATE TABLE IF NOT EXISTS auth.users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT      NOT NULL UNIQUE,
  name          TEXT,
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
