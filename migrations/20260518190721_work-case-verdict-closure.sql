-- =============================================================
-- Work case closure metadata
-- Permite registrar veredicto y actor que cierra/resuelve un expediente
-- antes del estado terminal. Complementa `work_cases.summary` y la
-- bitácora `work_case_events.work_case.status_changed`.
-- =============================================================

ALTER TABLE work_cases
  ADD COLUMN IF NOT EXISTS verdict TEXT;

ALTER TABLE work_cases
  DROP CONSTRAINT IF EXISTS work_cases_verdict_check;

ALTER TABLE work_cases
  ADD CONSTRAINT work_cases_verdict_check
  CHECK (verdict IS NULL OR verdict IN (
    'approved',
    'flagged',
    'inconclusive',
    'rejected',
    'superseded'
  ));

ALTER TABLE work_cases
  ADD COLUMN IF NOT EXISTS closed_by_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_work_cases_org_verdict
  ON work_cases(organization_id, verdict)
  WHERE deleted_at IS NULL AND verdict IS NOT NULL;
