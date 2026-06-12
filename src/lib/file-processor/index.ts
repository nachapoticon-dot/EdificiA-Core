/**
 * Universal File Processor — dispatches to the correct engine based on file type.
 * Supported now: Excel, PDF, DXF, DOCX, Images.
 * Not supported: DWG (binary proprietary — rejected with guidance to export DXF).
 */

export * from "./types";

import { parseExcelBudget } from "@/lib/excel/parser";
import { processPdf } from "./pdf-processor";
import { processDxf } from "./dxf-processor";
import { processDocx } from "./docx-processor";
import { detectFileType, type ProcessedFile } from "./types";

export async function processFile(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType?: string,
): Promise<ProcessedFile> {
  const fileType = detectFileType(fileName, mimeType);
  const fileSize = buffer.byteLength;

  switch (fileType) {
    case "excel": {
      const parsed = parseExcelBudget(buffer, fileName);
      return {
        type: "excel",
        fileName,
        fileSize,
        sheetName: parsed.sheetName,
        items: parsed.items,
        detectedTotal: parsed.detectedTotal,
        itemCount: parsed.items.length,
      };
    }

    case "pdf":
      return processPdf(buffer, fileName);

    case "dxf":
      return processDxf(buffer, fileName);

    case "docx":
      return processDocx(buffer, fileName);

    case "image":
      // Images are handled client-side via sendMessage({ files }) — multimodal.
      // If they arrive at the upload endpoint anyway, return a base64 data URL.
      return {
        type: "image",
        fileName,
        fileSize,
        mimeType: mimeType ?? "image/jpeg",
        dataUrl: `data:${mimeType ?? "image/jpeg"};base64,${bufferToBase64(buffer)}`,
      };

    case "dwg_unsupported":
      return {
        type: "dwg_unsupported",
        fileName,
        fileSize,
        message:
          "El formato DWG (AutoCAD binario) no puede procesarse directamente por limitaciones de la licencia propietaria de Autodesk.",
        suggestion:
          "Exportá el archivo como DXF desde AutoCAD (Archivo → Guardar como → DXF) y volvé a subirlo. El soporte nativo DWG está en el roadmap.",
      };
  }
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}
