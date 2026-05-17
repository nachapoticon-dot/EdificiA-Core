import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calcularCostoDirecto,
  calcularIncidencia,
  calcularIncidenciaDeSubgrupo,
  calcularTotalLinea,
  detectarExclusionesLogicas,
  validarCierreDeTotal,
} from "../../src/lib/math-engine/index.ts";

function item(overrides = {}) {
  return {
    code: "A-001",
    description: "Hormigon",
    unit: "m3",
    quantity: 2,
    unitPrice: 10_000,
    totalPrice: 20_000,
    isSubcontracted: false,
    hasInternalLabor: false,
    ...overrides,
  };
}

describe("math-engine calculator", () => {
  it("calcula total de linea con delta redondeado", () => {
    assert.deepEqual(calcularTotalLinea(item({ quantity: 3, unitPrice: 10.335, totalPrice: 31 })), {
      code: "A-001",
      computedTotal: 31.01,
      declaredTotal: 31,
      delta: -0.01,
    });
  });

  it("calcula costo directo e incidencia", () => {
    const items = [
      item({ code: "A", quantity: 2, unitPrice: 100, totalPrice: 200 }),
      item({ code: "B", quantity: 3, unitPrice: 50, totalPrice: 150 }),
    ];

    assert.equal(calcularCostoDirecto(items), 350);
    assert.equal(calcularIncidencia(70, 350), 0.2);
    assert.equal(calcularIncidencia(70, 0), 0);
  });
});

describe("math-engine auditor", () => {
  it("valida un presupuesto que cierra", () => {
    const items = [
      item({ code: "A", quantity: 2, unitPrice: 100, totalPrice: 200 }),
      item({ code: "B", quantity: 3, unitPrice: 50, totalPrice: 150 }),
    ];

    const result = validarCierreDeTotal(items, 350);

    assert.equal(result.ok, true);
    assert.equal(result.computedTotal, 350);
    assert.equal(result.absoluteDelta, 0);
    assert.deepEqual(result.lineErrors, []);
  });

  it("detecta diferencia total y lineas mal calculadas", () => {
    const items = [
      item({ code: "A", quantity: 2, unitPrice: 100, totalPrice: 250 }),
      item({ code: "B", quantity: 1, unitPrice: 100, totalPrice: 100 }),
    ];

    const result = validarCierreDeTotal(items, 400);

    assert.equal(result.ok, false);
    assert.equal(result.computedTotal, 300);
    assert.equal(result.absoluteDelta, 100);
    assert.deepEqual(result.lineErrors, [{ code: "A", delta: 50 }]);
  });

  it("calcula incidencia de subgrupo por codigos", () => {
    const items = [
      item({ code: "SC-01", quantity: 1, unitPrice: 300, totalPrice: 300 }),
      item({ code: "MAT-01", quantity: 1, unitPrice: 700, totalPrice: 700 }),
    ];

    assert.deepEqual(calcularIncidenciaDeSubgrupo(items, ["sc-01"], 1_000), {
      subgroupCodes: ["sc-01"],
      subgroupTotal: 300,
      grandTotal: 1_000,
      incidencePct: 30,
    });
  });

  it("detecta reglas criticas de exclusion logica", () => {
    const issues = detectarExclusionesLogicas([
      item({
        code: "SC-01",
        description: "Subcontrato con MO interna",
        isSubcontracted: true,
        hasInternalLabor: true,
      }),
      item({
        code: "Z-01",
        description: "Item sin precio",
        quantity: 4,
        unitPrice: 0,
        totalPrice: 0,
      }),
      item({
        code: "DUP",
        description: "Duplicado 1",
      }),
      item({
        code: "DUP",
        description: "Duplicado 2",
      }),
      item({
        code: "PCT",
        description: "Gastos generales",
        unit: "%",
        quantity: 10,
        unitPrice: 1_000,
        totalPrice: 10_000,
      }),
      item({
        code: "NEG",
        description: "Valor negativo",
        quantity: -1,
        unitPrice: 100,
        totalPrice: -100,
      }),
      item({
        code: "M2",
        description: "Precio redondo por area",
        unit: "m2",
        quantity: 1,
        unitPrice: 50_000,
        totalPrice: 50_000,
      }),
    ]);

    const ruleIds = new Set(issues.map((issue) => issue.ruleId));

    assert.equal(ruleIds.has("subcontract_labor_overlap"), true);
    assert.equal(ruleIds.has("unit_price_zero"), true);
    assert.equal(ruleIds.has("duplicate_codes"), true);
    assert.equal(ruleIds.has("percentage_item_quantity"), true);
    assert.equal(ruleIds.has("negative_values"), true);
    assert.equal(ruleIds.has("round_price_area"), true);
  });
});
