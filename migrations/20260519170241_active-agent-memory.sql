-- Allow agent/session learning namespaces in the existing learned-patterns table.
-- The original CHECK only accepted uploaded document types; runtime code already
-- uses audit_history and the active memory tool writes agent_memory.
ALTER TABLE company_learned_patterns
  DROP CONSTRAINT IF EXISTS company_learned_patterns_document_type_check;

ALTER TABLE company_learned_patterns
  ADD CONSTRAINT company_learned_patterns_document_type_check
  CHECK (document_type IN ('excel', 'pdf', 'dxf', 'docx', 'audit_history', 'agent_memory'));

CREATE INDEX IF NOT EXISTS idx_patterns_active_agent_memory
  ON company_learned_patterns (organization_id, updated_at DESC)
  WHERE document_type = 'agent_memory';
