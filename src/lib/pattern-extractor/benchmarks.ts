import { getInsForgeAdminClient } from "@/lib/insforge/server";

interface BenchmarkRow {
  organization_id: string;
  pattern_key: string;
  pattern_value: unknown;
  sample_count: number;
}

interface PriceRange {
  min?: number;
  max?: number;
  avg?: number;
}

interface ColumnAliases {
  units?: string[];
  code_prefixes?: string[];
  code_prefix_set?: string[];
}

/**
 * Queries learned patterns from OTHER organizations (anonymized) to generate
 * format improvement suggestions for the current org.
 * Uses the admin client to bypass RLS — org IDs are never returned to the agent.
 */
export async function searchCrossCompanyPatterns(
  documentType: string,
  excludeOrgId: string,
  currentPatterns?: Record<string, unknown>,
): Promise<{
  found: boolean;
  orgCount: number;
  documentType: string;
  suggestions: string[];
  message?: string;
}> {
  const client = getInsForgeAdminClient();

  const result = await client.database
    .from("company_learned_patterns")
    .select("organization_id, pattern_key, pattern_value, sample_count")
    .eq("document_type", documentType)
    .neq("organization_id", excludeOrgId)
    .limit(200);

  const rows = (result.data ?? []) as BenchmarkRow[];

  if (rows.length === 0) {
    return {
      found: false,
      orgCount: 0,
      documentType,
      suggestions: [],
      message:
        "Aún no hay suficientes datos de otras empresas para comparar. EdificIA aprende con cada documento que se sube.",
    };
  }

  const orgIds = new Set(rows.map((r) => r.organization_id));
  const suggestions: string[] = [];

  if (documentType === "excel") {
    // ── Price range comparison ──────────────────────────────────────────────
    const priceRows = rows.filter((r) => r.pattern_key === "price_ranges");
    const sectorAvgs = priceRows
      .map((r) => (r.pattern_value as PriceRange)?.avg)
      .filter((v): v is number => typeof v === "number" && v > 0);

    if (sectorAvgs.length > 0) {
      const sectorAvg = sectorAvgs.reduce((s, v) => s + v, 0) / sectorAvgs.length;
      const currentAvg = (currentPatterns?.["price_ranges"] as PriceRange)?.avg;

      if (currentAvg && currentAvg > 0) {
        const pctDiff = ((currentAvg - sectorAvg) / sectorAvg) * 100;
        if (Math.abs(pctDiff) > 15) {
          suggestions.push(
            pctDiff > 0
              ? `Tus precios unitarios promedio ($${Math.round(currentAvg).toLocaleString("es-AR")}) son un ${Math.round(pctDiff)}% más altos que el promedio del sector ($${Math.round(sectorAvg).toLocaleString("es-AR")}). Verificar si reflejan inflación reciente o si hay rubros sobredimensionados.`
              : `Tus precios unitarios promedio ($${Math.round(currentAvg).toLocaleString("es-AR")}) son un ${Math.round(-pctDiff)}% más bajos que el promedio del sector ($${Math.round(sectorAvg).toLocaleString("es-AR")}). Puede indicar precios desactualizados o distorsión de mercado.`,
          );
        } else {
          suggestions.push(
            `Tus precios unitarios están dentro del rango esperado del sector (promedio sectorial: $${Math.round(sectorAvg).toLocaleString("es-AR")}).`,
          );
        }
      }
    }

    // ── Code prefix comparison ──────────────────────────────────────────────
    const prefixRows = rows.filter((r) => r.pattern_key === "column_aliases");
    const allSectorPrefixes = prefixRows.flatMap((r) => {
      const v = r.pattern_value as ColumnAliases;
      return v?.code_prefix_set ?? v?.code_prefixes ?? [];
    });
    const prefixFreq = new Map<string, number>();
    for (const p of allSectorPrefixes) {
      prefixFreq.set(p, (prefixFreq.get(p) ?? 0) + 1);
    }
    const commonSectorPrefixes = [...prefixFreq.entries()]
      .filter(([, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([prefix]) => prefix);

    if (commonSectorPrefixes.length > 0) {
      const currentPrefixes = new Set(
        ((currentPatterns?.["column_aliases"] as ColumnAliases)?.code_prefix_set ?? [])
      );
      const missing = commonSectorPrefixes.filter((p) => !currentPrefixes.has(p));
      if (missing.length > 0) {
        suggestions.push(
          `Rubros comunes en el sector que no aparecen en tu estructura: **${missing.join(", ")}**. Verificar si aplican a este proyecto.`,
        );
      }
    }

    // ── Markup items usage ──────────────────────────────────────────────────
    const markupRows = rows.filter((r) => r.pattern_key === "rubro_structure");
    const hasImprevistos = markupRows.some((r) => {
      const ms = r.pattern_value as { markup_items?: { description: string }[] };
      return ms?.markup_items?.some((m) =>
        m.description?.toLowerCase().includes("imprevisto"),
      );
    });
    const currentHasMarkup = (currentPatterns?.["markup_items"] as unknown[])?.length > 0;

    if (hasImprevistos && !currentHasMarkup) {
      suggestions.push(
        "La mayoría de empresas del sector incluyen un ítem de **Imprevistos** (típicamente 3–5% del costo directo). Tu presupuesto no lo tiene declarado.",
      );
    }
  }

  if (suggestions.length === 0) {
    suggestions.push("Tu formato es consistente con el estándar del sector. No se detectaron diferencias significativas.");
  }

  return {
    found: true,
    orgCount: orgIds.size,
    documentType,
    suggestions,
  };
}
