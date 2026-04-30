import type { ProcessedFile } from "@/lib/file-processor/types";

export interface DocumentChunk {
  text: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

const MAX_CHUNK_CHARS = 1200;
/** Carry the last N chars into the next chunk so context isn't lost at boundaries. */
const CHUNK_OVERLAP = 150;

/**
 * Splits a processed file into indexable text chunks.
 * Strategy per type:
 *   excel  → groups of 20 budget items
 *   pdf    → sliding-window over paragraphs (with overlap, no silent truncation)
 *   dxf    → single metadata chunk (layers + annotations)
 *   docx   → sliding-window over paragraphs (with overlap)
 *   image  → single descriptive chunk
 */
export function chunkDocument(file: ProcessedFile): DocumentChunk[] {
  switch (file.type) {
    case "excel":
      return chunkExcel(file);
    case "pdf":
      return chunkPdf(file);
    case "dxf":
      return chunkDxf(file);
    case "docx":
      return chunkDocx(file);
    case "image":
      return [{ text: `Imagen: ${file.fileName} (${file.mimeType})`, chunkIndex: 0, metadata: { mimeType: file.mimeType } }];
    default:
      return [];
  }
}

function chunkExcel(file: Extract<ProcessedFile, { type: "excel" }>): DocumentChunk[] {
  const GROUP_SIZE = 20;
  const chunks: DocumentChunk[] = [];

  for (let i = 0; i < file.items.length; i += GROUP_SIZE) {
    const group = file.items.slice(i, i + GROUP_SIZE);
    const lines = group.map((item) =>
      `${item.code ?? ""} | ${item.description} | cant: ${item.quantity} ${item.unit} | PU: ${item.unitPrice} | total: ${item.totalPrice}`
    );
    chunks.push({
      text: `Presupuesto: ${file.sheetName}\n${lines.join("\n")}`,
      chunkIndex: chunks.length,
      metadata: { sheetName: file.sheetName, itemStart: i, itemEnd: i + group.length },
    });
  }

  return chunks.length > 0
    ? chunks
    : [{ text: `Presupuesto vacío: ${file.fileName}`, chunkIndex: 0, metadata: {} }];
}

/**
 * PDF chunker — uses sliding window over paragraph segments.
 * Fixes the previous bug where `.slice(0, MAX_CHUNK_CHARS)` silently discarded
 * everything past 1200 chars per page. Now every byte of text becomes a chunk.
 */
function chunkPdf(file: Extract<ProcessedFile, { type: "pdf" }>): DocumentChunk[] {
  if (file.isScanned || !file.text.trim()) {
    return [{
      text: `PDF escaneado: ${file.fileName} (${file.pageCount} páginas)`,
      chunkIndex: 0,
      metadata: { isScanned: true, pageCount: file.pageCount },
    }];
  }

  return slidingWindowChunk(file.text, { pageCount: file.pageCount });
}

function chunkDxf(file: Extract<ProcessedFile, { type: "dxf" }>): DocumentChunk[] {
  const geo = file.geometrySummary;
  const layerList = file.layers.join(", ");
  const annotations = file.textAnnotations.slice(0, 30).join("; ");
  const text = [
    `Plano DXF: ${file.fileName}`,
    `Capas (${file.layers.length}): ${layerList.slice(0, 300)}`,
    annotations ? `Anotaciones: ${annotations.slice(0, 300)}` : "",
    `Área total: ${geo.totalAreaM2.toFixed(2)} m² | Longitud total: ${geo.totalLinearM.toFixed(2)} ml`,
    file.blockNames.length ? `Bloques: ${file.blockNames.slice(0, 10).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  return [{ text, chunkIndex: 0, metadata: { layerCount: file.layers.length, totalAreaM2: geo.totalAreaM2, totalLinearM: geo.totalLinearM } }];
}

function chunkDocx(file: Extract<ProcessedFile, { type: "docx" }>): DocumentChunk[] {
  if (!file.text.trim()) {
    return [{ text: `Documento: ${file.fileName}`, chunkIndex: 0, metadata: {} }];
  }
  return slidingWindowChunk(file.text, {});
}

/**
 * Generic sliding-window chunker that splits on paragraph boundaries and
 * carries a CHUNK_OVERLAP tail into the next window to preserve cross-boundary context.
 * Falls back to word-by-word splitting for paragraphs that exceed MAX_CHUNK_CHARS.
 */
function slidingWindowChunk(text: string, meta: Record<string, unknown>): DocumentChunk[] {
  const segments = text.split(/\n{2,}/).map((s) => s.trim()).filter((s) => s.length > 20);

  // If no paragraph structure, treat entire text as one block
  const source = segments.length > 0 ? segments : [text.trim()].filter((s) => s.length > 20);
  if (source.length === 0) return [];

  const chunks: DocumentChunk[] = [];
  let current = "";
  let idx = 0;

  for (const seg of source) {
    const addition = current ? "\n\n" + seg : seg;

    if (current.length + addition.length > MAX_CHUNK_CHARS) {
      if (current.trim()) {
        chunks.push({ text: current.trim(), chunkIndex: idx++, metadata: meta });
        // Carry the tail into the next chunk for cross-boundary context
        const tail = current.slice(-CHUNK_OVERLAP).trimStart();
        current = tail ? tail + "\n\n" + seg : seg;
      } else {
        // Single segment is too long — split word-by-word
        const wordChunks = splitByWords(seg, meta);
        for (const wc of wordChunks) {
          chunks.push({ ...wc, chunkIndex: idx++ });
        }
        current = "";
      }
    } else {
      current += addition;
    }
  }

  if (current.trim()) {
    chunks.push({ text: current.trim(), chunkIndex: idx, metadata: meta });
  }

  return chunks;
}

function splitByWords(text: string, meta: Record<string, unknown>): DocumentChunk[] {
  const words = text.split(/\s+/);
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

  if (buf.trim()) {
    chunks.push({ text: buf.trim(), chunkIndex: idx, metadata: meta });
  }

  return chunks;
}
