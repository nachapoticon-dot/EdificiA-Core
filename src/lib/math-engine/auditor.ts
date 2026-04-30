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

export interface AuditIssue {
  code: string;
  description: string;
  issue: string;
  severity: "error" | "warning" | "info";
  ruleId: string;
}

/** @deprecated use AuditIssue */
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
 * Comprehensive audit rule engine.
 * Runs all 9 rule checks and returns structured issues with severity levels.
 * Replaces the old single-rule detectarExclusionesLogicas.
 */
export function detectarExclusionesLogicas(items: BudgetItem[]): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // 1. Subcontracted + internal labor (original rule)
  for (const item of items) {
    if (item.isSubcontracted && item.hasInternalLabor) {
      issues.push({
        code: item.code,
        description: item.description,
        issue: "Ítem subcontratado declara mano de obra interna — posible doble contabilización.",
        severity: "error",
        ruleId: "subcontract_labor_overlap",
      });
    }
  }

  // 2. Unit price is zero but quantity > 0
  for (const item of items) {
    if (item.unitPrice === 0 && item.quantity > 0) {
      issues.push({
        code: item.code,
        description: item.description,
        issue: `Precio unitario = $0 con cantidad ${item.quantity} ${item.unit}. Posible omisión de precio.`,
        severity: "error",
        ruleId: "unit_price_zero",
      });
    }
  }

  // 3. Declared total doesn't match quantity × unit price (> 1% deviation)
  for (const item of items) {
    if (item.unitPrice > 0 && item.quantity > 0) {
      const computed = item.quantity * item.unitPrice;
      const declared = item.totalPrice;
      if (declared > 0) {
        const deviation = Math.abs(declared - computed) / declared;
        if (deviation > 0.01) {
          issues.push({
            code: item.code,
            description: item.description,
            issue: `Total declarado $${declared.toLocaleString("es-AR")} no coincide con q×pu = $${computed.toLocaleString("es-AR")} (desvío ${(deviation * 100).toFixed(1)}%).`,
            severity: "warning",
            ruleId: "total_mismatch",
          });
        }
      }
    }
  }

  // 4. Zero quantity with nonzero price
  for (const item of items) {
    if (item.quantity === 0 && item.unitPrice > 0) {
      issues.push({
        code: item.code,
        description: item.description,
        issue: `Cantidad = 0 pero precio unitario = $${item.unitPrice.toLocaleString("es-AR")}. El ítem no aporta al total.`,
        severity: "warning",
        ruleId: "zero_quantity_nonzero_price",
      });
    }
  }

  // 5. Duplicate codes
  const codeCounts = new Map<string, number>();
  for (const item of items) codeCounts.set(item.code, (codeCounts.get(item.code) ?? 0) + 1);
  for (const [code, count] of codeCounts.entries()) {
    if (count > 1) {
      const dup = items.find((i) => i.code === code)!;
      issues.push({
        code,
        description: dup.description,
        issue: `El código "${code}" aparece ${count} veces. Posible ítem duplicado.`,
        severity: "error",
        ruleId: "duplicate_codes",
      });
    }
  }

  // 6. Percentage item with quantity ≠ 1
  for (const item of items) {
    if ((item.unit === "%" || item.unit.toLowerCase() === "porcentaje") && item.quantity !== 1) {
      issues.push({
        code: item.code,
        description: item.description,
        issue: `Ítem en "%" tiene cantidad = ${item.quantity} (se esperaba 1). Revisar si el porcentaje ya está incluido en el precio.`,
        severity: "warning",
        ruleId: "percentage_item_quantity",
      });
    }
  }

  // 7. Negative values
  for (const item of items) {
    if (item.quantity < 0 || item.unitPrice < 0 || item.totalPrice < 0) {
      issues.push({
        code: item.code,
        description: item.description,
        issue: `Valores negativos detectados (cantidad=${item.quantity}, PU=$${item.unitPrice}, total=$${item.totalPrice}).`,
        severity: "error",
        ruleId: "negative_values",
      });
    }
  }

  // 8. Suspiciously round unit price in area units (suggests estimation)
  const areaUnits = new Set(["m2", "m²", "M2", "M²", "ha", "HA"]);
  for (const item of items) {
    if (areaUnits.has(item.unit) && item.unitPrice > 0 && item.unitPrice % 1000 === 0 && item.unitPrice >= 10000) {
      issues.push({
        code: item.code,
        description: item.description,
        issue: `Precio unitario exactamente redondo ($${item.unitPrice.toLocaleString("es-AR")} /m²) — puede ser una estimación. Verificar con cotización real.`,
        severity: "info",
        ruleId: "round_price_area",
      });
    }
  }

  // 9. Outlier unit price (> 3σ from mean within same unit)
  const pricesByUnit = new Map<string, number[]>();
  for (const item of items) {
    if (item.unitPrice > 0 && item.unit) {
      const group = pricesByUnit.get(item.unit) ?? [];
      group.push(item.unitPrice);
      pricesByUnit.set(item.unit, group);
    }
  }
  for (const item of items) {
    if (!item.unit || item.unitPrice === 0) continue;
    const group = pricesByUnit.get(item.unit) ?? [];
    if (group.length < 3) continue; // not enough data for stats
    const mean = group.reduce((s, v) => s + v, 0) / group.length;
    const variance = group.reduce((s, v) => s + (v - mean) ** 2, 0) / group.length;
    const sigma = Math.sqrt(variance);
    if (sigma > 0 && Math.abs(item.unitPrice - mean) > 3 * sigma) {
      issues.push({
        code: item.code,
        description: item.description,
        issue: `Precio unitario $${item.unitPrice.toLocaleString("es-AR")} es un outlier estadístico para la unidad "${item.unit}" (media $${Math.round(mean).toLocaleString("es-AR")}, 3σ=$${Math.round(3 * sigma).toLocaleString("es-AR")}). Posible error de tipeo.`,
        severity: "warning",
        ruleId: "outlier_unit_price",
      });
    }
  }

  return issues;
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
