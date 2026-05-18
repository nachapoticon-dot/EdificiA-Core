-- =============================================================
-- Document intelligence reports
-- Read model documental para clasificación, extracción, riesgos y veredicto.
-- Complementa `uploaded_files`, `work_case_evidence` y `agent_runs`.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS document_intelligence_reports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  work_case_id    UUID        REFERENCES work_cases(id) ON DELETE SET NULL,
  file_id         UUID        NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  agent_run_id    UUID        REFERENCES agent_runs(id) ON DELETE SET NULL,
  report_type     TEXT        NOT NULL DEFAULT 'upload_scan'
                              CHECK (report_type IN (
                                'upload_scan',
                                'agent_audit',
                                'manual_review'
                              )),
  status          TEXT        NOT NULL DEFAULT 'ready'
                              CHECK (status IN (
                                'ready',
                                'needs_review',
                                'superseded',
                                'failed'
                              )),
  source          TEXT        NOT NULL DEFAULT 'system'
                              CHECK (source IN ('system', 'agent', 'user')),
  document_type   TEXT        NOT NULL,
  classification  JSONB       NOT NULL DEFAULT '{}',
  extraction      JSONB       NOT NULL DEFAULT '{}',
  risks           JSONB       NOT NULL DEFAULT '[]',
  findings        JSONB       NOT NULL DEFAULT '[]',
  verdict         TEXT        NOT NULL DEFAULT 'needs_review'
                              CHECK (verdict IN (
                                'consistent',
                                'inconsistent',
                                'needs_review',
                                'unsupported'
                              )),
  confidence      NUMERIC(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  summary         TEXT,
  created_by      UUID,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_document_intelligence_reports_org_created
  ON document_intelligence_reports(organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_intelligence_reports_org_project_created
  ON document_intelligence_reports(organization_id, project_id, created_at DESC)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_intelligence_reports_file_created
  ON document_intelligence_reports(file_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_intelligence_reports_work_case_created
  ON document_intelligence_reports(work_case_id, created_at DESC)
  WHERE deleted_at IS NULL AND work_case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_intelligence_reports_org_verdict
  ON document_intelligence_reports(organization_id, verdict, created_at DESC)
  WHERE deleted_at IS NULL;

-- Allow evidence rows to point directly at document intelligence reports.
ALTER TABLE work_case_evidence
  DROP CONSTRAINT IF EXISTS work_case_evidence_evidence_type_check;

ALTER TABLE work_case_evidence
  ADD CONSTRAINT work_case_evidence_evidence_type_check
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
    'document_report',
    'external'
  ));

ALTER TABLE document_intelligence_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_intelligence_reports_select_org" ON document_intelligence_reports;
CREATE POLICY "document_intelligence_reports_select_org" ON document_intelligence_reports FOR SELECT
  USING (deleted_at IS NULL AND organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "document_intelligence_reports_insert_editor" ON document_intelligence_reports;
CREATE POLICY "document_intelligence_reports_insert_editor" ON document_intelligence_reports FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'engineer') AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "document_intelligence_reports_update_editor" ON document_intelligence_reports;
CREATE POLICY "document_intelligence_reports_update_editor" ON document_intelligence_reports FOR UPDATE
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

DROP POLICY IF EXISTS "document_intelligence_reports_delete_admin" ON document_intelligence_reports;
CREATE POLICY "document_intelligence_reports_delete_admin" ON document_intelligence_reports FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "project_admin_policy" ON document_intelligence_reports;
CREATE POLICY "project_admin_policy" ON document_intelligence_reports FOR ALL TO project_admin
  USING (true)
  WITH CHECK (true);
