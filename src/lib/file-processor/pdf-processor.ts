import type { PdfProcessedFile } from "./types";

/**
 * Extracts text from a PDF using pdf-parse.
 * If the PDF is scanned (no selectable text), marks it as needing multimodal analysis.
 * Scanned PDFs are not yet converted to images server-side — Claude handles them via
 * client-side File upload (sendMessage({ files }) in the chat).
 */

/** Counts /Type /Page objects in raw PDF bytes as a fallback when pdf-parse fails. */
function estimatePageCountFromBytes(buffer: ArrayBuffer): number {
  const sampleSize = Math.min(buffer.byteLength, 600_000);
  const text = new TextDecoder("latin1").decode(new Uint8Array(buffer, 0, sampleSize));
  // Match /Type /Page but NOT /Type /Pages (the catalog node)
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 1;
}

export async function processPdf(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<PdfProcessedFile> {
  // Dynamic import to keep the parser out of the edge runtime bundle
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = ("default" in pdfParseModule ? pdfParseModule.default : pdfParseModule) as (
    data: Buffer,
  ) => Promise<{ text: string; numpages: number }>;

  let result: { text: string; numpages: number };
  try {
    result = await pdfParse(Buffer.from(buffer));
  } catch {
    // pdf-parse failed (encoding issues, PDF/A, security features, etc.)
    // Estimate page count from raw bytes so the UI shows the real number.
    return {
      type: "pdf",
      fileName,
      fileSize: buffer.byteLength,
      pageCount: estimatePageCountFromBytes(buffer),
      text: "",
      isScanned: true,
      pageImages: [],
    };
  }

  const text = result.text?.trim() ?? "";
  // Heuristic: fewer than 200 meaningful chars across N pages ≈ scanned/image-only PDF
  const charsPerPage = result.numpages > 0 ? text.length / result.numpages : text.length;
  const isScanned = charsPerPage < 100;

  return {
    type: "pdf",
    fileName,
    fileSize: buffer.byteLength,
    pageCount: result.numpages,
    text,
    isScanned,
    pageImages: [], // Server-side rasterization not implemented; client handles via multimodal
  };
}
