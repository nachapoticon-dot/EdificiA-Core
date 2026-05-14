-- Add metadata columns to projects table (ActiveProjectCard feature)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status          TEXT    NOT NULL DEFAULT 'en_obra'
    CHECK (status IN ('en_obra', 'planificacion', 'finalizado', 'pausado')),
  ADD COLUMN IF NOT EXISTS code            TEXT,
  ADD COLUMN IF NOT EXISTS location        TEXT,
  ADD COLUMN IF NOT EXISTS contract_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;

-- Organizations: add storage quota and subscription columns
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS storage_quota_bytes  BIGINT NOT NULL DEFAULT 5368709120, -- 5 GB default
  ADD COLUMN IF NOT EXISTS subscription_status  TEXT   NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'trial', 'suspended', 'cancelled'));
