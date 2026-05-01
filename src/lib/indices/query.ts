import { getInsForgeAdminClient } from "@/lib/insforge/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriceIndexRow {
  id: string;
  organization_id: string | null;
  source: "CAC" | "INDEC" | "company_list" | "company_learned";
  category: string;
  subcategory: string | null;
  description: string | null;
  unit: string | null;
  value_min: number | null;
  value_max: number | null;
  value_avg: number;
  currency: string;
  period_month: number | null;
  period_year: number;
  published_at: string | null;
  uploaded_by: string | null;
  source_file: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

/** Source precedence — higher index wins */
const SOURCE_RANK: Record<string, number> = {
  company_list:    4,
  company_learned: 3,
  CAC:             2,
  INDEC:           1,
};

export interface ActiveIndex {
  category:    string;
  source:      string;
  value_avg:   number;
  value_min:   number | null;
  value_max:   number | null;
  unit:        string | null;
  period_year: number;
  period_month: number | null;
  description: string | null;
  source_file: string | null;
  created_at:  string;
}

/**
 * Returns the most relevant active index per category for a given org.
 * Precedence: company_list > company_learned > CAC > INDEC.
 * Within the same source, the most recent period wins.
 * Both org-specific and global (org_id IS NULL) indices are considered.
 */
export async function getActiveIndices(
  organizationId: string,
  categories?: string[],
): Promise<Map<string, ActiveIndex>> {
  const client = getInsForgeAdminClient();

  let query = client.database
    .from("price_indices")
    .select("*")
    .eq("is_active", true)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`);

  if (categories && categories.length > 0) {
    query = query.in("category", categories);
  }

  // Order by: source rank proxy (using period desc as tiebreaker within same source)
  query = query.order("period_year", { ascending: false })
               .order("period_month", { ascending: false })
               .order("created_at",   { ascending: false });

  const result = await query;
  const rows = (result.data ?? []) as PriceIndexRow[];

  // Resolve: pick best index per category
  const best = new Map<string, ActiveIndex>();

  for (const row of rows) {
    const existing = best.get(row.category);
    if (!existing) {
      best.set(row.category, toActiveIndex(row));
      continue;
    }

    const newRank = SOURCE_RANK[row.source] ?? 0;
    const oldRank = SOURCE_RANK[existing.source] ?? 0;

    if (newRank > oldRank) {
      best.set(row.category, toActiveIndex(row));
    } else if (newRank === oldRank) {
      // Same source — prefer more recent period
      if (
        row.period_year > existing.period_year ||
        (row.period_year === existing.period_year &&
          (row.period_month ?? 0) > (existing.period_month ?? 0))
      ) {
        best.set(row.category, toActiveIndex(row));
      }
    }
  }

  return best;
}

/**
 * Returns ALL active indices for an org grouped by category,
 * preserving all sources for display in the admin panel.
 */
export async function getAllIndicesByCategory(
  organizationId: string,
): Promise<PriceIndexRow[]> {
  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("price_indices")
    .select("*")
    .eq("is_active", true)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .order("category",     { ascending: true })
    .order("period_year",  { ascending: false })
    .order("period_month", { ascending: false })
    .order("created_at",   { ascending: false });

  return (result.data ?? []) as PriceIndexRow[];
}

/**
 * Batch-inserts price index rows.
 * Returns the count of inserted rows.
 */
export async function insertPriceIndices(
  rows: Omit<PriceIndexRow, "id" | "created_at">[],
): Promise<number> {
  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("price_indices")
    .insert(rows)
    .select("id");

  if (result.error) throw result.error;
  return (result.data ?? []).length;
}

function toActiveIndex(row: PriceIndexRow): ActiveIndex {
  return {
    category:     row.category,
    source:       row.source,
    value_avg:    row.value_avg,
    value_min:    row.value_min,
    value_max:    row.value_max,
    unit:         row.unit,
    period_year:  row.period_year,
    period_month: row.period_month,
    description:  row.description,
    source_file:  row.source_file,
    created_at:   row.created_at,
  };
}
