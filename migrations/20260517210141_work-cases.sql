-- =============================================================
-- Expedientes Operativos (Agent Core)
-- Modelo Empresa -> Obra -> Expediente Operativo -> Eventos/Evidencias.
-- Ver `docs/08_agent_core_redesign.md` y ROADMAP §2.6.
-- Este bloque introduce el schema sin tocar UX, prompt ni `chat_sessions`.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------
-- work_cases: expediente operativo por obra/empresa.
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_cases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  kind            TEXT        NOT NULL
                              CHECK (kind IN (
                                'budget_audit',
                                'document_audit',
                                'schedule_review',
                                'financial_review',
                                'hse_review',
                                'supplies_review',
                                'subcontract_review',
                                'daily_brief',
                                'operations_update',
                                'communication',
                                'general',
                                'legacy_conversation'
                              )),
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN (
                                'open',
                                'in_progress',
                                'waiting',
                                'resolved',
                                'closed',
                                'archived'
                              )),
  title           TEXT        NOT NULL,
  summary         TEXT,
  owner_user_id   UUID,
  closed_at       TIMESTAMPTZ,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_work_cases_org_created
  ON work_cases(organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_cases_org_project
  ON work_cases(organization_id, project_id)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_cases_org_status
  ON work_cases(organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_cases_org_kind
  ON work_cases(organization_id, kind)
  WHERE deleted_at IS NULL;

-- -------------------------------------------------------------
-- work_case_events: bitácora del expediente.
-- event_type queda libre (TEXT) para acompañar la evolución del agente.
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_case_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_case_id    UUID        NOT NULL REFERENCES work_cases(id) ON DELETE CASCADE,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  actor_user_id   UUID,
  event_type      TEXT        NOT NULL,
  summary         TEXT,
  payload         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_case_events_case_created
  ON work_case_events(work_case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_case_events_org_created
  ON work_case_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_case_events_org_project_created
  ON work_case_events(organization_id, project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_case_events_type
  ON work_case_events(organization_id, event_type, created_at DESC);

-- -------------------------------------------------------------
-- work_case_evidence: vínculos a archivos, chunks, relaciones, etc.
-- entity_type/entity_id se mantienen flexibles para apuntar a distintos
-- objetos (uploaded_files, document_chunks, obra_relations, audit_log_events,
-- project_schedule_tasks, project_hse_records, project_supply_items, ...).
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_case_evidence (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_case_id    UUID        NOT NULL REFERENCES work_cases(id) ON DELETE CASCADE,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  evidence_type   TEXT        NOT NULL
                              CHECK (evidence_type IN (
                                'file',
                                'chunk',
                                'relation',
                                'audit_event',
                                'tool_run',
                                'finding',
                                'message',
                                'schedule_task',
                                'hse_record',
                                'supply_item',
                                'financial_snapshot',
                                'subcontract',
                                'external'
                              )),
  entity_type     TEXT        NOT NULL,
  entity_id       UUID,
  label           TEXT,
  confidence      NUMERIC(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_case_evidence_case_created
  ON work_case_evidence(work_case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_case_evidence_org_created
  ON work_case_evidence(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_case_evidence_org_project
  ON work_case_evidence(organization_id, project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_case_evidence_entity
  ON work_case_evidence(entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_case_evidence_type
  ON work_case_evidence(organization_id, evidence_type);

-- -------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------

ALTER TABLE work_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_case_evidence ENABLE ROW LEVEL SECURITY;

-- work_cases
DROP POLICY IF EXISTS "work_cases_select_org" ON work_cases;
CREATE POLICY "work_cases_select_org" ON work_cases FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "work_cases_insert_editor" ON work_cases;
CREATE POLICY "work_cases_insert_editor" ON work_cases FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "work_cases_update_editor" ON work_cases;
CREATE POLICY "work_cases_update_editor" ON work_cases FOR UPDATE
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

DROP POLICY IF EXISTS "work_cases_delete_admin" ON work_cases;
CREATE POLICY "work_cases_delete_admin" ON work_cases FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_admin_policy" ON work_cases;
CREATE POLICY "project_admin_policy" ON work_cases FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);

-- work_case_events (append-only desde el agente; sin UPDATE/DELETE para
-- miembros: la bitácora se preserva. Solo admin puede borrar si fuera
-- estrictamente necesario.)
DROP POLICY IF EXISTS "work_case_events_select_org" ON work_case_events;
CREATE POLICY "work_case_events_select_org" ON work_case_events FOR SELECT
  USING (organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "work_case_events_insert_editor" ON work_case_events;
CREATE POLICY "work_case_events_insert_editor" ON work_case_events FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "work_case_events_delete_admin" ON work_case_events;
CREATE POLICY "work_case_events_delete_admin" ON work_case_events FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_admin_policy" ON work_case_events;
CREATE POLICY "project_admin_policy" ON work_case_events FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);

-- work_case_evidence
DROP POLICY IF EXISTS "work_case_evidence_select_org" ON work_case_evidence;
CREATE POLICY "work_case_evidence_select_org" ON work_case_evidence FOR SELECT
  USING (organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "work_case_evidence_insert_editor" ON work_case_evidence;
CREATE POLICY "work_case_evidence_insert_editor" ON work_case_evidence FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "work_case_evidence_delete_admin" ON work_case_evidence;
CREATE POLICY "work_case_evidence_delete_admin" ON work_case_evidence FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_admin_policy" ON work_case_evidence;
CREATE POLICY "project_admin_policy" ON work_case_evidence FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);
