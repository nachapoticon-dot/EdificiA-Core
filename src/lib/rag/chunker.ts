import type { ProcessedFile } from "@/lib/file-processor/types";
import type { BudgetItem } from "@/lib/math-engine/validators";
import { extractStructuredSections } from "./structure";

export interface DocumentChunk {
  text: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

const MAX_CHUNK_CHARS = 1200;
const CHUNK_OVERLAP   = 150;

export function chunkDocument(file: ProcessedFile): DocumentChunk[] {
  switch (file.type) {
    case "excel":  return chunkExcel(file);
    case "pdf":    return chunkPdf(file);
    case "dxf":    return chunkDxf(file);
    case "docx":   return chunkDocx(file);
    case "image":  return [{ text: `Imagen: ${file.fileName}`, chunkIndex: 0, metadata: { mimeType: file.mimeType } }];
    default:       return [];
  }
}

// ── Excel — group by rubro, fallback to flat groups of 20 ─────────────────────

interface RubroGroup {
  rubro: string;
  items: BudgetItem[];
}

/**
 * Detects rubro header rows: items with no quantity/price that act as section titles.
 * In Argentine budgets these appear as ALL-CAPS descriptions with zero quantities.
 */
function detectRubroGroups(items: BudgetItem[]): RubroGroup[] {
  const groups: RubroGroup[] = [];
  let current: RubroGroup = { rubro: "General", items: [] };

  for (const item of items) {
    const isHeader =
      item.quantity === 0 &&
      item.unitPrice === 0 &&
      item.totalPrice === 0 &&
      item.description.trim().length > 0;

    if (isHeader) {
      if (current.items.length > 0) groups.push(current);
      current = { rubro: item.description.trim(), items: [] };
    } else {
      current.items.push(item);
    }
  }
  if (current.items.length > 0) groups.push(current);

  return groups;
}

function chunkExcel(file: Extract<ProcessedFile, { type: "excel" }>): DocumentChunk[] {
  const groups = detectRubroGroups(file.items);

  // Use rubro-based chunking when the budget has clear structure
  if (groups.length > 1) {
    return groups.flatMap((group, i) => {
      const rubroTotal = group.items.reduce((s, it) => s + it.totalPrice, 0);
      const lines = group.items.map(
        (it) => `${it.code} | ${it.description} | ${it.quantity} ${it.unit} | PU: ${it.unitPrice} | total: ${it.totalPrice}`,
      );
      return [{
        text: `Rubro: ${group.rubro}\n${lines.join("\n")}\nTotal rubro: $${rubroTotal.toLocaleString("es-AR")}`,
        chunkIndex: i,
        metadata: {
          section_title: group.rubro,
          section_path: ["Rubros", group.rubro],
          section_level: 2,
          section_index: i,
          rubro: group.rubro,
          rubro_total: rubroTotal,
          has_prices: true,
          has_quantities: true,
          item_count: group.items.length,
        },
      }];
    });
  }

  // Fallback: flat groups of 20
  const chunks: DocumentChunk[] = [];
  const GROUP = 20;
  for (let i = 0; i < file.items.length; i += GROUP) {
    const group = file.items.slice(i, i + GROUP);
    const lines = group.map(
      (it) => `${it.code} | ${it.description} | ${it.quantity} ${it.unit} | PU: ${it.unitPrice} | total: ${it.totalPrice}`,
    );
    chunks.push({
      text: `Presupuesto: ${file.sheetName}\n${lines.join("\n")}`,
      chunkIndex: chunks.length,
      metadata: {
        sheetName: file.sheetName,
        section_title: file.sheetName,
        section_path: ["Presupuesto", file.sheetName],
        section_level: 2,
        section_index: chunks.length,
        itemStart: i,
        itemEnd: i + group.length,
        has_prices: true,
        has_quantities: true,
      },
    });
  }
  return chunks.length > 0
    ? chunks
    : [{ text: `Presupuesto vacío: ${file.fileName}`, chunkIndex: 0, metadata: { has_prices: false, has_quantities: false } }];
}

// ── PDF — structure-aware chunking ────────────────────────────────────────────

function chunkPdf(file: Extract<ProcessedFile, { type: "pdf" }>): DocumentChunk[] {
  if (file.isScanned || !file.text.trim()) {
    return [{
      text: `PDF escaneado: ${file.fileName} (${file.pageCount} páginas)`,
      chunkIndex: 0,
      metadata: { isScanned: true, pageCount: file.pageCount },
    }];
  }

  const sections = extractStructuredSections(file.text);

  if (sections.length > 1) {
    let idx = 0;
    return sections.flatMap((sec) => {
      const baseMeta = {
        section_title: sec.title,
        section_path: sec.path,
        section_level: sec.level,
        section_index: sec.order,
        section_parent: sec.path.length > 1 ? sec.path[sec.path.length - 2] : null,
        line_start: sec.lineStart,
        line_end: sec.lineEnd,
        page_count: file.pageCount,
        has_prices: /precio|costo|monto|importe|\$|total/i.test(sec.content),
        has_quantities: /m2|m²|ml|kg|gl|unid|cant/i.test(sec.content),
      };
      const fullText = `Sección: ${sec.path.join(" > ")}\n\n${sec.content}`;
      if (fullText.length <= MAX_CHUNK_CHARS) {
        return [{ text: fullText, chunkIndex: idx++, metadata: baseMeta }];
      }
      return slidingWindowChunk(fullText, baseMeta).map((c) => ({ ...c, chunkIndex: idx++ }));
    });
  }

  return slidingWindowChunk(file.text, { pageCount: file.pageCount });
}

// ── DXF ───────────────────────────────────────────────────────────────────────

function chunkDxf(file: Extract<ProcessedFile, { type: "dxf" }>): DocumentChunk[] {
  const geo  = file.geometrySummary;
  const text = [
    `Plano DXF: ${file.fileName}`,
    `Capas (${file.layers.length}): ${file.layers.join(", ").slice(0, 300)}`,
    file.textAnnotations.length ? `Anotaciones: ${file.textAnnotations.slice(0, 30).join("; ").slice(0, 300)}` : "",
    `Área total: ${geo.totalAreaM2.toFixed(2)} m² | Longitud total: ${geo.totalLinearM.toFixed(2)} ml`,
    file.blockNames.length ? `Bloques: ${file.blockNames.slice(0, 10).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  return [{ text, chunkIndex: 0, metadata: { layerCount: file.layers.length, totalAreaM2: geo.totalAreaM2, totalLinearM: geo.totalLinearM } }];
}

// ── DOCX ──────────────────────────────────────────────────────────────────────

function chunkDocx(file: Extract<ProcessedFile, { type: "docx" }>): DocumentChunk[] {
  if (!file.text.trim()) return [{ text: `Documento: ${file.fileName}`, chunkIndex: 0, metadata: {} }];
  const sections = extractStructuredSections(file.text);
  if (sections.length > 1) {
    let idx = 0;
    return sections.flatMap((sec) => {
      const meta = {
        section_title: sec.title,
        section_path: sec.path,
        section_level: sec.level,
        section_index: sec.order,
        section_parent: sec.path.length > 1 ? sec.path[sec.path.length - 2] : null,
        line_start: sec.lineStart,
        line_end: sec.lineEnd,
      };
      const full = `Sección: ${sec.path.join(" > ")}\n\n${sec.content}`;
      if (full.length <= MAX_CHUNK_CHARS) return [{ text: full, chunkIndex: idx++, metadata: meta }];
      return slidingWindowChunk(full, meta).map((c) => ({ ...c, chunkIndex: idx++ }));
    });
  }
  return slidingWindowChunk(file.text, {});
}

// ── Shared sliding-window chunker ─────────────────────────────────────────────

function slidingWindowChunk(text: string, meta: Record<string, unknown>): DocumentChunk[] {
  const segments = text.split(/\n{2,}/).map((s) => s.trim()).filter((s) => s.length > 20);
  const source   = segments.length > 0 ? segments : [text.trim()].filter((s) => s.length > 20);
  if (source.length === 0) return [];

  const chunks: DocumentChunk[] = [];
  let current = "";
  let idx = 0;

  for (const seg of source) {
    const addition = current ? "\n\n" + seg : seg;
    if (current.length + addition.length > MAX_CHUNK_CHARS) {
      if (current.trim()) {
        chunks.push({ text: current.trim(), chunkIndex: idx++, metadata: meta });
        const tail = current.slice(-CHUNK_OVERLAP).trimStart();
        current = tail ? tail + "\n\n" + seg : seg;
      } else {
        splitByWords(seg, meta).forEach((wc) => chunks.push({ ...wc, chunkIndex: idx++ }));
        current = "";
      }
    } else {
      current += addition;
    }
  }
  if (current.trim()) chunks.push({ text: current.trim(), chunkIndex: idx, metadata: meta });
  return chunks;
}

function splitByWords(text: string, meta: Record<string, unknown>): DocumentChunk[] {
  const words  = text.split(/\s+/);
  const chunks: DocumentChunk[] = [];
  let buf = "";
  let idx = 0;
  for (const word of words) {
    if (buf.length + word.length + 1 > MAX_CHUNK_CHARS && buf) {
      chunks.push({ text: buf.trim(), chunkIndex: idx++, metadata: meta });
      buf = word;
    } else {
      buf += (buf ? " " : "") + word;
    }
  }
  if (buf.trim()) chunks.push({ text: buf.trim(), chunkIndex: idx, metadata: meta });
  return chunks;
}
