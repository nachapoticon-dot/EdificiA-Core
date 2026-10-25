import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { detectPhaseKey } from "@/lib/obra/phases";
import type { PriceIndexRow } from "./query";

export interface BudgetItemForComparison {
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  quantity: number;
}

type IndexRef = Pick<PriceIndexRow, "source" | "value_avg" | "period_year" | "period_month">;

export interface CategoryComparison {
  category: string;
  categoryLabel: string;
  itemCount: number;
  avgBudgetPrice: number;
  companyIndex: IndexRef | null;
  cacIndex: IndexRef | null;
  indecIndex: IndexRef | null;
  /** Desvío % del precio promedio contra la referencia más confiable disponible. */
  deviationPct: number | null;
  alert: "over" | "under" | "ok" | "no_data";
}

const DEVIATION_THRESHOLD_PCT = 15;

const CATEGORY_LABELS: Record<string, string> = {
  fundaciones: "Fundaciones",
  estructura: "Estructura",
  albanileria: "Albañilería",
  cubierta: "Cubierta",
  sanitaria: "Inst. Sanitaria",
  electrica: "Inst. Eléctrica",
  terminaciones: "Terminaciones",
  proyecto: "Proyecto General",
  presupuesto_general: "Presupuesto General",
  sin_clasificar: "Sin clasificar",
};

const ALERT_ORDER = { over: 0, under: 1, ok: 2, no_data: 3 } as const;

/**
 * Agrupa los ítems por rubro y compara el precio unitario promedio de cada
 * grupo contra el índice más reciente de cada fuente. La referencia es, en
 * orden: lista propia de la empresa, CAC, INDEC.
 */
export async function compareItemsWithIndices(
  items: BudgetItemForComparison[],
  organizationId: string,
): Promise<CategoryComparison[]> {
  const groups = new Map<string, BudgetItemForComparison[]>();
  for (const item of items) {
    const key = detectPhaseKey(`${item.code} ${item.description}`) ?? "sin_clasificar";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  if (groups.size === 0) return [];

  const result = await getInsForgeAdminClient()
    .database.from("price_indices")
    .select("category, source, value_avg, period_year, period_month")
    .eq("is_active", true)
    .in("category", [...groups.keys()])
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });

  // Filas ordenadas por período descendente: la primera por (rubro, fuente) es la vigente.
  const latest = new Map<string, IndexRef>();
  for (const row of (result.data ?? []) as (IndexRef & { category: string })[]) {
    const key = `${row.category}:${row.source}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  const ref = (category: string, source: string) => latest.get(`${category}:${source}`) ?? null;

  const comparisons = [...groups].map(([category, groupItems]): CategoryComparison => {
    const prices = groupItems.map((i) => i.unitPrice).filter((p) => p > 0);
    const avgBudgetPrice = prices.length > 0 ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;
    const companyIndex = ref(category, "company_list") ?? ref(category, "company_learned");
    const cacIndex = ref(category, "CAC");
    const indecIndex = ref(category, "INDEC");
    const reference = companyIndex ?? cacIndex ?? indecIndex;

    let deviationPct: number | null = null;
    let alert: CategoryComparison["alert"] = "no_data";
    if (reference && avgBudgetPrice > 0 && reference.value_avg > 0) {
      deviationPct = Math.round(((avgBudgetPrice - reference.value_avg) / reference.value_avg) * 100);
      alert = Math.abs(deviationPct) <= DEVIATION_THRESHOLD_PCT ? "ok" : deviationPct > 0 ? "over" : "under";
    }

    return {
      category,
      categoryLabel: CATEGORY_LABELS[category] ?? category,
      itemCount: groupItems.length,
      avgBudgetPrice,
      companyIndex,
      cacIndex,
      indecIndex,
      deviationPct,
      alert,
    };
  });

  return comparisons.sort((a, b) => ALERT_ORDER[a.alert] - ALERT_ORDER[b.alert]);
}
