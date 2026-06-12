import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import type { ProjectFinancialSnapshotSource } from "@/types";

interface SnapshotRow {
  id: string;
  snapshot_date: string;
  planned_amount: number | string | null;
  actual_amount: number | string | null;
  committed_amount: number | string | null;
  invoiced_amount: number | string | null;
  paid_amount: number | string | null;
  currency: string;
  source: ProjectFinancialSnapshotSource;
}

export interface CurveDataPoint {
  date: string;
  planned: number | null;
  actual: number | null;
  committed: number | null;
  invoiced: number | null;
  deviationPct: number | null;
}

export type CurveStatus = "sin_datos" | "alineado" | "observado" | "desviado_critico";

export interface FinancialCurveResult {
  found: boolean;
  projectId: string;
  snapshotCount: number;
  currency: string;
  status: CurveStatus;
  latest: {
    date: string;
    planned: number | null;
    actual: number | null;
    committed: number | null;
    invoiced: number | null;
    paid: number | null;
    deviationPct: number | null;
    overrunPct: number | null;
  } | null;
  progress: {
    actualVsPlannedPct: number | null;
    committedVsPlannedPct: number | null;
  };
  points: CurveDataPoint[];
  warnings: string[];
  summary: string;
}

export async function auditInvestmentCurve(input: {
  organizationId: string;
  projectId: string;
  limit?: number;
}): Promise<FinancialCurveResult> {
  const client = getInsForgeAdminClient();
  const limit = Math.min(Math.max(input.limit ?? 24, 2), 60);

  const result = await client.database
    .from("project_financial_snapshots")
    .select("id, snapshot_date, planned_amount, actual_amount, committed_amount, invoiced_amount, paid_amount, currency, source")
    .eq("organization_id", input.organizationId)
    .eq("project_id", input.projectId)
    .is("deleted_at", null)
    .order("snapshot_date", { ascending: true })
    .limit(limit);

  if (result.error) {
    dbLogger.warn({ err: result.error, projectId: input.projectId }, "audit_investment_curve query failed");
    throw new Error(result.error.message ?? "No se pudo consultar la curva financiera");
  }

  const rows = (result.data ?? []) as SnapshotRow[];
  if (rows.length === 0) {
    return {
      found: false,
      projectId: input.projectId,
      snapshotCount: 0,
      currency: "ARS",
      status: "sin_datos",
      latest: null,
      progress: { actualVsPlannedPct: null, committedVsPlannedPct: null },
      points: [],
      warnings: ["No hay snapshots financieros cargados para esta obra."],
      summary: "Sin curva financiera registrada — pedir al admin que cargue project_financial_snapshots.",
    };
  }

  const points: CurveDataPoint[] = rows.map((row) => {
    const planned = toNumber(row.planned_amount);
    const actual = toNumber(row.actual_amount);
    const committed = toNumber(row.committed_amount);
    const invoiced = toNumber(row.invoiced_amount);
    // Sin costo real cargado, el certificado es el proxy estándar de avance.
    const progressValue = actual ?? invoiced;
    const reference = Math.max(progressValue ?? 0, committed ?? 0);
    const deviationPct = planned && planned > 0 && (progressValue != null || committed != null)
      ? round2(((reference - planned) / planned) * 100)
      : null;
    return {
      date: row.snapshot_date.slice(0, 10),
      planned,
      actual,
      committed,
      invoiced,
      deviationPct,
    };
  });

  const latestRow = rows[rows.length - 1]!;
  const planned = toNumber(latestRow.planned_amount);
  const actual = toNumber(latestRow.actual_amount);
  const committed = toNumber(latestRow.committed_amount);
  const invoiced = toNumber(latestRow.invoiced_amount);
  const paid = toNumber(latestRow.paid_amount);

  const latestProgress = actual ?? invoiced;
  const actualVsPlannedPct = planned && planned > 0 && latestProgress != null ? round2((latestProgress / planned) * 100) : null;
  const committedVsPlannedPct = planned && planned > 0 && committed != null ? round2((committed / planned) * 100) : null;

  const referenceLatest = Math.max(latestProgress ?? 0, committed ?? 0);
  const deviationPct = planned && planned > 0 && (latestProgress != null || committed != null)
    ? round2(((referenceLatest - planned) / planned) * 100)
    : null;
  const overrunPct = deviationPct != null && deviationPct > 0 ? deviationPct : null;

  const warnings: string[] = [];
  const seenDates = new Set<string>();
  for (const row of rows) {
    const date = row.snapshot_date.slice(0, 10);
    if (seenDates.has(date)) warnings.push(`Hay más de un snapshot con fecha ${date}; revisar duplicados.`);
    seenDates.add(date);
  }
  if (planned == null) warnings.push("El último snapshot no tiene planned_amount, no es posible auditar el desvío.");

  // Serie inconsistente: algunas fechas con costo real y otras solo con certificado
  // (típico de registros que alternaron campo). El avance igual se computa con el
  // proxy, pero conviene normalizar la serie.
  const hasActualOnly = rows.some((r) => toNumber(r.actual_amount) != null && toNumber(r.invoiced_amount) == null);
  const hasInvoicedOnly = rows.some((r) => toNumber(r.actual_amount) == null && toNumber(r.invoiced_amount) != null);
  if (hasActualOnly && hasInvoicedOnly) {
    warnings.push("La serie mezcla snapshots con costo real (actual) y snapshots solo con certificado (invoiced); conviene unificar el campo de la serie para comparar períodos.");
  }

  let status: CurveStatus;
  if (deviationPct == null) status = "sin_datos";
  else if (deviationPct > 15) status = "desviado_critico";
  else if (Math.abs(deviationPct) > 8) status = "observado";
  else status = "alineado";

  const summary = (() => {
    if (status === "sin_datos") return "Curva con datos insuficientes para concluir desvío.";
    if (status === "alineado") return `Curva alineada al plan (desvío ${deviationPct ?? 0}%).`;
    if (status === "observado") return `Curva con desvío ${deviationPct}%; revisar causas antes de comprometer más obra.`;
    return `Curva fuera de plan: desvío ${deviationPct}% sobre lo planificado. Riesgo financiero crítico.`;
  })();

  return {
    found: true,
    projectId: input.projectId,
    snapshotCount: rows.length,
    currency: latestRow.currency,
    status,
    latest: {
      date: latestRow.snapshot_date.slice(0, 10),
      planned,
      actual,
      committed,
      invoiced,
      paid,
      deviationPct,
      overrunPct,
    },
    progress: { actualVsPlannedPct, committedVsPlannedPct },
    points,
    warnings,
    summary,
  };
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
