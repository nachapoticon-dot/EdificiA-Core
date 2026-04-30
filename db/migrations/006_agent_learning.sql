-- Migration 006: Company learning system + branding
-- Run this in the InsForge dashboard SQL editor.

-- ── 1. Patrones aprendidos por empresa ──────────────────────────────────────────
-- 1 row per (org, document_type, pattern_key). Updated on each upload.
CREATE TABLE IF NOT EXISTS company_learned_patterns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL CHECK (document_type IN ('excel', 'pdf', 'dxf', 'docx')),
  pattern_key     TEXT NOT NULL,
  pattern_value   JSONB NOT NULL DEFAULT '{}',
  confidence      FLOAT NOT NULL DEFAULT 1.0,
  sample_count    INT NOT NULL DEFAULT 1,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, document_type, pattern_key)
);

-- ── 2. Benchmarks anónimos cross-empresa ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS industry_benchmarks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type   TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('civil', 'electrical', 'architecture', 'general')),
  benchmark_key   TEXT NOT NULL,
  benchmark_value JSONB NOT NULL DEFAULT '{}',
  org_count       INT NOT NULL DEFAULT 1,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_type, category, benchmark_key)
);

-- ── 3. Branding columns on organizations ────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#6366f1';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url      TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS agent_name    TEXT DEFAULT 'EdificIA';

-- ── 4. Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patterns_org_type
  ON company_learned_patterns (organization_id, document_type);

-- ── 5. RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE company_learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_benchmarks      ENABLE ROW LEVEL SECURITY;

-- Members can read their own org's patterns
CREATE POLICY "patterns_select_own_org" ON company_learned_patterns
  FOR SELECT USING (
    organization_id IN (SELECT get_my_org_ids())
  );

-- Members can insert patterns for their own org
CREATE POLICY "patterns_insert_own_org" ON company_learned_patterns
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_my_org_ids())
  );

-- Members can update patterns for their own org
CREATE POLICY "patterns_update_own_org" ON company_learned_patterns
  FOR UPDATE USING (
    organization_id IN (SELECT get_my_org_ids())
  );

-- Benchmarks are public read-only
CREATE POLICY "benchmarks_select_all" ON industry_benchmarks
  FOR SELECT USING (true);
