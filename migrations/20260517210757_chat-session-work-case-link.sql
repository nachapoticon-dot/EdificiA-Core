-- =============================================================
-- Asociar chat_sessions a expedientes operativos (work_cases)
-- Backward-compatible: la columna es nullable y `chat_sessions` sigue
-- siendo el contenedor de la conversación. Las sesiones legacy quedan
-- con work_case_id = NULL hasta que se migren explícitamente.
-- =============================================================

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS work_case_id UUID
    REFERENCES work_cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_work_case
  ON chat_sessions(work_case_id)
  WHERE work_case_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_work_case
  ON chat_sessions(organization_id, work_case_id)
  WHERE work_case_id IS NOT NULL AND deleted_at IS NULL;
