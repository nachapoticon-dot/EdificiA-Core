import { getActiveIndices, type ActiveIndex } from "./query";
import { detectPhaseKey } from "@/lib/obra/phases";

export interface BudgetItemForComparison {
  code:        string;
  description: string;
  unit:        string;
  unitPrice:   number;
  quantity:    number;
}

export interface CategoryComparison {
  category:         string;
  categoryLabel:    string;
  itemCount:        number;
  avgBudgetPrice:   number;
  /** Índice de la propia empresa (company_list o company_learned) */
  companyIndex:     ActiveIndex | null;
  /** Índice externo CAC */
  cacIndex:         ActiveIndex | null;
  /** Índice externo INDEC */
  indecIndex:       ActiveIndex | null;
  /** Desviación respecto al índice más confiable disponible */
  deviationPct:     number | null;
  /** Alerta cuando la desviación supera umbrales */
  alert:            "over" | "under" | "ok" | "no_data";
}

const CATEGORY_LABELS: Record<string, string> = {
  fundaciones:         "Fundaciones",
  estructura:          "Estructura",
  albanileria:         "Albañilería",
  cubierta:            "Cubierta",
  sanitaria:           "Inst. Sanitaria",
  electrica:           "Inst. Eléctrica",
  terminaciones:       "Terminaciones",
  proyecto:            "Proyecto General",
  presupuesto_general: "Presupuesto General",
  sin_clasificar:      "Sin clasificar",
};

/**
 * Groups budget items by obra phase category, then compares their avg price
 * against the three layers of indices (company > CAC > INDEC).
 *
 * Returns one CategoryComparison per detected category.
 */
export async function compareItemsWithIndices(
  items: BudgetItemForComparison[],
  organizationId: string,
): Promise<CategoryComparison[]> {
  // Step 1: group items by detected phase key
  const groups = new Map<string, BudgetItemForComparison[]>();
  for (const item of items) {
    const key = detectPhaseKey(item.code + " " + item.description) ?? "sin_clasificar";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  if (groups.size === 0) return [];

  // Step 2: fetch best active indices for each detected category
  const categories = [...groups.keys()];
  const activeMap = await getActiveIndices(organizationId, categories);

  // Also fetch per-source breakdown for the same categories
  const { getInsForgeAdminClient } = await import("@/lib/insforge/server");
  const client = getInsForgeAdminClient();
  const sourcesResult = await client.database
    .from("price_indices")
    .select("category, source, value_avg, value_min, value_max, unit, period_year, period_month, description, source_file, created_at")
    .eq("is_active", true)
    .in("category", categories)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .order("period_year",  { ascending: false })
    .order("period_month", { ascending: false });

  type SourceRow = { category: string; source: string; value_avg: number; value_min: number | null; value_max: number | null; unit: string | null; period_year: number; period_month: number | null; description: string | null; source_file: string | null; created_at: string };
  const sourceRows = (sourcesResult.data ?? []) as SourceRow[];

  // Build per-category, per-source best index
  const bySourceMap = new Map<string, Map<string, ActiveIndex>>();
  for (const row of sourceRows) {
    if (!bySourceMap.has(row.category)) bySourceMap.set(row.category, new Map());
    const srcMap = bySourceMap.get(row.category)!;
    if (!srcMap.has(row.source)) {
      srcMap.set(row.source, { ...row } as unknown as ActiveIndex);
    }
  }

  // Step 3: build comparison result
  const results: CategoryComparison[] = [];

  for (const [category, groupItems] of groups) {
    const prices = groupItems.map(i => i.unitPrice).filter(p => p > 0);
    const avgBudgetPrice = prices.length > 0
      ? prices.reduce((s, p) => s + p, 0) / prices.length
      : 0;

    const srcMap = bySourceMap.get(category);
    const companyIndex = srcMap?.get("company_list") ?? srcMap?.get("company_learned") ?? null;
    const cacIndex     = srcMap?.get("CAC") ?? null;
    const indecIndex   = srcMap?.get("INDEC") ?? null;

    // Reference = most reliable index available
    const reference = companyIndex ?? cacIndex ?? indecIndex ?? null;
    let deviationPct: number | null = null;
    let alert: CategoryComparison["alert"] = "no_data";

    if (reference && avgBudgetPrice > 0 && reference.value_avg > 0) {
      deviationPct = Math.round(((avgBudgetPrice - reference.value_avg) / reference.value_avg) * 100);
      if (Math.abs(deviationPct) <= 15)      alert = "ok";
      else if (deviationPct > 15)            alert = "over";
      else                                   alert = "under";
    }

    results.push({
      category,
      categoryLabel: CATEGORY_LABELS[category] ?? category,
      itemCount:       groupItems.length,
      avgBudgetPrice,
      companyIndex,
      cacIndex,
      indecIndex,
      deviationPct,
      alert,
    });
  }

  // Sort by deviation severity (most concerning first)
  results.sort((a, b) => {
    const order = { over: 0, under: 1, ok: 2, no_data: 3 };
    return order[a.alert] - order[b.alert];
  });

  return results;
}
