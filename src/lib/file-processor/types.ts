import type { BudgetItem } from "@/lib/math-engine/validators";

/** Tipos de archivo soportados por el procesador universal. */
export type SupportedFileType =
  | "excel"
  | "pdf"
  | "dxf"
  | "image"
  | "docx"
  | "dwg_unsupported";

/**
 * Resultado unificado del procesador de archivos.
 * Cada tipo de archivo produce una salida específica que el agente interpreta.
 */
export type ProcessedFile =
  | ExcelProcessedFile
  | PdfProcessedFile
  | DxfProcessedFile
  | ImageProcessedFile
  | DocxProcessedFile
  | UnsupportedFile;

interface BaseFile {
  fileName: string;
  fileSize: number;
}

export interface ExcelProcessedFile extends BaseFile {
  type: "excel";
  sheetName: string;
  items: BudgetItem[];
  detectedTotal: number | null;
  itemCount: number;
}

export interface PdfProcessedFile extends BaseFile {
  type: "pdf";
  pageCount: number;
  /** Extracted text. Empty if scanned PDF (needs multimodal). */
  text: string;
  isScanned: boolean;
  /** Base64 data URLs of pages, populated only if isScanned=true */
  pageImages: string[];
}

export interface DxfProcessedFile extends BaseFile {
  type: "dxf";
  layers: string[];
  textAnnotations: string[];
  dimensions: DxfDimension[];
  blockNames: string[];
  entitySummary: Record<string, number>;
}

export interface DxfDimension {
  text: string;
  value: number | null;
  layer: string;
}

export interface ImageProcessedFile extends BaseFile {
  type: "image";
  mimeType: string;
  /** Base64 data URL — passed directly to Claude multimodal */
  dataUrl: string;
  widthHint?: number;
  heightHint?: number;
}

export interface DocxProcessedFile extends BaseFile {
  type: "docx";
  text: string;
  wordCount: number;
}

export interface UnsupportedFile extends BaseFile {
  type: "dwg_unsupported";
  message: string;
  suggestion: string;
}

// ── File type detection ──────────────────────────────────────────────────────

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".tiff", ".bmp"];
export const IMAGE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/tiff"];

export function detectFileType(fileName: string, mimeType?: string): SupportedFileType {
  const ext = "." + (fileName.split(".").pop()?.toLowerCase() ?? "");

  if ([".xlsx", ".xls", ".csv"].includes(ext)) return "excel";
  if (ext === ".pdf") return "pdf";
  if (ext === ".dxf") return "dxf";
  if (ext === ".dwg") return "dwg_unsupported";
  if (ext === ".docx" || ext === ".doc") return "docx";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (mimeType && IMAGE_MIMES.includes(mimeType)) return "image";

  return "pdf"; // fallback: try as text/pdf
}
