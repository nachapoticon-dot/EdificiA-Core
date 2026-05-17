-- =============================================================
-- Migración 009: Cobertura documental por fase de obra
-- =============================================================
-- Almacena qué documentos existen por fase en cada proyecto.
-- Las definiciones de fases viven en src/lib/obra/phases.ts (TypeScript).
-- Esta tabla es la fuente de verdad de "estado de la obra".

CREATE TABLE IF NOT EXISTS project_phase_docs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phase_key       TEXT        NOT NULL,  -- 'fundaciones', 'estructura', etc.
  doc_type        TEXT        NOT NULL,  -- 'plano' | 'computo' | 'presupuesto' | 'memoria' | 'remito'
  file_id         UUID        REFERENCES uploaded_files(id) ON DELETE SET NULL,
  file_name       TEXT,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, phase_key, doc_type)  -- one entry per phase+doc combination
);

ALTER TABLE project_phase_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phase_docs_org" ON project_phase_docs
  FOR ALL USING (organization_id IN (SELECT get_my_org_ids()));

CREATE INDEX IF NOT EXISTS idx_phase_docs_project
  ON project_phase_docs(project_id);

CREATE INDEX IF NOT EXISTS idx_phase_docs_org_project
  ON project_phase_docs(organization_id, project_id);
