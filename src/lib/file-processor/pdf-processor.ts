import type { PdfProcessedFile } from "./types";
import { ragLogger } from "@/lib/logger";

/**
 * Extracts text from a PDF using pdf-parse.
 * If the PDF is scanned (no selectable text), marks it as needing multimodal analysis.
 * Scanned PDFs are not yet converted to images server-side — Claude handles them via
 * client-side File upload (sendMessage({ files }) in the chat).
 */

/**
 * Estimates page count from raw PDF bytes when pdf-parse fails.
 * Strategy (in order of reliability):
 *   1. Read `/Count N` immediately after the `/Type /Pages` root catalog.
 *   2. Fall back to counting `/Type /Page` markers across the entire file.
 */
function estimatePageCountFromBytes(buffer: ArrayBuffer): number {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("latin1").decode(bytes);

  // 1. Prefer the canonical `/Count` field on the root `/Pages` catalog.
  //    `/Type /Pages` defines a node in the page tree; its `/Count` (within the
  //    same object, ≤400 bytes) is the total descendant page count.
  const pagesRootRegex = /\/Type\s*\/Pages[^]{0,400}?\/Count\s+(\d+)/g;
  let bestCount = 0;
  for (const m of text.matchAll(pagesRootRegex)) {
    const n = parseInt(m[1] ?? "0", 10);
    if (n > bestCount) bestCount = n;
  }
  if (bestCount > 0) return bestCount;

  // 2. Fallback: count `/Type /Page` markers in the full file (excluding `/Pages`).
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 1;
}

export async function processPdf(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<PdfProcessedFile> {
  const { PDFParse } = await import("pdf-parse");

  let result: { text: string; total: number; pagesWithText: number; havePageInfo: boolean } | null = null;
  let parser: InstanceType<typeof PDFParse> | null = null;
  try {
    parser = new PDFParse({ data: Buffer.from(buffer) });
    const out = await parser.getText();
    const pages = (out as unknown as { pages?: { text: string }[] }).pages ?? [];
    const havePageInfo = pages.length > 0;
    const pagesWithText = pages.filter((p) => (p.text ?? "").trim().length > 30).length;
    result = {
      text: out.text ?? "",
      total: out.total ?? pages.length,
      pagesWithText,
      havePageInfo,
    };
  } catch (err) {
    ragLogger.warn(
      { err, fileName, fileSize: buffer.byteLength },
      "pdf-processor: pdf-parse failed, falling back to byte estimator",
    );
    return {
      type: "pdf",
      fileName,
      fileSize: buffer.byteLength,
      pageCount: estimatePageCountFromBytes(buffer),
      text: "",
      isScanned: true,
      pageImages: [],
    };
  } finally {
    await parser?.destroy().catch(() => {});
  }

  const text = result.text.trim();
  const total = result.total || estimatePageCountFromBytes(buffer);
  // Heuristic: scanned if average chars/page is too low. When we have per-page
  // info, additionally require <50% page coverage so we don't flag a 9-page PDF
  // that happens to have a couple of image-only pages as fully scanned.
  const charsPerPage = total > 0 ? text.length / total : text.length;
  const lowChars = charsPerPage < 100;
  const isScanned = result.havePageInfo
    ? lowChars && (result.pagesWithText / total) < 0.5
    : lowChars;

  return {
    type: "pdf",
    fileName,
    fileSize: buffer.byteLength,
    pageCount: total,
    text,
    isScanned,
    pageImages: [],
  };
}
