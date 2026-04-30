import type { ProcessedFile, ExcelProcessedFile, DxfProcessedFile, PdfProcessedFile, DocxProcessedFile } from "@/lib/file-processor/types";
import type { BudgetItem } from "@/lib/math-engine/validators";

/**
 * Extracts learnable patterns from a processed document.
 * Returns a flat map of { pattern_key → pattern_value } to upsert into
 * company_learned_patterns. Returns null if no meaningful patterns found.
 */
export function extractPatterns(
  file: ProcessedFile,
): { documentType: string; patterns: Record<string, unknown> } | null {
  switch (file.type) {
    case "excel":   return { documentType: "excel", patterns: extractExcelPatterns(file) };
    case "dxf":     return { documentType: "dxf",   patterns: extractDxfPatterns(file) };
    case "pdf":     return { documentType: "pdf",    patterns: extractPdfPatterns(file) };
    case "docx":    return { documentType: "docx",   patterns: extractDocxPatterns(file) };
    default:        return null;
  }
}

// ── Excel ─────────────────────────────────────────────────────────────────────

function extractExcelPatterns(file: ExcelProcessedFile): Record<string, unknown> {
  const items = file.items;
  if (items.length === 0) return {};

  // Column aliases: which field names appear in the raw data
  const units = Array.from(new Set(items.map((i) => i.unit).filter(Boolean)));

  // Rubro structure: unique prefixes/categories from codes (e.g. "SC", "A", "E")
  const prefixes = Array.from(new Set(
    items.map((i) => i.code.replace(/\d+$/, "").toUpperCase()).filter(Boolean)
  ));

  // Price stats
  const prices = items.map((i) => i.unitPrice).filter((p) => p > 0);
  const priceRange = prices.length > 0 ? {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: prices.reduce((s, p) => s + p, 0) / prices.length,
  } : null;

  // Detect markup / overhead items (% unit or keyword in description)
  const markupItems = items
    .filter((i) => isMarkupItem(i))
    .map((i) => ({ code: i.code, description: i.description, unit: i.unit }));

  // Detect subcontracted ratio
  const subcontractedRatio = items.length > 0
    ? items.filter((i) => i.isSubcontracted).length / items.length
    : 0;

  return {
    column_aliases: {
      units,
      code_prefixes: prefixes.slice(0, 20),
    },
    rubro_structure: {
      item_count: items.length,
      has_declared_total: file.detectedTotal != null,
      code_prefix_set: prefixes.slice(0, 20),
    },
    price_ranges: priceRange,
    markup_items: markupItems.slice(0, 10),
    subcontracted_ratio: Math.round(subcontractedRatio * 100) / 100,
  };
}

function isMarkupItem(item: BudgetItem): boolean {
  if (item.unit === "%" || item.unit === "gl" || item.unit === "GL") return true;
  const kw = ["imprevisto", "contingencia", "gastos generales", "utilidad", "administración", "beneficio"];
  const desc = item.description.toLowerCase();
  return kw.some((k) => desc.includes(k));
}

// ── DXF ───────────────────────────────────────────────────────────────────────

function extractDxfPatterns(file: DxfProcessedFile): Record<string, unknown> {
  const totalEntities = Object.values(file.entitySummary).reduce((s, v) => s + v, 0);
  const entityDistribution: Record<string, number> = {};
  if (totalEntities > 0) {
    for (const [k, v] of Object.entries(file.entitySummary)) {
      entityDistribution[k] = Math.round((v / totalEntities) * 100);
    }
  }

  return {
    layer_conventions: file.layers.slice(0, 30),
    entity_distribution: entityDistribution,
    has_geometry: file.geometrySummary.totalAreaM2 > 0 || file.geometrySummary.totalLinearM > 0,
    scale_unit_factor: file.geometrySummary.unitFactor,
    block_library: file.blockNames.slice(0, 20),
  };
}

// ── PDF ───────────────────────────────────────────────────────────────────────

function extractPdfPatterns(file: PdfProcessedFile): Record<string, unknown> {
  if (file.isScanned || !file.text) return { is_scanned: true };

  // Extract section titles (lines that look like headings: short, no period, maybe uppercase)
  const lines = file.text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const sectionTitles = lines
    .filter((l) => l.length > 3 && l.length < 80 && !l.includes(".") && /[A-Z]/.test(l[0] ?? ""))
    .slice(0, 10);

  // Vocabulary domain detection
  const lowerText = file.text.toLowerCase().slice(0, 5000);
  const domain = detectVocabularyDomain(lowerText);

  return {
    section_titles: sectionTitles,
    vocabulary_domain: domain,
    page_count: file.pageCount,
  };
}

function detectVocabularyDomain(text: string): string {
  const scores: Record<string, number> = {
    presupuesto: 0,
    pliego: 0,
    memoria: 0,
    plano: 0,
  };

  const keywords: Record<string, string[]> = {
    presupuesto: ["precio unitario", "total", "ítem", "costo directo", "rubro", "monto"],
    pliego: ["especificaciones", "condiciones generales", "licitación", "oferente", "pliego"],
    memoria: ["memoria descriptiva", "superficie", "se proyecta", "local", "circulación"],
    plano: ["escala", "planta baja", "corte", "fachada", "cotas", "dimensiones"],
  };

  for (const [domain, kws] of Object.entries(keywords)) {
    for (const kw of kws) {
      if (text.includes(kw)) scores[domain]! += 1;
    }
  }

  const best = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
  return best?.[0] ?? "general";
}

// ── DOCX ──────────────────────────────────────────────────────────────────────

function extractDocxPatterns(file: DocxProcessedFile): Record<string, unknown> {
  const lines = file.text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const sectionTitles = lines
    .filter((l) => l.length > 3 && l.length < 80)
    .slice(0, 10);

  const wordDensity = file.wordCount > 0
    ? Math.round(file.wordCount / Math.max(1, lines.length))
    : 0;

  return {
    structure: sectionTitles,
    word_density: wordDensity,
    word_count: file.wordCount,
  };
}
