-- =============================================================
-- Project operations schema
-- Cronograma, finanzas, subcontratos, HSE y acopios por obra.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- La migracion 20260513215703 agregaba el estado operativo, pero si
-- projects.status ya existia quedaba vigente el constraint legacy.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

UPDATE projects
SET status = CASE status
  WHEN 'active' THEN 'en_obra'
  WHEN 'archived' THEN 'pausado'
  WHEN 'deleted' THEN 'pausado'
  WHEN 'en_obra' THEN 'en_obra'
  WHEN 'planificacion' THEN 'planificacion'
  WHEN 'finalizado' THEN 'finalizado'
  WHEN 'pausado' THEN 'pausado'
  ELSE 'en_obra'
END;

ALTER TABLE projects
  ALTER COLUMN status SET DEFAULT 'en_obra',
  ADD CONSTRAINT projects_status_check
    CHECK (status IN ('en_obra', 'planificacion', 'finalizado', 'pausado'));

CREATE TABLE IF NOT EXISTS project_schedule_tasks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id          UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_code           TEXT,
  name                TEXT        NOT NULL,
  description         TEXT,
  status              TEXT        NOT NULL DEFAULT 'not_started'
                                      CHECK (status IN ('not_started', 'in_progress', 'blocked', 'done', 'cancelled')),
  start_date          DATE,
  due_date            DATE,
  completed_at        TIMESTAMPTZ,
  progress_pct        NUMERIC(5,2) NOT NULL DEFAULT 0
                                      CHECK (progress_pct >= 0 AND progress_pct <= 100),
  predecessor_task_id UUID        REFERENCES project_schedule_tasks(id) ON DELETE SET NULL,
  source_file_id      UUID        REFERENCES uploaded_files(id) ON DELETE SET NULL,
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS project_financial_snapshots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date     DATE        NOT NULL,
  planned_amount    NUMERIC(18,2),
  actual_amount     NUMERIC(18,2),
  committed_amount  NUMERIC(18,2),
  invoiced_amount   NUMERIC(18,2),
  paid_amount       NUMERIC(18,2),
  currency          TEXT        NOT NULL DEFAULT 'ARS',
  source            TEXT        NOT NULL DEFAULT 'manual'
                                CHECK (source IN ('manual', 'import', 'agent', 'integration')),
  source_file_id    UUID        REFERENCES uploaded_files(id) ON DELETE SET NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS project_subcontracts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_name       TEXT        NOT NULL,
  trade             TEXT,
  contract_amount   NUMERIC(18,2),
  currency          TEXT        NOT NULL DEFAULT 'ARS',
  status            TEXT        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'active', 'paused', 'completed', 'terminated')),
  start_date        DATE,
  end_date          DATE,
  retention_pct     NUMERIC(5,2) CHECK (retention_pct IS NULL OR (retention_pct >= 0 AND retention_pct <= 100)),
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  source_file_id    UUID        REFERENCES uploaded_files(id) ON DELETE SET NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS project_hse_records (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id          UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  subject_name        TEXT,
  worker_identifier   TEXT,
  subcontractor_name  TEXT,
  record_type         TEXT        NOT NULL
                                      CHECK (record_type IN ('art', 'epp', 'training', 'medical', 'incident', 'access')),
  status              TEXT        NOT NULL DEFAULT 'missing'
                                      CHECK (status IN ('valid', 'expiring', 'expired', 'missing', 'incident')),
  issued_at           DATE,
  expires_at          DATE,
  document_file_id    UUID        REFERENCES uploaded_files(id) ON DELETE SET NULL,
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS project_supply_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name         TEXT        NOT NULL,
  category          TEXT,
  unit              TEXT,
  required_quantity NUMERIC(18,4),
  ordered_quantity  NUMERIC(18,4),
  received_quantity NUMERIC(18,4),
  unit_cost         NUMERIC(18,2),
  currency          TEXT        NOT NULL DEFAULT 'ARS',
  supplier_name     TEXT,
  required_by       DATE,
  status            TEXT        NOT NULL DEFAULT 'planned'
                                CHECK (status IN ('planned', 'quoted', 'ordered', 'partial', 'received', 'delayed', 'cancelled')),
  source_file_id    UUID        REFERENCES uploaded_files(id) ON DELETE SET NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_schedule_tasks_org_project
  ON project_schedule_tasks(organization_id, project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_schedule_tasks_due
  ON project_schedule_tasks(organization_id, due_date)
  WHERE deleted_at IS NULL AND due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_schedule_tasks_status
  ON project_schedule_tasks(organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_financial_snapshots_org_project_date
  ON project_financial_snapshots(organization_id, project_id, snapshot_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_subcontracts_org_project
  ON project_subcontracts(organization_id, project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_subcontracts_status
  ON project_subcontracts(organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_hse_records_org_project
  ON project_hse_records(organization_id, project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_hse_records_expiry
  ON project_hse_records(organization_id, expires_at)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_hse_records_status
  ON project_hse_records(organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_supply_items_org_project
  ON project_supply_items(organization_id, project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_supply_items_required_by
  ON project_supply_items(organization_id, required_by)
  WHERE deleted_at IS NULL AND required_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_supply_items_status
  ON project_supply_items(organization_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE project_schedule_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_subcontracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_hse_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_supply_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_schedule_tasks_select_org" ON project_schedule_tasks;
CREATE POLICY "project_schedule_tasks_select_org" ON project_schedule_tasks FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "project_schedule_tasks_insert_editor" ON project_schedule_tasks;
CREATE POLICY "project_schedule_tasks_insert_editor" ON project_schedule_tasks FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_schedule_tasks_update_editor" ON project_schedule_tasks;
CREATE POLICY "project_schedule_tasks_update_editor" ON project_schedule_tasks FOR UPDATE
  USING (
    deleted_at IS NULL AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_schedule_tasks_delete_admin" ON project_schedule_tasks;
CREATE POLICY "project_schedule_tasks_delete_admin" ON project_schedule_tasks FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_financial_snapshots_select_org" ON project_financial_snapshots;
CREATE POLICY "project_financial_snapshots_select_org" ON project_financial_snapshots FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "project_financial_snapshots_insert_editor" ON project_financial_snapshots;
CREATE POLICY "project_financial_snapshots_insert_editor" ON project_financial_snapshots FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_financial_snapshots_update_editor" ON project_financial_snapshots;
CREATE POLICY "project_financial_snapshots_update_editor" ON project_financial_snapshots FOR UPDATE
  USING (
    deleted_at IS NULL AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_financial_snapshots_delete_admin" ON project_financial_snapshots;
CREATE POLICY "project_financial_snapshots_delete_admin" ON project_financial_snapshots FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_subcontracts_select_org" ON project_subcontracts;
CREATE POLICY "project_subcontracts_select_org" ON project_subcontracts FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "project_subcontracts_insert_editor" ON project_subcontracts;
CREATE POLICY "project_subcontracts_insert_editor" ON project_subcontracts FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_subcontracts_update_editor" ON project_subcontracts;
CREATE POLICY "project_subcontracts_update_editor" ON project_subcontracts FOR UPDATE
  USING (
    deleted_at IS NULL AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_subcontracts_delete_admin" ON project_subcontracts;
CREATE POLICY "project_subcontracts_delete_admin" ON project_subcontracts FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_hse_records_select_org" ON project_hse_records;
CREATE POLICY "project_hse_records_select_org" ON project_hse_records FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "project_hse_records_insert_editor" ON project_hse_records;
CREATE POLICY "project_hse_records_insert_editor" ON project_hse_records FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_hse_records_update_editor" ON project_hse_records;
CREATE POLICY "project_hse_records_update_editor" ON project_hse_records FOR UPDATE
  USING (
    deleted_at IS NULL AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_hse_records_delete_admin" ON project_hse_records;
CREATE POLICY "project_hse_records_delete_admin" ON project_hse_records FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_supply_items_select_org" ON project_supply_items;
CREATE POLICY "project_supply_items_select_org" ON project_supply_items FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "project_supply_items_insert_editor" ON project_supply_items;
CREATE POLICY "project_supply_items_insert_editor" ON project_supply_items FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_supply_items_update_editor" ON project_supply_items;
CREATE POLICY "project_supply_items_update_editor" ON project_supply_items FOR UPDATE
  USING (
    deleted_at IS NULL AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_supply_items_delete_admin" ON project_supply_items;
CREATE POLICY "project_supply_items_delete_admin" ON project_supply_items FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_admin_policy" ON project_schedule_tasks;
CREATE POLICY "project_admin_policy" ON project_schedule_tasks FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "project_admin_policy" ON project_financial_snapshots;
CREATE POLICY "project_admin_policy" ON project_financial_snapshots FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "project_admin_policy" ON project_subcontracts;
CREATE POLICY "project_admin_policy" ON project_subcontracts FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "project_admin_policy" ON project_hse_records;
CREATE POLICY "project_admin_policy" ON project_hse_records FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "project_admin_policy" ON project_supply_items;
CREATE POLICY "project_admin_policy" ON project_supply_items FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);
