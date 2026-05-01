import * as XLSX from "xlsx";
import { detectPhaseKey } from "@/lib/obra/phases";
import type { PriceIndexRow } from "./query";

export interface ParsedPriceRow {
  category:    string;
  subcategory: string | null;
  description: string;
  unit:        string | null;
  value_avg:   number;
  value_min:   number | null;
  value_max:   number | null;
}

export interface ParseResult {
  rows:     ParsedPriceRow[];
  warnings: string[];
  /** Period detected from file name or content (defaults to current month/year) */
  period_year:  number;
  period_month: number;
}

// ── Header synonyms ───────────────────────────────────────────────────────────
// Flexible column detection: the parser looks for any of these aliases.

const DESCRIPTION_ALIASES = ["descripcion", "descripción", "item", "ítem", "material", "concepto", "detalle", "rubro"];
const UNIT_ALIASES         = ["unidad", "un", "uni", "und", "unid", "medida", "unit"];
const PRICE_ALIASES        = ["precio", "valor", "importe", "costo", "monto", "p.unitario", "precio unitario", "p. unit", "neto"];
const MIN_ALIASES          = ["min", "minimo", "mínimo", "precio min", "desde"];
const MAX_ALIASES          = ["max", "maximo", "máximo", "precio max", "hasta"];
const CATEGORY_ALIASES     = ["categoria", "categoría", "rubro", "capitulo", "capítulo", "fase", "grupo"];

function normalize(s: string): string {
  return s.toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function findCol(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normalize(headers[i] ?? "");
    if (aliases.some(a => h.includes(a))) return i;
  }
  return -1;
}

/**
 * Parses an Excel/CSV buffer containing a distributor price list.
 * Flexible column detection — works with most Argentine price list formats.
 */
export function parsePriceListBuffer(
  buffer: Buffer,
  fileName: string,
): ParseResult {
  const warnings: string[] = [];
  const now = new Date();
  let period_year  = now.getFullYear();
  let period_month = now.getMonth() + 1;

  // Try to detect period from file name (e.g. "lista_precios_04_2026.xlsx")
  const periodMatch = fileName.match(/(\d{1,2})[_\-\/](\d{4})/);
  if (periodMatch) {
    const m = parseInt(periodMatch[1]!, 10);
    const y = parseInt(periodMatch[2]!, 10);
    if (m >= 1 && m <= 12 && y >= 2020) {
      period_month = m;
      period_year  = y;
    }
  }

  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], warnings: ["El archivo no contiene hojas."], period_year, period_month };
  }

  const ws = wb.Sheets[sheetName]!;
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
  if (raw.length < 2) {
    return { rows: [], warnings: ["El archivo tiene menos de 2 filas."], period_year, period_month };
  }

  // Find header row (first row with >= 2 non-empty cells)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const nonEmpty = (raw[i] ?? []).filter(c => c?.toString().trim()).length;
    if (nonEmpty >= 2) { headerRowIdx = i; break; }
  }

  const headers = (raw[headerRowIdx] ?? []).map(c => c?.toString() ?? "");

  const colDesc     = findCol(headers, DESCRIPTION_ALIASES);
  const colUnit     = findCol(headers, UNIT_ALIASES);
  const colPrice    = findCol(headers, PRICE_ALIASES);
  const colMin      = findCol(headers, MIN_ALIASES);
  const colMax      = findCol(headers, MAX_ALIASES);
  const colCategory = findCol(headers, CATEGORY_ALIASES);

  if (colDesc === -1 && colPrice === -1) {
    warnings.push(
      "No se detectaron columnas de descripción ni precio. " +
      "Asegurate de que el archivo tenga encabezados como: Descripción, Precio, Unidad."
    );
    return { rows: [], warnings, period_year, period_month };
  }

  if (colPrice === -1) {
    warnings.push("No se encontró columna de precio — no se pueden extraer índices.");
    return { rows: [], warnings, period_year, period_month };
  }

  const rows: ParsedPriceRow[] = [];
  let lastCategory = "sin_clasificar";

  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    const rawPrice = parseFloat(String(row[colPrice] ?? "").replace(/[$.,%\s]/g, ""));
    if (!isFinite(rawPrice) || rawPrice <= 0) continue;

    const rawDesc = colDesc >= 0 ? String(row[colDesc] ?? "").trim() : "";
    if (!rawDesc && colDesc >= 0) continue;  // skip empty description rows

    // Category: explicit column or detect from description
    let category = lastCategory;
    if (colCategory >= 0) {
      const rawCat = String(row[colCategory] ?? "").trim();
      if (rawCat) {
        category = detectPhaseKey(rawCat) ?? normalize(rawCat).replace(/\s+/g, "_");
        lastCategory = category;
      }
    } else if (rawDesc) {
      // Try to detect category from description text
      const detected = detectPhaseKey(rawDesc);
      if (detected) category = detected;
    }

    const rawUnit = colUnit >= 0 ? String(row[colUnit] ?? "").trim() || null : null;
    const rawMin  = colMin  >= 0 ? parseFloat(String(row[colMin]  ?? "").replace(/[$.,%\s]/g, "")) : NaN;
    const rawMax  = colMax  >= 0 ? parseFloat(String(row[colMax]  ?? "").replace(/[$.,%\s]/g, "")) : NaN;

    rows.push({
      category,
      subcategory:  null,
      description:  rawDesc || `Ítem ${i}`,
      unit:         rawUnit,
      value_avg:    rawPrice,
      value_min:    isFinite(rawMin) && rawMin > 0 ? rawMin : null,
      value_max:    isFinite(rawMax) && rawMax > 0 ? rawMax : null,
    });
  }

  if (rows.length === 0) {
    warnings.push("No se encontraron filas con precios válidos.");
  }

  return { rows, warnings, period_year, period_month };
}

/**
 * Converts ParsedPriceRows into PriceIndexRow inserts, stamping org, source, period and uploader.
 */
export function toIndexInserts(
  parsed: ParseResult,
  opts: {
    organizationId: string;
    source: "company_list" | "CAC" | "INDEC";
    uploadedBy: string;
    sourceFile: string;
    notes?: string;
  },
): Omit<PriceIndexRow, "id" | "created_at">[] {
  return parsed.rows.map(r => ({
    organization_id: opts.organizationId,
    source:          opts.source,
    category:        r.category,
    subcategory:     r.subcategory,
    description:     r.description,
    unit:            r.unit,
    value_avg:       r.value_avg,
    value_min:       r.value_min,
    value_max:       r.value_max,
    currency:        "ARS",
    period_month:    parsed.period_month,
    period_year:     parsed.period_year,
    published_at:    null,
    uploaded_by:     opts.uploadedBy,
    source_file:     opts.sourceFile,
    notes:           opts.notes ?? null,
    is_active:       true,
  }));
}
