import * as XLSX from "xlsx";
import type { BudgetItem } from "@/lib/math-engine/validators";

export interface ParsedBudget {
  fileName: string;
  sheetName: string;
  items: BudgetItem[];
  /** Detected grand total from the spreadsheet, if any */
  detectedTotal: number | null;
}

interface ColumnMap {
  code: number;
  description: number;
  unit: number;
  quantity: number;
  unitMatCost: number;
  unitMoCost: number;
  /** Combined unit total (mat + MO), used as fallback for unitPrice */
  unitTotal: number;
  /** Item-level total (quantity × unit total) */
  itemTotal: number;
  /** Rubro-level total for header rows */
  rubroTotal: number;
}

const HEADER_KEYWORDS: Record<keyof ColumnMap, string[]> = {
  code: ["item", "rubro", "cod", "código", "codigo"],
  description: ["descripcion", "descripción", "detalle", "trabajo"],
  unit: ["unidad", "unid", "ud"],
  quantity: ["cantidad", "cant"],
  unitMatCost: ["mat", "material", "materiales"],
  unitMoCost: ["mano", "mo", "labor"],
  unitTotal: ["costo unidad", "precio unit", "unit total", "p.unit"],
  itemTotal: ["total item", "total costos", "subtotal", "importe"],
  rubroTotal: ["total rubro", "costo rubro", "rubro total"],
};

export function parseExcelBudget(
  buffer: ArrayBuffer,
  fileName: string,
): ParsedBudget {
  const wb = XLSX.read(buffer, { type: "array", cellNF: true });
  const sheetName = wb.SheetNames[0] ?? "Sheet1";
  const ws = wb.Sheets[sheetName];

  if (!ws) {
    return { fileName, sheetName, items: [], detectedTotal: null };
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false, // Get formatted strings so we can handle "$32.500"
  });

  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true, // Also get raw numbers for numeric cells
  });

  // Find header row (first row containing at least 3 header keywords)
  const headerRowIdx = findHeaderRow(rows);

  if (headerRowIdx === -1) {
    // No header found — try fixed-column fallback
    return parseFixedColumns(rows, rawRows, fileName, sheetName);
  }

  const colMap = buildColumnMap(rows[headerRowIdx] ?? []);
  const items: BudgetItem[] = [];
  let detectedTotal: number | null = null;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rawRow = rawRows[i] ?? [];

    const code = getCellStr(row, colMap.code);
    const description = getCellStr(row, colMap.description);

    if (!code && !description) continue;

    // Detect "COSTO DIRECTO" total row
    const combinedText = `${code} ${description}`.toLowerCase();
    if (combinedText.includes("costo directo") || combinedText.includes("total general")) {
      const total = parseArgFloat(rawRow[colMap.itemTotal] ?? rawRow[colMap.rubroTotal]);
      if (total > 0) detectedTotal = total;
      continue;
    }

    const unit = getCellStr(row, colMap.unit);
    const quantity = parseArgFloat(rawRow[colMap.quantity]);
    const unitMat = parseArgFloat(rawRow[colMap.unitMatCost]);
    const unitMo = parseArgFloat(rawRow[colMap.unitMoCost]);

    // unitPrice: prefer mat+MO sum; fallback to unitTotal column
    const computedUnit = unitMat + unitMo;
    const unitPriceFromCol = parseArgFloat(rawRow[colMap.unitTotal] ?? row[colMap.unitTotal]);
    const unitPrice = computedUnit > 0 ? computedUnit : unitPriceFromCol;

    // totalPrice: prefer item-level column; fallback to rubro total for headers
    const itemTotalVal = parseArgFloat(rawRow[colMap.itemTotal] ?? row[colMap.itemTotal]);
    const rubroTotalVal = parseArgFloat(rawRow[colMap.rubroTotal] ?? row[colMap.rubroTotal]);
    const totalPrice = itemTotalVal > 0 ? itemTotalVal : rubroTotalVal;

    const isSubcontracted =
      /^sc/i.test(code.trim()) ||
      description.toLowerCase().includes("subcontrat");
    const hasInternalLabor = unitMo > 0 && !isSubcontracted;

    items.push({
      code: code || `row-${i}`,
      description,
      unit,
      quantity,
      unitPrice,
      totalPrice,
      isSubcontracted,
      hasInternalLabor,
    });
  }

  return { fileName, sheetName, items, detectedTotal };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] ?? [];
    const matchCount = row.filter((cell) => {
      const text = String(cell ?? "").toLowerCase().trim();
      return Object.values(HEADER_KEYWORDS)
        .flat()
        .some((kw) => text.includes(kw));
    }).length;
    if (matchCount >= 2) return i;
  }
  return -1;
}

