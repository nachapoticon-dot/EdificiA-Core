import type { ProcessedFile } from "@/lib/file-processor/types";

export interface DocumentChunk {
  text: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

const MAX_CHUNK_CHARS = 1200;

/**
 * Splits a processed file into indexable text chunks.
 * Strategy per type:
 *   excel  → groups of 20 budget items
 *   pdf    → one chunk per page (up to MAX_CHUNK_CHARS)
 *   dxf    → single metadata chunk (layers + annotations)
 *   docx   → one chunk per paragraph group
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

function chunkPdf(file: Extract<ProcessedFile, { type: "pdf" }>): DocumentChunk[] {
  if (file.isScanned || !file.text.trim()) {
    return [{ text: `PDF escaneado: ${file.fileName} (${file.pageCount} páginas)`, chunkIndex: 0, metadata: { isScanned: true, pageCount: file.pageCount } }];
  }

  const pages = file.text.split(/\f|\n{4,}/);
  return pages
    .map((page, i) => page.trim())
    .filter((page) => page.length > 20)
    .map((page, i) => ({
      text: page.slice(0, MAX_CHUNK_CHARS),
      chunkIndex: i,
      metadata: { pageHint: i + 1 },
    }));
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
  const paragraphs = file.text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  if (paragraphs.length === 0) {
    return [{ text: `Documento: ${file.fileName}`, chunkIndex: 0, metadata: {} }];
  }

  const chunks: DocumentChunk[] = [];
  let current = "";
  let idx = 0;

  for (const paragraph of paragraphs) {
    if (current.length + paragraph.length > MAX_CHUNK_CHARS) {
      if (current) {
        chunks.push({ text: current.trim(), chunkIndex: idx++, metadata: {} });
        current = "";
      }
    }
    current += (current ? "\n\n" : "") + paragraph;
  }
  if (current.trim()) {
    chunks.push({ text: current.trim(), chunkIndex: idx, metadata: {} });
  }

  return chunks;
}
