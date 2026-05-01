-- =============================================================
-- Migración 010: Sistema de índices de precio append-only
--
-- DISEÑO INTENCIONAL:
--   - NO hay DELETE policy  → ningún usuario puede borrar registros
--   - NO hay UPDATE policy  → ningún usuario puede modificar registros
--   - TODOS los miembros pueden INSERT → cualquier arquitecto sube una lista
--   - Super-admin puede marcar is_active=false SOLO vía service_role
--   - La "corrección" de un precio erróneo se hace agregando uno nuevo
--     con created_at más reciente — el sistema resuelve la precedencia
-- =============================================================

CREATE TABLE IF NOT EXISTS price_indices (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NULL = índice global (CAC / INDEC) visible a todas las orgs
  -- SET  = índice propio de esa empresa (company_list / company_learned)
  organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,

  -- Fuente del dato (determina precedencia en comparaciones)
  -- Precedencia: company_list > company_learned > CAC > INDEC
  source          TEXT        NOT NULL CHECK (source IN ('CAC', 'INDEC', 'company_list', 'company_learned')),

  -- Categoría de obra (alineada con OBRA_PHASES de phases.ts)
  category        TEXT        NOT NULL,
  -- Subcategoría opcional para mayor granularidad
  subcategory     TEXT,

  -- Descripción del ítem de referencia (ej: "Hormigón H-21", "Mano de obra yeso")
  description     TEXT,

  -- Unidad de medida del precio (m², ml, kg, hs, sac, un, gl)
  unit            TEXT,

  -- Valores de precio en ARS — el agente usa value_avg para comparar
  value_min       NUMERIC(14,2),
  value_max       NUMERIC(14,2),
  value_avg       NUMERIC(14,2) NOT NULL,

  currency        TEXT        NOT NULL DEFAULT 'ARS',

  -- Período al que corresponde el índice (mes y año de publicación/relevamiento)
  period_month    SMALLINT    CHECK (period_month BETWEEN 1 AND 12),
  period_year     SMALLINT    NOT NULL,

  -- Fecha de publicación del índice externo (para CAC/INDEC)
  published_at    TIMESTAMPTZ,

  -- Trazabilidad: quién cargó este dato
  uploaded_by     UUID,       -- auth.users.id
  source_file     TEXT,       -- nombre del archivo origen (para auditoría)
  notes           TEXT,

  -- Soft-flag para super-admin: marca una entrada como superada sin borrarla
  -- Solo modificable vía service_role, nunca por el agente ni usuarios regulares
  is_active       BOOLEAN     NOT NULL DEFAULT true,

  -- Inmutabilidad garantizada: ningún policy de UPDATE existe
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes para consultas frecuentes ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_price_indices_org_category
  ON price_indices (organization_id, category, period_year, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_price_indices_global
  ON price_indices (source, category, period_year, period_month DESC)
  WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_price_indices_active
  ON price_indices (organization_id, category, is_active)
  WHERE is_active = true;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE price_indices ENABLE ROW LEVEL SECURITY;

-- Todos los miembros pueden VER:
--   a) sus propios índices (organization_id = su org)
--   b) índices globales (organization_id IS NULL → CAC/INDEC)
CREATE POLICY "indices_select_own_or_global" ON price_indices
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id IN (SELECT get_my_org_ids())
  );

-- TODOS los miembros de una org pueden INSERTAR índices para su org
-- (no solo admins — cualquier arquitecto puede subir una lista de precios)
CREATE POLICY "indices_insert_any_member" ON price_indices
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_my_org_ids())
  );

-- !! SIN DELETE POLICY — la ausencia de policy bloquea cualquier DELETE !!
-- !! SIN UPDATE POLICY — los registros son inmutables para usuarios regulares !!
-- El service_role de InsForge puede UPDATE is_active=false si es necesario,
-- pero eso se hace fuera de banda, nunca desde el agente ni la UI.
