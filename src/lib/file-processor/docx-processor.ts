import type { DocxProcessedFile } from "./types";

/** Extracts plain text from a .docx file using mammoth. */
export async function processDocx(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<DocxProcessedFile> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = await import("mammoth");

  let text = "";
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    text = result.value.trim();
  } catch {
    text = "";
  }

  const wordCount = text ? text.split(/\s+/).length : 0;

  return {
    type: "docx",
    fileName,
    fileSize: buffer.byteLength,
    text,
    wordCount,
  };
}
