import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";

import { parseArgFloat, parseExcelBudget } from "../../src/lib/excel/parser.ts";

describe("excel parser", () => {
  it("parsea formatos numericos argentinos", () => {
    assert.equal(parseArgFloat("$32.500"), 32_500);
    assert.equal(parseArgFloat("1.234,56"), 1_234.56);
    assert.equal(parseArgFloat("1234,56"), 1_234.56);
    assert.equal(parseArgFloat("-"), 0);
  });

  it("extrae items y total declarado desde una planilla en memoria", () => {
    const rows = [
      ["Item", "Descripcion", "Unidad", "Cantidad", "Material", "Mano de obra", "Costo unidad", "Total item", "Total rubro"],
      ["A-001", "Hormigon", "m3", 2, 1000, 500, "", 3000, ""],
      ["SC-01", "Subcontrato pisos", "m2", 10, 0, 0, 200, 2000, ""],
      ["", "Costo directo", "", "", "", "", "", 5000, ""],
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Presupuesto");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

    const parsed = parseExcelBudget(buffer, "presupuesto.xlsx");

    assert.equal(parsed.sheetName, "Presupuesto");
    assert.equal(parsed.detectedTotal, 5000);
    assert.equal(parsed.items.length, 2);
    assert.deepEqual(parsed.items.map((i) => [i.code, i.quantity, i.unitPrice, i.totalPrice]), [
      ["A-001", 2, 1500, 3000],
      ["SC-01", 10, 200, 2000],
    ]);
    assert.equal(parsed.items[1].isSubcontracted, true);
  });
});
