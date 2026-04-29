import type { BudgetItem } from "./validators";
import {
  calcularTotalLinea,
  calcularCostoDirecto,
  calcularIncidencia,
} from "./calculator";

export interface AuditTotalesResult {
  ok: boolean;
  declaredTotal: number;
  computedTotal: number;
  absoluteDelta: number;
  /** Delta expressed as % of declared total */
  relativeDeltaPct: number;
  /** Lines where |declared − computed| > $0.02 */
  lineErrors: Array<{ code: string; delta: number }>;
  summary: string;
}

export interface ExclusionLogica {
  code: string;
  description: string;
  issue: string;
}

export interface IncidenceResult {
  subgroupCodes: string[];
  subgroupTotal: number;
  grandTotal: number;
  incidencePct: number;
}

/**
 * Validates that the sum of item-level totals matches the declared grand total.
 * Catches rounding errors and miscalculated lines.
 *
 * @param tolerancePct  Maximum acceptable relative deviation (default 0.5 %)
 */
export function validarCierreDeTotal(
  items: BudgetItem[],
  declaredTotal: number,
  tolerancePct = 0.005,
): AuditTotalesResult {
  const lineTotals = items.map(calcularTotalLinea);
  const computedTotal = calcularCostoDirecto(items);
  const absoluteDelta = Math.abs(declaredTotal - computedTotal);
  const relativeDeltaPct =
    declaredTotal > 0 ? absoluteDelta / declaredTotal : 0;

  const lineErrors = lineTotals
    .filter((l) => Math.abs(l.delta) > 0.02)
    .map(({ code, delta }) => ({ code, delta }));

  const ok = relativeDeltaPct <= tolerancePct && lineErrors.length === 0;

  const summary = ok
    ? `✓ El presupuesto cierra correctamente. Costo directo calculado: $${computedTotal.toLocaleString("es-AR")}.`
    : `✗ Se detectaron ${lineErrors.length} línea(s) con error y una diferencia total de $${absoluteDelta.toFixed(2)} (${(relativeDeltaPct * 100).toFixed(2)}%).`;

  return {
    ok,
    declaredTotal,
    computedTotal,
    absoluteDelta,
    relativeDeltaPct: round2(relativeDeltaPct * 100),
    lineErrors,
    summary,
  };
}

/**
 * Detects structural logical errors in a budget.
 * Business rule: a fully subcontracted item must NOT declare internal labor (mano de obra),
 * because the subcontractor is responsible for all labor. If both flags are set, it
 * indicates a double-counting accounting error.
 */
export function detectarExclusionesLogicas(
  items: BudgetItem[],
): ExclusionLogica[] {
  return items
    .filter((item) => item.isSubcontracted && item.hasInternalLabor)
    .map((item) => ({
      code: item.code,
      description: item.description,
      issue:
        "Ítem subcontratado declara mano de obra interna — posible doble contabilización.",
    }));
}

/**
 * Calculates the incidence (%) of a named subgroup relative to the project's grand total.
 * Used to verify category weights (e.g., subcontracts represent X% of direct costs).
 */
export function calcularIncidenciaDeSubgrupo(
  items: BudgetItem[],
  subgroupCodes: string[],
  grandTotal: number,
): IncidenceResult {
  const codeSet = new Set(subgroupCodes.map((c) => c.toUpperCase()));
  const subgroupItems = items.filter((i) =>
    codeSet.has(i.code.toUpperCase()),
  );
  const subgroupTotal = calcularCostoDirecto(subgroupItems);

  return {
    subgroupCodes,
    subgroupTotal,
    grandTotal,
    incidencePct: round2(calcularIncidencia(subgroupTotal, grandTotal) * 100),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