function buildColumnMap(headerRow: unknown[]): ColumnMap {
  const find = (keywords: string[]): number => {
    for (let ci = 0; ci < headerRow.length; ci++) {
      const cell = String(headerRow[ci] ?? "").toLowerCase().trim();
      if (keywords.some((kw) => cell.includes(kw))) return ci;
    }
    return 0;
  };

  return {
    code: find(HEADER_KEYWORDS.code),
    description: find(HEADER_KEYWORDS.description),
    unit: find(HEADER_KEYWORDS.unit),
    quantity: find(HEADER_KEYWORDS.quantity),
    unitMatCost: find(HEADER_KEYWORDS.unitMatCost),
    unitMoCost: find(HEADER_KEYWORDS.unitMoCost),
    unitTotal: find(HEADER_KEYWORDS.unitTotal),
    itemTotal: find(HEADER_KEYWORDS.itemTotal),
    rubroTotal: find(HEADER_KEYWORDS.rubroTotal),
  };
}

/**
 * Fallback parser for sheets with no detectable header.
 * Assumes fixed Argentine construction budget layout:
 * Col0=code, Col1=description, Col2=unit, Col3=quantity, Col4=unitMat, Col5=unitMO, Col9=itemTotal
 */
function parseFixedColumns(
  rows: unknown[][],
  rawRows: unknown[][],
  fileName: string,
  sheetName: string,
): ParsedBudget {
  const items: BudgetItem[] = [];
  let detectedTotal: number | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rawRow = rawRows[i] ?? [];

    const code = getCellStr(row, 0);
    const description = getCellStr(row, 1);
    if (!code && !description) continue;

    const combinedText = `${code} ${description}`.toLowerCase();
    if (combinedText.includes("costo directo") || combinedText.includes("total general")) {
      detectedTotal = parseArgFloat(rawRow[9] ?? rawRow[10] ?? rawRow[8]);
      continue;
    }

    const unit = getCellStr(row, 2);
    const quantity = parseArgFloat(rawRow[3]);
    const unitMat = parseArgFloat(rawRow[4]);
    const unitMo = parseArgFloat(rawRow[5]);
    const unitPrice = unitMat + unitMo;
    const totalPrice = parseArgFloat(rawRow[9] ?? rawRow[10]);
    const isSubcontracted = /^sc/i.test(code.trim());
    const hasInternalLabor = unitMo > 0 && !isSubcontracted;

    items.push({
      code: code || `row-${i}`,
      description,
      unit,
      quantity,
      unitPrice,
      totalPrice,
      isSubcontracted,
      hasInternalLabor,
    });
  }

  return { fileName, sheetName, items, detectedTotal };
}

function getCellStr(row: unknown[], index: number): string {
  return String(row[index] ?? "").trim();
}

/**
 * Parses Argentine-formatted numbers to float.
 * Handles: '$32.500' → 32500, '1.234,56' → 1234.56, 150000 → 150000.
 * Ported from _referencias_legadas/core/utils.py::parse_float.
 */
export function parseArgFloat(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  let str = String(val).trim().replace(/\$/g, "").trim();
  if (!str || str === "-") return 0;

  const hasComma = str.includes(",");
  const hasDot = str.includes(".");

  if (hasComma && hasDot) {
    // European format: 1.234,56 → 1234.56
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Only comma → decimal separator: 1234,56 → 1234.56
    str = str.replace(",", ".");
  } else if (hasDot) {
    const parts = str.split(".");
    const lastPart = parts[parts.length - 1];
    // If exactly 3 digits after the last dot → thousands separator (Argentine)
    if (lastPart && lastPart.length === 3 && parts.length > 1) {
      str = str.replace(/\./g, "");
    }
    // Otherwise it's a decimal point — leave as-is
  }

  str = str.replace(/[^\d.-]/g, "");
  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
}
