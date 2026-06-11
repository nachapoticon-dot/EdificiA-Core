-- Refresh tokens para la auth local (Fase 2 de la desconexión de InsForge).
-- El token es opaco (random); acá solo se guarda su hash SHA-256.
-- Rotación: cada refresh revoca el token usado y emite uno nuevo.

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON auth.refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON auth.refresh_tokens (expires_at);
