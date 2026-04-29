import type { PdfProcessedFile } from "./types";

/**
 * Extracts text from a PDF using pdf-parse.
 * If the PDF is scanned (no selectable text), marks it as needing multimodal analysis.
 * Scanned PDFs are not yet converted to images server-side — Claude handles them via
 * client-side File upload (sendMessage({ files }) in the chat).
 */
export async function processPdf(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<PdfProcessedFile> {
  // Dynamic import to keep the parser out of the edge runtime bundle
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = ("default" in pdfParseModule ? pdfParseModule.default : pdfParseModule) as (
    data: Buffer,
  ) => Promise<{ text: string; numpages: number }>;

  let result: { text: string; numpages: number };
  try {
    result = await pdfParse(Buffer.from(buffer));
  } catch {
    return {
      type: "pdf",
      fileName,
      fileSize: buffer.byteLength,
      pageCount: 0,
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
