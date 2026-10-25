import { getInsForgeAdminClient } from "@/lib/insforge/server";

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

/** Índices activos de la organización y globales, ordenados por categoría y período. */
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

/** Inserta filas de índices (append-only) y devuelve cuántas se insertaron. */
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
