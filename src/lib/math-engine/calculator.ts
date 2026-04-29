import type { BudgetItem } from "./validators";

export interface LineTotal {
  code: string;
  computedTotal: number;
  declaredTotal: number;
  /** Declared − computed. Positive = declared too high, negative = too low. */
  delta: number;
}

/**
 * Calculates the expected total for a single budget line.
 * Business rule: lineTotal = quantity × unitPrice (rounded to 2 decimal places).
 */
export function calcularTotalLinea(item: BudgetItem): LineTotal {
  const computedTotal = round2(item.quantity * item.unitPrice);
  return {
    code: item.code,
    computedTotal,
    declaredTotal: item.totalPrice,
    delta: round2(item.totalPrice - computedTotal),
  };
}

/**
 * Sums all item totals to arrive at the project's direct cost.
 * Business rule: costoDirecto = Σ(quantity × unitPrice) for all items.
 */
export function calcularCostoDirecto(items: BudgetItem[]): number {
  return round2(
    items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0),
  );
}

/**
 * Returns the fractional incidence of a subgroup total relative to a grand total.
 * Useful for verifying that a category (e.g. subcontracts) is within expected range.
 */
export function calcularIncidencia(
  subgroupTotal: number,
  grandTotal: number,
): number {
  if (grandTotal === 0) return 0;
  return round2(subgroupTotal / grandTotal);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
