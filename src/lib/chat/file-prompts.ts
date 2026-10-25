import type { UploadResponse } from "@/lib/validators/api-responses";

/**
 * Mensajes que el chat envía al agente cuando se adjunta un archivo. La primera
 * línea (`__file_meta__:{json}`) la usa la UI para dibujar la tarjeta del
 * archivo y el agente para leer metadatos como el `cacheId`.
 */

const MAX_DOC_CHARS = 8000;

function fileMeta(file: UploadResponse): string {
  const meta: Record<string, unknown> = { fileName: file.fileName, type: file.type, fileSize: file.fileSize };
  if (file.type === "excel") {
    Object.assign(meta, { itemCount: file.itemCount, sheetName: file.sheetName, cacheId: file.cacheId ?? undefined });
    if (file.detectedTotal != null) meta.detectedTotal = file.detectedTotal;
  } else if (file.type === "pdf") {
    Object.assign(meta, { pageCount: file.pageCount, isScanned: file.isScanned });
  } else if (file.type === "docx") {
    meta.wordCount = file.wordCount;
  }
  if (file.contextScan?.hasFindings) {
    meta.contextFindings = file.contextScan.findings.map((f) => ({
      type: f.type,
      severity: f.severity,
      message: f.message,
      relatedFileName: f.relatedFileName,
      deltaPct: f.evidence.deltaPct,
    }));
  }
  return `__file_meta__:${JSON.stringify(meta)}`;
}

/** Quita caracteres de control y limita el largo de nombres de archivo. */
function safeStr(s: string, max = 120): string {
  return s.replace(/[\x00-\x1f\x7f]/g, "").slice(0, max);
}

/**
 * Filtra patrones habituales de inyección de instrucciones en el texto de un
 * documento. Es una mitigación parcial: la defensa real es que las tools fijan
 * la organización del lado del servidor.
 */
function sanitizeDocText(text: string): string {
  const clean = text
    .replace(/ignore\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompt|context|directives?)/gi, "[filtrado]")
    .replace(/<\|(?:im_start|im_end|system|endoftext)\|>/gi, "")
    .replace(/\[INST\]|\[\/INST\]/gi, "")
    .replace(/^\s*#{1,3}\s*(system|assistant|user|instruction|override|reset|forget)\b.*$/gim, "");
  return clean.length > MAX_DOC_CHARS ? `${clean.slice(0, MAX_DOC_CHARS)}\n[texto truncado]` : clean;
}

export function buildFilePrompt(file: UploadResponse): string {
  const name = safeStr(file.fileName);
  switch (file.type) {
    case "excel": {
      const total = file.detectedTotal != null ? ` Total declarado: $${file.detectedTotal.toLocaleString("es-AR")}.` : "";
      const data = file.cacheId
        ? `cacheId: "${file.cacheId}".`
        : `Ítems:\n\`\`\`json\n${JSON.stringify(file.items)}\n\`\`\``;
      return `${fileMeta(file)}
Excel "${name}", hoja "${safeStr(file.sheetName ?? "")}", ${file.itemCount} ítems.${total}
${data}
Identificá qué es (presupuesto, cómputo, lista de precios, certificado u otro). Si es un presupuesto o cómputo, auditalo con las herramientas de cálculo.`;
    }
    case "pdf":
      if (file.isScanned) {
        return `${fileMeta(file)}
PDF escaneado "${name}" (${file.pageCount} páginas), sin texto extraíble. Indicá qué se puede inferir y qué haría falta para analizarlo.`;
      }
      return `${fileMeta(file)}
PDF "${name}" (${file.pageCount} páginas). Texto extraído:
---
${sanitizeDocText(file.text)}
---
Identificá qué documento es y extraé los datos relevantes para la obra.`;
    case "docx":
      return `${fileMeta(file)}
Documento Word "${name}" (${file.wordCount} palabras):
---
${sanitizeDocText(file.text)}
---
Identificá qué documento es y extraé los datos relevantes para la obra.`;
    case "dxf": {
      const entities = Object.entries(file.entitySummary).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(", ");
      const dims = file.dimensions.slice(0, 20).map((d) => `- ${d.layer}: "${d.text}"${d.value != null ? ` = ${d.value}` : ""}`).join("\n");
      return `${fileMeta(file)}
Plano DXF "${name}".
Capas: ${file.layers.join(", ") || "ninguna"}
Entidades: ${entities || "ninguna"}
Cotas (primeras 20):
${dims || "- ninguna"}
Textos: ${file.textAnnotations.slice(0, 30).join(", ") || "ninguno"}
Resumen geométrico: ${JSON.stringify(file.geometrySummary)}
Identificá el tipo de plano y armá el cómputo métrico con analizar_geometria_plano.`;
    }
    default:
      return `${fileMeta(file)}\nArchivo "${name}" adjunto.`;
  }
}

export function buildImagePrompt(fileName: string): string {
  return `__file_meta__:${JSON.stringify({ fileName, type: "image" })}
Imagen "${safeStr(fileName)}" adjunta. Describí qué muestra y qué datos útiles para la obra contiene.`;
}

type ExcelUpload = Extract<UploadResponse, { type: "excel" }>;

export function buildComparisonPrompt(a: ExcelUpload, b: ExcelUpload): string {
  const describe = (label: string, f: ExcelUpload) => {
    const total = f.detectedTotal != null ? `, total declarado $${f.detectedTotal.toLocaleString("es-AR")}` : "";
    const source = f.cacheId ? `cacheId="${f.cacheId}"` : "ítems no disponibles en caché";
    return `- ${label}: "${safeStr(f.fileName)}", ${f.itemCount} ítems${total}, ${source}`;
  };
  return `${fileMeta(a)}
${fileMeta(b)}
Comparación de dos versiones de un presupuesto.
${describe("A", a)}
${describe("B", b)}
Para cada versión: calcular_totales, validar_cierre_de_total (si hay total declarado) y detectar_exclusiones_logicas. Después usá comparar_presupuestos con total declarado, costo directo, cantidad de ítems, errores y advertencias, y resumí qué cambió y cuál versión es más confiable.`;
}
