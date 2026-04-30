/**
 * DXF Geometry Extractor
 *
 * Parses real coordinates from a DXF file to compute:
 *  - Closed LWPOLYLINE areas (shoelace formula) per layer
 *  - LINE entity lengths per layer
 *  - CIRCLE areas per layer
 *  - $INSUNITS from HEADER for unit conversion to metres
 *
 * DXF group code reference (relevant codes used here):
 *   0  = entity type
 *   8  = layer name
 *   10 = X coordinate (start X for LINE; vertex X for LWPOLYLINE)
 *   11 = end X for LINE
 *   20 = Y coordinate (start Y for LINE; vertex Y for LWPOLYLINE)
 *   21 = end Y for LINE
 *   40 = radius for CIRCLE; bulge for LWPOLYLINE vertex
 *   70 = flags (for LWPOLYLINE: bit 1 = closed polygon)
 *   90 = vertex count for LWPOLYLINE
 *   9  = variable name in HEADER section ($INSUNITS)
 * Header variable $INSUNITS values:
 *   4  = millimetres  → factor = 0.001
 *   6  = metres       → factor = 1.0
 *   (default: 1 for mm in Autocad, treated as unitless)
 */

export interface DxfGeometrySummary {
  totalAreaM2: number;
  totalLinearM: number;
  areasByLayer: { layer: string; areaM2: number }[];
  linearByLayer: { layer: string; totalM: number }[];
  unitFactor: number;
}

interface Vertex {
  x: number;
  y: number;
}

export function extractDxfGeometry(lines: string[]): DxfGeometrySummary {
  const unitFactor = parseInsUnits(lines);

  const areaByLayer: Map<string, number> = new Map();
  const linearByLayer: Map<string, number> = new Map();

  let i = 0;
  let currentEntity = "";
  let currentLayer = "0";

  // LWPOLYLINE state
  let lwVertices: Vertex[] = [];
  let lwIsClosed = false;

  // LINE state
  let lineX0 = 0, lineY0 = 0, lineX1 = 0, lineY1 = 0;

  // CIRCLE state
  let circleRadius = 0;
  let circleLayer = "0";

  function flushEntity() {
    if (currentEntity === "LWPOLYLINE" && lwVertices.length >= 3 && lwIsClosed) {
      const area = shoelace(lwVertices) * unitFactor * unitFactor;
      areaByLayer.set(currentLayer, (areaByLayer.get(currentLayer) ?? 0) + area);
    }

    if (currentEntity === "LINE") {
      const dx = (lineX1 - lineX0) * unitFactor;
      const dy = (lineY1 - lineY0) * unitFactor;
      const length = Math.sqrt(dx * dx + dy * dy);
      linearByLayer.set(currentLayer, (linearByLayer.get(currentLayer) ?? 0) + length);
    }

    if (currentEntity === "CIRCLE" && circleRadius > 0) {
      const area = Math.PI * (circleRadius * unitFactor) ** 2;
      areaByLayer.set(circleLayer, (areaByLayer.get(circleLayer) ?? 0) + area);
    }

    lwVertices = [];
    lwIsClosed = false;
    lineX0 = lineY0 = lineX1 = lineY1 = 0;
    circleRadius = 0;
  }

  while (i < lines.length) {
    const code = parseInt(lines[i]?.trim() ?? "", 10);
    const value = (lines[i + 1] ?? "").trim();
    i += 2;

    if (isNaN(code)) continue;

    if (code === 0) {
      flushEntity();
      currentEntity = value.toUpperCase();
      circleLayer = currentLayer; // capture layer before it may change
      continue;
    }

    switch (code) {
      case 8:
        currentLayer = value;
        if (currentEntity === "CIRCLE") circleLayer = value;
        break;

      // LWPOLYLINE flags (bit 1 = closed)
      case 70:
        if (currentEntity === "LWPOLYLINE") {
          lwIsClosed = (parseInt(value, 10) & 1) === 1;
        }
        break;

      // Vertex X (LWPOLYLINE) or start X (LINE)
      case 10:
        if (currentEntity === "LWPOLYLINE") {
          lwVertices.push({ x: parseFloat(value), y: 0 });
        } else if (currentEntity === "LINE") {
          lineX0 = parseFloat(value);
        }
        break;

      // Vertex Y (LWPOLYLINE) or start Y (LINE)
      case 20:
        if (currentEntity === "LWPOLYLINE" && lwVertices.length > 0) {
          lwVertices[lwVertices.length - 1]!.y = parseFloat(value);
        } else if (currentEntity === "LINE") {
          lineY0 = parseFloat(value);
        }
        break;

      // End X (LINE)
      case 11:
        if (currentEntity === "LINE") lineX1 = parseFloat(value);
        break;

      // End Y (LINE)
      case 21:
        if (currentEntity === "LINE") lineY1 = parseFloat(value);
        break;

      // Radius (CIRCLE)
      case 40:
        if (currentEntity === "CIRCLE") circleRadius = parseFloat(value);
        break;
    }
  }

  flushEntity();

  const areasByLayer = Array.from(areaByLayer.entries())
    .map(([layer, areaM2]) => ({ layer, areaM2: round4(areaM2) }))
    .filter((e) => e.areaM2 > 0)
    .sort((a, b) => b.areaM2 - a.areaM2);

  const linearByLayerArr = Array.from(linearByLayer.entries())
    .map(([layer, totalM]) => ({ layer, totalM: round4(totalM) }))
    .filter((e) => e.totalM > 0)
    .sort((a, b) => b.totalM - a.totalM);

  const totalAreaM2 = round4(areasByLayer.reduce((s, e) => s + e.areaM2, 0));
  const totalLinearM = round4(linearByLayerArr.reduce((s, e) => s + e.totalM, 0));

  return { totalAreaM2, totalLinearM, areasByLayer, linearByLayer: linearByLayerArr, unitFactor };
}

/** Signed area via the shoelace formula (returns absolute value). */
function shoelace(pts: Vertex[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Read $INSUNITS from the DXF HEADER section. */
function parseInsUnits(lines: string[]): number {
  let inHeader = false;
  let expectInsUnits = false;

  for (let i = 0; i < lines.length; i += 2) {
    const code = parseInt(lines[i]?.trim() ?? "", 10);
    const value = (lines[i + 1] ?? "").trim();
    if (isNaN(code)) continue;

    if (code === 0 && value === "SECTION") inHeader = false;
    if (code === 2 && value === "HEADER") { inHeader = true; continue; }
    if (code === 0 && inHeader && value === "ENDSEC") break;

    if (!inHeader) continue;

    if (code === 9 && value === "$INSUNITS") { expectInsUnits = true; continue; }
    if (expectInsUnits && code === 70) {
      const units = parseInt(value, 10);
      if (units === 4) return 0.001; // mm → m
      if (units === 6) return 1.0;   // m → m
      if (units === 2) return 0.0254; // inches → m
      return 0.001; // unknown: assume mm
    }
  }

  return 0.001; // default: assume mm (most common in Autocad)
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
