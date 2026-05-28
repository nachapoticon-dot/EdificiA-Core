import type { DxfProcessedFile, DxfDimension } from "./types";
import { extractDxfGeometry } from "./dxf-geometry";

/**
 * Lightweight DXF parser — no external library needed.
 * DXF (Drawing Exchange Format) is a plain-text format with a key/value structure.
 * Each "group code" (a number) defines the meaning of the next line (the value).
 *
 * We extract: TEXT/MTEXT annotations, DIMENSION values, LAYER names, and entity counts.
 * This gives the multimodal model enough context to understand what the drawing contains without
 * requiring a full geometric renderer.
 *
 * DXF spec reference: https://help.autodesk.com/view/OARX/2023/ENU/?guid=GUID-235B22E0-A567-4CF6-92D3-38A2306D73F3
 */
export function processDxf(
  buffer: ArrayBuffer,
  fileName: string,
): DxfProcessedFile {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const lines = text.split(/\r?\n/);

  const layers = new Set<string>();
  const textAnnotations: string[] = [];
  const dimensions: DxfDimension[] = [];
  const blockNames: string[] = [];
  const entityCounts: Record<string, number> = {};

  let i = 0;
  let currentEntity = "";
  let currentLayer = "0";
  let dimText = "";
  let dimValue: number | null = null;
  let pendingTextValue = "";

  while (i < lines.length) {
    const code = parseInt(lines[i]?.trim() ?? "", 10);
    const value = (lines[i + 1] ?? "").trim();
    i += 2;

    if (isNaN(code)) continue;

    switch (code) {
      case 0: {
        // New entity type — flush previous entity if needed
        if (currentEntity === "TEXT" || currentEntity === "MTEXT") {
          if (pendingTextValue && pendingTextValue.length > 1) {
            textAnnotations.push(cleanDxfText(pendingTextValue));
          }
          pendingTextValue = "";
        }
        if (currentEntity === "DIMENSION" && dimText) {
          dimensions.push({
            text: cleanDxfText(dimText),
            value: dimValue,
            layer: currentLayer,
          });
          dimText = "";
          dimValue = null;
        }
        if (currentEntity === "BLOCK" && value && !value.startsWith("*")) {
          blockNames.push(value);
        }

        currentEntity = value.toUpperCase();
        entityCounts[currentEntity] = (entityCounts[currentEntity] ?? 0) + 1;
        break;
      }
      case 1:
        // Primary text value (used by TEXT, MTEXT, DIMENSION)
        if (currentEntity === "TEXT" || currentEntity === "MTEXT") {
          pendingTextValue = value;
        } else if (currentEntity === "DIMENSION") {
          dimText = value;
        }
        break;
      case 3:
        // Additional text (MTEXT continuation)
        if (currentEntity === "MTEXT") {
          pendingTextValue += value;
        }
        break;
      case 8:
        // Layer name
        currentLayer = value;
        layers.add(value);
        break;
      case 42:
        // Actual measurement value in DIMENSION entity
        if (currentEntity === "DIMENSION") {
          dimValue = parseFloat(value);
        }
        break;
      case 2:
        // Block name (group 2 under BLOCK section)
        if (currentEntity === "BLOCK" && value && !value.startsWith("*")) {
          blockNames.push(value);
        }
        break;
    }
  }

  const geometrySummary = extractDxfGeometry(lines);

  return {
    type: "dxf",
    fileName,
    fileSize: buffer.byteLength,
    layers: Array.from(layers).filter((l) => l && l !== "0").slice(0, 50),
    textAnnotations: dedup(textAnnotations).slice(0, 200),
    dimensions: dimensions.slice(0, 100),
    blockNames: dedup(blockNames).slice(0, 50),
    entitySummary: entityCounts,
    geometrySummary,
  };
}

function cleanDxfText(raw: string): string {
  // Remove DXF formatting codes like \P (paragraph), \f (font), %%d (degree symbol)
  return raw
    .replace(/\\P/g, " ")
    .replace(/\\f[^;]*;/g, "")
    .replace(/%%[a-zA-Z]/g, "°")
    .replace(/[{}]/g, "")
    .trim();
}

function dedup<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
