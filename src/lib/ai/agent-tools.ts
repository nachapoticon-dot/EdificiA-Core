import { tool } from "ai";
import { z } from "zod";
import {
  budgetItemSchema,
  calcularIncidenciaInputSchema,
  type BudgetItem,
} from "@/lib/math-engine/validators";
import {
  calcularTotalLinea,
  calcularCostoDirecto,
} from "@/lib/math-engine/calculator";
import {
  validarCierreDeTotal,
  detectarExclusionesLogicas,
  calcularIncidenciaDeSubgrupo,
} from "@/lib/math-engine/auditor";
import { getItems } from "@/lib/file-cache";
import type { DxfGeometrySummary } from "@/lib/file-processor/types";
import { geometrySummarySchema, chartDataSchema } from "./agent-prompt";

const LAYER_MAP: [string[], string][] = [
  [["muro", "wall", "pared"], "Muros"],
  [["losa", "slab", "techo"], "Losas/Techos"],
  [["piso", "floor"], "Pisos"],
  [["local", "habitación", "room"], "Locales"],
  [["viga", "beam"], "Vigas"],
  [["column"], "Columnas"],
  [["puerta", "door", "ventana", "window"], "Aberturas"],
  [["exterior", "fachada"], "Fachada/Exterior"],
];
function interpretLayerName(layer: string): string {
  const lower = layer.toLowerCase();
  return LAYER_MAP.find(([keys]) => keys.some((k) => lower.includes(k)))?.[1] ?? layer;
}

const CACHE_ERR = { error: "No se encontraron datos del presupuesto. El caché puede haber expirado — volvé a subir el archivo." };

const cacheOrItemsSchema = z.object({
  cacheId: z.string().optional().describe("ID de caché del archivo (preferido — omitir items cuando está disponible)"),
  items:   z.array(budgetItemSchema).optional().describe("Ítems del presupuesto (solo si no hay cacheId)"),
});

async function resolveItems(input: { cacheId?: string; items?: BudgetItem[] }): Promise<BudgetItem[] | null> {
  if (input.cacheId) return getItems(input.cacheId);
  return input.items ?? null;
}

export const agentTools = {
  calcular_totales: tool({
    description:
      "Calcula los totales individuales de cada ítem y el costo directo total del presupuesto. Pasá cacheId cuando el archivo fue subido en esta sesión (es más rápido y eficiente que pasar todos los ítems).",
    inputSchema: cacheOrItemsSchema.extend({
      declaredTotal: z.number().optional().describe("Total declarado para comparación (opcional)"),
    }),
    execute: async (input: { cacheId?: string; items?: BudgetItem[]; declaredTotal?: number }) => {
      const items = await resolveItems(input);
      if (!items) return CACHE_ERR;
      const lineTotals = items.map(calcularTotalLinea);
      const computedTotal = calcularCostoDirecto(items);
      const diff = input.declaredTotal != null
        ? Math.round((input.declaredTotal - computedTotal) * 100) / 100
        : null;
      return { computedTotal, declaredTotal: input.declaredTotal ?? null, difference: diff, lineTotals, itemCount: items.length };
    },
  }),

  validar_cierre_de_total: tool({
    description:
      "Verifica que la suma de los ítems coincida con el total declarado del presupuesto. Detecta errores de redondeo y líneas mal calculadas. Úsalo para auditar si el presupuesto 'cierra' correctamente.",
    inputSchema: cacheOrItemsSchema.extend({
      declaredTotal:  z.number().describe("Total declarado en el presupuesto a auditar"),
      tolerancePct:   z.number().min(0).max(0.1).optional().describe("Tolerancia máxima (default 0.5% = 0.005)"),
    }),
    execute: async (input: { cacheId?: string; items?: BudgetItem[]; declaredTotal: number; tolerancePct?: number }) => {
      const items = await resolveItems(input);
      if (!items) return CACHE_ERR;
      return validarCierreDeTotal(items, input.declaredTotal, input.tolerancePct);
    },
  }),

  detectar_exclusiones_logicas: tool({
    description:
      "Encuentra inconsistencias estructurales en el presupuesto. Ejecuta 9 reglas: subcontrato+mano de obra, precio cero, total mal calculado, cantidad cero, códigos duplicados, ítems de porcentaje, valores negativos, precios redondos sospechosos, y outliers estadísticos de precio. Úsalo en toda auditoría.",
    inputSchema: cacheOrItemsSchema,
    execute: async (input: { cacheId?: string; items?: BudgetItem[] }) => {
      const items = await resolveItems(input);
      if (!items) return CACHE_ERR;
      const issues = detectarExclusionesLogicas(items);
      const byseverity = {
        error:   issues.filter((i) => i.severity === "error"),
        warning: issues.filter((i) => i.severity === "warning"),
        info:    issues.filter((i) => i.severity === "info"),
      };
      return {
        totalIssues: issues.length,
        byseverity,
        ok: issues.filter((i) => i.severity !== "info").length === 0,
        resumen: issues.length === 0
          ? "✓ No se detectaron inconsistencias en el presupuesto."
          : `Encontradas ${byseverity.error.length} errores, ${byseverity.warning.length} advertencias, ${byseverity.info.length} observaciones.`,
      };
    },
  }),

  calcular_incidencia_de_subgrupo: tool({
    description:
      "Calcula qué porcentaje del total del proyecto representa un subgrupo de ítems (ej. todos los subcontratos, o todos los ítems de albañilería). Úsalo para analizar la composición y el peso de cada rubro.",
    inputSchema: calcularIncidenciaInputSchema,
    execute: async (input: {
      items: BudgetItem[];
      subgroupCodes: string[];
      grandTotal: number;
    }) => {
      return calcularIncidenciaDeSubgrupo(
        input.items,
        input.subgroupCodes,
        input.grandTotal,
      );
    },
  }),

  analizar_geometria_plano: tool({
    description:
      "Analiza la geometría real de un plano DXF (áreas y longitudes por capa) y produce un cómputo métrico básico. Úsalo cuando el usuario sube un archivo DXF para extraer metros cuadrados de locales, perímetros de cerramientos, etc.",
    inputSchema: z.object({
      layers: z.array(z.string()).describe("Capas del plano"),
      geometrySummary: geometrySummarySchema.describe("Resumen geométrico extraído del DXF"),
    }),
    execute: async (input: { layers: string[]; geometrySummary: DxfGeometrySummary }) => {
      const { geometrySummary, layers } = input;

      const quantityTakeoff = geometrySummary.areasByLayer.map((e) => ({
        element: interpretLayerName(e.layer),
        layer: e.layer,
        qty: e.areaM2,
        unit: "m²",
      })).concat(
        geometrySummary.linearByLayer.map((e) => ({
          element: interpretLayerName(e.layer),
          layer: e.layer,
          qty: e.totalM,
          unit: "ml",
        }))
      );

      const hasGeometry = geometrySummary.totalAreaM2 > 0 || geometrySummary.totalLinearM > 0;

      return {
        hasGeometry,
        totalAreaM2: geometrySummary.totalAreaM2,
        totalLinearM: geometrySummary.totalLinearM,
        unitFactor: geometrySummary.unitFactor,
        unitDescription: geometrySummary.unitFactor === 1 ? "metros" : "milímetros (convertido a metros)",
        quantityTakeoff,
        layerCount: layers.length,
        interpretation: hasGeometry
          ? `Plano con ${geometrySummary.totalAreaM2.toFixed(2)} m² de área total en ${geometrySummary.areasByLayer.length} capa(s), y ${geometrySummary.totalLinearM.toFixed(2)} ml de elementos lineales.`
          : "No se detectaron polígonos cerrados ni líneas con coordenadas. El plano puede contener solo bloques o símbolos sin geometría vectorial extraíble.",
      };
    },
  }),

  comparar_computo_con_plano: tool({
    description:
      "Cruza las cantidades declaradas en un presupuesto con las medidas reales extraídas del plano DXF. Detecta discrepancias entre lo que dice el presupuesto y lo que mide el plano.",
    inputSchema: z.object({
      budgetItems: z.array(z.object({
        code: z.string(),
        description: z.string(),
        unit: z.string(),
        quantity: z.number(),
      })).describe("Ítems del presupuesto con sus cantidades"),
      planGeometry: geometrySummarySchema.describe("Geometría extraída del plano DXF"),
    }),
    execute: async (input: {
      budgetItems: { code: string; description: string; unit: string; quantity: number }[];
      planGeometry: DxfGeometrySummary;
    }) => {
      const { budgetItems, planGeometry } = input;

      const areaItems   = budgetItems.filter((i) => ["m2", "m²", "M2", "M²"].includes(i.unit));
      const linearItems = budgetItems.filter((i) => ["ml", "m", "ML", "M"].includes(i.unit));

      const totalBudgetArea   = areaItems.reduce((s, i) => s + i.quantity, 0);
      const totalBudgetLinear = linearItems.reduce((s, i) => s + i.quantity, 0);

      const areaDelta   = planGeometry.totalAreaM2 > 0  ? totalBudgetArea   - planGeometry.totalAreaM2   : null;
      const linearDelta = planGeometry.totalLinearM > 0 ? totalBudgetLinear - planGeometry.totalLinearM  : null;

      const discrepancies: string[] = [];
      if (areaDelta !== null && Math.abs(areaDelta) / (planGeometry.totalAreaM2 || 1) > 0.05) {
        discrepancies.push(
          `Área: presupuesto declara ${totalBudgetArea.toFixed(2)} m², plano mide ${planGeometry.totalAreaM2.toFixed(2)} m² (diferencia: ${areaDelta > 0 ? "+" : ""}${areaDelta.toFixed(2)} m²)`
        );
      }
      if (linearDelta !== null && Math.abs(linearDelta) / (planGeometry.totalLinearM || 1) > 0.05) {
        discrepancies.push(
          `Longitud: presupuesto declara ${totalBudgetLinear.toFixed(2)} ml, plano mide ${planGeometry.totalLinearM.toFixed(2)} ml (diferencia: ${linearDelta > 0 ? "+" : ""}${linearDelta.toFixed(2)} ml)`
        );
      }

      const coveragePct = planGeometry.totalAreaM2 > 0
        ? Math.round((totalBudgetArea / planGeometry.totalAreaM2) * 100)
        : null;

      return {
        budgetAreaItems:     areaItems.length,
        budgetLinearItems:   linearItems.length,
        totalBudgetAreaM2:   totalBudgetArea,
        totalBudgetLinearM:  totalBudgetLinear,
        totalPlanAreaM2:     planGeometry.totalAreaM2,
        totalPlanLinearM:    planGeometry.totalLinearM,
        coveragePct,
        discrepancies,
        ok: discrepancies.length === 0,
      };
    },
  }),

  generar_grafica: tool({
    description:
      "Genera una gráfica animada con los datos especificados. Úsala para mostrar: incidencia de rubros (pie o bar), comparativa de precios (bar), evolución de costos (line). El frontend renderiza la gráfica automáticamente. Máximo 12 puntos de datos.",
    inputSchema: chartDataSchema,
    execute: async (input) => ({
      chartType: input.type,
      title: input.title,
      data: input.data.slice(0, 12),
      unit: input.unit ?? "",
      rendered: true,
    }),
  }),

  buscar_en_base_documental: tool({
    description:
      "Busca información en la base documental de la empresa (planos, presupuestos, remitos, memorias, etc.). Úsala antes de responder preguntas sobre proyectos anteriores, formatos que usa la empresa, o cualquier dato que pueda estar en documentos subidos. La búsqueda es semántica cuando hay embeddings disponibles, o por texto si no.",
    inputSchema: z.object({
      query:          z.string().describe("Consulta de búsqueda en lenguaje natural"),
      organizationId: z.string().describe("ID de la organización activa"),
      projectId:      z.string().optional().describe("ID del proyecto activo — limita la búsqueda a documentos de esa obra"),
      topK:           z.number().int().min(1).max(10).optional().describe("Cantidad de resultados (default 5)"),
    }),
    execute: async (input: { query: string; organizationId: string; projectId?: string; topK?: number }) => {
      const { searchDocuments } = await import("@/lib/rag/search");
      const results = await searchDocuments(input.query, {
        organizationId: input.organizationId,
        projectId: input.projectId,
        topK: input.topK ?? 5,
      });

      if (results.length === 0) {
        return {
          found: false,
          message: "No se encontraron documentos relevantes en la base documental para esa consulta.",
          results: [],
        };
      }

      return {
        found: true,
        count: results.length,
        results: results.map((r) => ({
          fileName:     r.fileName,
          documentType: r.documentType,
          excerpt:      r.chunkText.slice(0, 800),
          score:        Math.round(r.score * 100) / 100,
        })),
      };
    },
  }),

  sugerir_formato: tool({
    description:
      "Sugiere mejoras de formato basadas en patrones aprendidos de otras empresas constructoras (datos anónimos). Úsalo cuando el usuario quiera saber si su formato de presupuesto es estándar, si le falta algún rubro típico del sector, o si sus precios están en el rango esperado. Requiere que la empresa haya subido al menos un Excel previamente.",
    inputSchema: z.object({
      documentType:    z.enum(["excel", "pdf", "dxf", "docx"]).describe("Tipo de documento a comparar"),
      organizationId:  z.string().describe("ID de la organización activa"),
      currentPatterns: z.record(z.unknown()).optional().describe("Patrones del documento actual (price_ranges, column_aliases, etc.)"),
    }),
    execute: async (input: {
      documentType: "excel" | "pdf" | "dxf" | "docx";
      organizationId: string;
      currentPatterns?: Record<string, unknown>;
    }) => {
      const { searchCrossCompanyPatterns } = await import("@/lib/pattern-extractor/benchmarks");
      return searchCrossCompanyPatterns(input.documentType, input.organizationId, input.currentPatterns);
    },
  }),

  generar_archivo: tool({
    description:
      "Propone guardar un archivo generado por el agente en la base documental de la empresa. IMPORTANTE: esto NO guarda el archivo directamente — el usuario debe revisar y confirmar. Usá esta herramienta cuando hayas generado un cómputo, remito, tabla o cualquier documento listo para guardar.",
    inputSchema: z.object({
      fileName:       z.string().describe("Nombre del archivo propuesto (con extensión, ej. 'computo_yeso_planta_baja.txt')"),
      content:        z.string().describe("Contenido del archivo en texto plano"),
      description:    z.string().describe("Descripción breve de qué contiene el archivo y por qué se generó"),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input: { fileName: string; content: string; description: string; organizationId: string }) => ({
      type: "file_proposal" as const,
      fileName: input.fileName,
      content: Buffer.from(input.content).toString("base64"),
      contentType: "text/plain",
      description: input.description,
      organizationId: input.organizationId,
      awaiting_confirmation: true,
    }),
  }),

  analizar_estado_obra: tool({
    description:
      "Analiza el estado documental de un proyecto de obra. Devuelve qué fases tienen documentación completa, cuáles están incompletas y cuáles no tienen nada. Úsala al inicio de cada sesión cuando hay un proyecto activo, o cuando el usuario pregunte '¿qué falta?', '¿cuál es el siguiente paso?', etc.",
    inputSchema: z.object({
      projectId:      z.string().describe("UUID del proyecto activo"),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input: { projectId: string; organizationId: string }) => {
      const { getCoverageForProject } = await import("@/lib/obra/coverage");
      return getCoverageForProject(input.projectId, input.organizationId);
    },
  }),

  reportar_hallazgo: tool({
    description:
      "Reporta UN solo hallazgo puntual. Usá reportar_hallazgos_batch cuando tenés múltiples hallazgos — es más eficiente (un solo step).",
    inputSchema: z.object({
      code:     z.string().describe("Código del hallazgo (ej: 'ERR-001', 'WARN-003', 'INFO-01')"),
      severity: z.enum(["error", "warning", "info"]).describe("Severidad"),
      title:    z.string().describe("Título breve del hallazgo (máx 60 caracteres)"),
      detail:   z.string().describe("Descripción clara del problema o situación detectada"),
      impact:   z.string().optional().describe("Impacto económico estimado (ej: '$45.000 de diferencia en cómputo')"),
      item:     z.string().optional().describe("Ítem o referencia exacta del documento afectado"),
    }),
    execute: async (input) => ({
      type: "finding_callout" as const,
      ...input,
    }),
  }),

  reportar_hallazgos_batch: tool({
    description:
      "Reporta TODOS los hallazgos de la auditoría en un solo paso. PREFERÍ esta herramienta sobre reportar_hallazgo cuando tenés 2+ hallazgos — ahorra pasos del agente y evita cortes por límite de steps. Llamala UNA VEZ con todos los hallazgos antes del resumen ejecutivo.",
    inputSchema: z.object({
      hallazgos: z.array(z.object({
        code:     z.string().describe("Código del hallazgo (ej: 'ERR-001')"),
        severity: z.enum(["error", "warning", "info"]).describe("Severidad"),
        title:    z.string().describe("Título breve (máx 60 chars)"),
        detail:   z.string().describe("Descripción del problema"),
        impact:   z.string().optional().describe("Impacto económico"),
        item:     z.string().optional().describe("Ítem o referencia afectada"),
      })).describe("Lista de todos los hallazgos de la auditoría"),
    }),
    execute: async (input) => ({
      type: "finding_batch" as const,
      hallazgos: input.hallazgos.map((h) => ({ type: "finding_callout" as const, ...h })),
      count: input.hallazgos.length,
      errorCount:   input.hallazgos.filter((h) => h.severity === "error").length,
      warningCount: input.hallazgos.filter((h) => h.severity === "warning").length,
      infoCount:    input.hallazgos.filter((h) => h.severity === "info").length,
    }),
  }),

  generar_presupuesto_excel: tool({
    description:
      "Genera un presupuesto de obra en formato .xlsx listo para descargar. Úsalo cuando el usuario pide 'haceme un presupuesto', 'generá la planilla', 'exportá los ítems en Excel', etc. Si el archivo fue subido en esta sesión, pasá cacheId (más eficiente que re-listar todos los ítems).",
    inputSchema: z.object({
      obraName: z.string().describe("Nombre de la obra o proyecto"),
      cacheId:  z.string().optional().describe("ID de caché del archivo Excel subido — preferido cuando está disponible"),
      items: z.array(z.object({
        code:        z.string().describe("Código del ítem (ej. '1.1', 'MOB-01')"),
        description: z.string().describe("Descripción del ítem"),
        quantity:    z.number().describe("Cantidad"),
        unit:        z.string().describe("Unidad de medida (m², ml, un, hs, kg, etc.)"),
        unitPrice:   z.number().describe("Precio unitario en pesos"),
        group:       z.string().optional().describe("Rubro o capítulo al que pertenece el ítem"),
      })).optional().describe("Ítems del presupuesto — omitir si se pasa cacheId"),
      notes:          z.string().optional().describe("Notas o aclaraciones al pie del presupuesto"),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input) => {
      let items = input.items ?? [];
      if (input.cacheId && items.length === 0) {
        const cached = await getItems(input.cacheId);
        if (cached) items = cached;
      }
      const safeDate = new Date().toISOString().slice(0, 10);
      const safeName = input.obraName.replace(/\s+/g, "_").slice(0, 40);
      return {
        type:        "doc_generation_proposal" as const,
        docType:     "presupuesto_excel" as const,
        fileName:    `Presupuesto_${safeName}_${safeDate}`,
        description: `Presupuesto de obra "${input.obraName}" · ${items.length} ítems`,
        payload: {
          obraName: input.obraName,
          items,
          notes:    input.notes,
        },
        organizationId: input.organizationId,
      };
    },
  }),

  generar_memoria_descriptiva: tool({
    description:
      "Genera una memoria descriptiva de obra en formato .docx listo para descargar. Úsalo cuando el usuario pide 'escribí la memoria', 'generá el informe de obra', 'armá la memoria descriptiva'. Podés estructurar la memoria con las secciones que el usuario indique o con las estándar (descripción general, alcance de obra, materiales, plazos, observaciones).",
    inputSchema: z.object({
      obraName: z.string().describe("Nombre de la obra"),
      sections: z.array(z.object({
        title:   z.string().describe("Título de la sección (ej. 'Descripción general', 'Materiales')"),
        content: z.string().describe("Contenido de la sección en texto libre"),
      })).describe("Secciones de la memoria descriptiva"),
      redactor:       z.string().optional().describe("Nombre del profesional redactor"),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input) => {
      const safeDate = new Date().toISOString().slice(0, 10);
      const safeName = input.obraName.replace(/\s+/g, "_").slice(0, 40);
      return {
        type:        "doc_generation_proposal" as const,
        docType:     "memoria_descriptiva" as const,
        fileName:    `Memoria_${safeName}_${safeDate}`,
        description: `Memoria descriptiva de "${input.obraName}" · ${input.sections.length} secciones`,
        payload: {
          obraName:  input.obraName,
          sections:  input.sections,
          redactor:  input.redactor,
        },
        organizationId: input.organizationId,
      };
    },
  }),

  comparar_con_indices: tool({
    description:
      "Compara los precios del presupuesto actual con los índices de referencia disponibles: lista de precios propia de la empresa, índice CAC e índice INDEC. Agrupa los ítems por categoría de obra y detecta desviaciones significativas. Úsalo cuando el usuario pregunte si los precios son correctos, están actualizados o en línea con el mercado.",
    inputSchema: z.object({
      items: z.array(z.object({
        code:        z.string(),
        description: z.string(),
        unit:        z.string(),
        unitPrice:   z.number(),
        quantity:    z.number(),
      })).describe("Ítems del presupuesto a comparar"),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input) => {
      const { compareItemsWithIndices } = await import("@/lib/indices/compare");
      const comparisons = await compareItemsWithIndices(input.items, input.organizationId);

      if (comparisons.length === 0) {
        return {
          found: false,
          message: "No hay índices de referencia cargados para las categorías de este presupuesto. Podés cargar listas de precios desde el panel de Administración → Índices de Precio.",
          comparisons: [],
        };
      }

      const hasAlerts  = comparisons.some(c => c.alert === "over" || c.alert === "under");
      const overCount  = comparisons.filter(c => c.alert === "over").length;
      const underCount = comparisons.filter(c => c.alert === "under").length;

      return {
        found: true,
        categoryCount: comparisons.length,
        hasAlerts,
        overCount,
        underCount,
        comparisons: comparisons.map(c => ({
          category:       c.categoryLabel,
          itemCount:      c.itemCount,
          avgBudgetPrice: c.avgBudgetPrice,
          companyRef:     c.companyIndex ? { avg: c.companyIndex.value_avg, source: c.companyIndex.source, period: `${c.companyIndex.period_month ?? "?"}/${c.companyIndex.period_year}` } : null,
          cacRef:         c.cacIndex     ? { avg: c.cacIndex.value_avg,     period: `${c.cacIndex.period_month ?? "?"}/${c.cacIndex.period_year}` }     : null,
          indecRef:       c.indecIndex   ? { avg: c.indecIndex.value_avg,   period: `${c.indecIndex.period_month ?? "?"}/${c.indecIndex.period_year}` } : null,
          deviationPct:   c.deviationPct,
          alert:          c.alert,
        })),
        summary: hasAlerts
          ? `${overCount > 0 ? `${overCount} categoría(s) con precios por encima del índice de referencia` : ""}${overCount > 0 && underCount > 0 ? " y " : ""}${underCount > 0 ? `${underCount} categoría(s) por debajo` : ""}. Revisá las categorías marcadas.`
          : "Todos los precios están dentro del rango de referencia (±15%).",
      };
    },
  }),

  generar_informe_pdf: tool({
    description:
      "Genera un informe de auditoría profesional en formato .pdf listo para descargar. Úsalo al final de una auditoría completa cuando el usuario pide 'generá el informe', 'exportá en PDF', 'dame el reporte formal'. Incluye KPIs, tabla de ítems y hallazgos con severidades.",
    inputSchema: z.object({
      title:         z.string().describe("Título del informe (ej. 'Presupuesto Torre Alvear — Revisión Mayo 2026')"),
      veredicto:     z.enum(["Aprobado", "Observado", "Requiere revisión"]).describe("Veredicto final de la auditoría"),
      computedTotal: z.number().optional().describe("Costo directo calculado por la herramienta calcular_totales"),
      declaredTotal: z.number().optional().describe("Total declarado en el presupuesto original"),
      difference:    z.number().optional().describe("Diferencia entre total declarado y calculado"),
      items: z.array(z.object({
        code:        z.string(),
        description: z.string(),
        quantity:    z.number(),
        unit:        z.string(),
        unitPrice:   z.number(),
        lineTotal:   z.number(),
      })).optional().describe("Ítems del presupuesto con sus totales calculados"),
      findings: z.array(z.object({
        severity: z.enum(["error", "warning", "info"]),
        code:     z.string().describe("Código del hallazgo (ERR-001, WARN-002, etc.)"),
        title:    z.string(),
        detail:   z.string(),
        impact:   z.string().optional(),
        item:     z.string().optional(),
      })).optional().describe("Hallazgos detectados por reportar_hallazgo o detectar_exclusiones_logicas"),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input) => {
      const safeDate = new Date().toISOString().slice(0, 10);
      const safeName = input.title.replace(/\s+/g, "_").slice(0, 40);
      return {
        type:        "doc_generation_proposal" as const,
        docType:     "informe_pdf" as const,
        fileName:    `Informe_${safeName}_${safeDate}`,
        description: `Informe de auditoría · ${input.veredicto} · ${input.findings?.length ?? 0} hallazgos`,
        payload: {
          title:         input.title,
          veredicto:     input.veredicto,
          computedTotal: input.computedTotal,
          declaredTotal: input.declaredTotal,
          difference:    input.difference,
          items:         input.items,
          findings:      input.findings,
        },
        organizationId: input.organizationId,
      };
    },
  }),

  comparar_presupuestos: tool({
    description:
      "Genera una tabla comparativa visual entre dos conjuntos de datos (dos versiones de presupuesto, presupuesto vs. promedio sector, presupuesto vs. cómputo del plano, etc.). Úsala siempre que tengas datos para comparar en vez de listar diferencias en texto.",
    inputSchema: z.object({
      title:   z.string().describe("Título de la comparación"),
      columnA: z.string().describe("Nombre de la primera columna (ej: 'Presupuesto actual')"),
      columnB: z.string().describe("Nombre de la segunda columna (ej: 'Referencia sector')"),
      rows: z.array(z.object({
        label:  z.string().describe("Concepto o rubro"),
        valueA: z.number().nullable().describe("Valor de la columna A (null si no existe)"),
        valueB: z.number().nullable().describe("Valor de la columna B (null si no existe)"),
        unit:   z.string().optional().describe("Unidad (ej: '%', 'm²', '$') — omitir para moneda"),
      })).describe("Filas de la comparación"),
    }),
    execute: async (input) => {
      const rows = input.rows.map((r) => {
        const delta = r.valueA !== null && r.valueB !== null ? r.valueA - r.valueB : null;
        const deltaPct =
          delta !== null && r.valueB !== null && r.valueB !== 0
            ? Math.round((delta / Math.abs(r.valueB)) * 100)
            : null;
        const status: "higher" | "lower" | "equal" =
          delta === null || Math.abs(deltaPct ?? 0) < 3 ? "equal"
            : delta > 0 ? "higher"
            : "lower";
        return { ...r, delta, deltaPct, status };
      });
      return { type: "comparison_table" as const, title: input.title, columnA: input.columnA, columnB: input.columnB, rows };
    },
  }),

  evaluar_impacto_clima: tool({
    description:
      "Consulta Open-Meteo en tiempo real y evalua impacto meteorologico sobre tareas de obra. Usala cuando el usuario pregunta por clima, lluvia, viento, hormigonado, izajes, trabajo en altura o reprogramacion por condiciones climaticas. Acepta ubicacion textual o coordenadas.",
    inputSchema: z.object({
      location: z.string().optional().describe("Ubicacion de la obra, ej. 'Cordoba, Argentina' o 'Rosario, Santa Fe'"),
      latitude: z.number().min(-90).max(90).optional().describe("Latitud WGS84 si se conocen coordenadas exactas"),
      longitude: z.number().min(-180).max(180).optional().describe("Longitud WGS84 si se conocen coordenadas exactas"),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha inicial YYYY-MM-DD; opcional"),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha final YYYY-MM-DD; opcional"),
    }).refine((value) => value.location || (value.latitude != null && value.longitude != null), {
      message: "Indica location o latitude+longitude",
    }),
    execute: async (input) => {
      const { evaluateWeatherImpact } = await import("@/lib/weather/open-meteo");
      return evaluateWeatherImpact(input);
    },
  }),

  verificar_ingreso_personal: tool({
    description:
      "Verifica si una cuadrilla, trabajador o subcontratista tiene ART/EPP/capacitaciones vigentes para entrar a la obra. Lee project_hse_records de la obra activa y devuelve veredicto (apto / observado / no_apto / sin_registro), vencimientos próximos y faltantes. Úsala cuando el usuario pregunte si puede ingresar personal, valide cuadrillas o cite ART, EPP o subcontratistas.",
    inputSchema: z.object({
      cuadrilla:      z.string().min(2).describe("Nombre del trabajador, cuadrilla o subcontratista a verificar"),
      projectId:      z.string().describe("UUID de la obra activa"),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input) => {
      const { verifyPersonnelClearance } = await import("@/lib/project-operations/personnel");
      return verifyPersonnelClearance(input);
    },
  }),

  reprogramar_e_informar: tool({
    description:
      "Reprograma una tarea del cronograma de obra (nueva fecha de vencimiento) y deja un evento de auditoría 'schedule.rescheduled' para que stakeholders puedan verlo. Resolve la tarea por código, nombre parcial o UUID. Si encuentra ambigüedad, devuelve candidatos. Úsala cuando el usuario decide correr una tarea o el clima/HSE/suministros obligan a mover una fecha.",
    inputSchema: z.object({
      taskRef:        z.string().min(1).describe("Código exacto, nombre parcial o UUID de la tarea a reprogramar"),
      newDueDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Nueva fecha de vencimiento en formato YYYY-MM-DD"),
      reason:         z.string().max(280).optional().describe("Motivo breve de la reprogramación (clima, HSE, suministro, decisión PM)"),
      notifyTo:       z.array(z.string()).max(8).optional().describe("Lista de stakeholders a informar — se registra en el audit_log para que UI/notificaciones los surfacée"),
      projectId:      z.string().describe("UUID de la obra activa"),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input) => {
      const { reprogramAndInform } = await import("@/lib/project-operations/schedule");
      return reprogramAndInform(input);
    },
  }),

  auditar_curva_inversion: tool({
    description:
      "Audita la curva S de la obra comparando snapshots de inversión planificada vs real vs comprometida. Devuelve los puntos de la curva, el último snapshot, ratio de avance y veredicto (alineado / observado / desviado_critico). Úsala cuando el usuario pregunte por avance financiero, desvío de inversión, curva S o costo comprometido vs plan.",
    inputSchema: z.object({
      projectId:      z.string().describe("UUID de la obra activa"),
      organizationId: z.string().describe("ID de la organización activa"),
      limit:          z.number().int().min(2).max(60).optional().describe("Cantidad máxima de snapshots a leer (default 24)"),
    }),
    execute: async (input) => {
      const { auditInvestmentCurve } = await import("@/lib/project-operations/financial-curve");
      return auditInvestmentCurve(input);
    },
  }),

  buscar_relaciones_documento: tool({
    description:
      "Consulta el knowledge graph de obra: lista qué documentos están relacionados con un archivo dado (contradicts / derives_from / supersedes / references / duplicates). Usala cuando el usuario pregunte '¿qué documentos se contradicen?', '¿qué archivos derivan de X?' o cuando necesites trazabilidad entre presupuestos, planos y memorias. Resolve por fileId o por nombre parcial.",
    inputSchema: z.object({
      fileId:         z.string().optional().describe("UUID exacto del archivo a investigar (preferido si lo tenés)"),
      fileName:       z.string().optional().describe("Fragmento del nombre del archivo (ilike). Se resuelve al match más reciente"),
      projectId:      z.string().optional().describe("Restringe a una obra específica"),
      relationType:   z.enum(["contradicts", "derives_from", "supersedes", "references", "duplicates"]).optional().describe("Filtra por tipo de relación"),
      organizationId: z.string().describe("ID de la organización activa"),
      limit:          z.number().int().min(1).max(50).optional().describe("Cantidad máxima de relaciones (default 20)"),
    }).refine((value) => value.fileId || value.fileName, {
      message: "Indica fileId o fileName",
    }),
    execute: async (input) => {
      const { queryObraRelations } = await import("@/lib/knowledge-graph/relations");
      const result = await queryObraRelations({
        organizationId: input.organizationId,
        projectId: input.projectId ?? null,
        fileId: input.fileId ?? null,
        fileName: input.fileName ?? null,
        relationType: input.relationType ?? null,
        limit: input.limit,
      });
      if (!result.resolvedFileId) {
        return {
          found: false,
          message: input.fileName
            ? `No encontré un archivo cuyo nombre contenga "${input.fileName}" en esta organización.`
            : "El fileId no existe o no pertenece a esta organización.",
          relations: [],
        };
      }
      if (result.relations.length === 0) {
        return {
          found: true,
          resolvedFileId: result.resolvedFileId,
          resolvedFileName: result.resolvedFileName,
          relationsCount: 0,
          message: "El archivo todavía no tiene relaciones registradas en el knowledge graph.",
          relations: [],
        };
      }
      return {
        found: true,
        resolvedFileId: result.resolvedFileId,
        resolvedFileName: result.resolvedFileName,
        relationsCount: result.relations.length,
        relations: result.relations.map((rel) => {
          const isSource = rel.source.fileId === result.resolvedFileId;
          return {
            id: rel.id,
            relationType: rel.relationType,
            direction: isSource ? "outgoing" : "incoming",
            detectedBy: rel.detectedBy,
            confidence: rel.confidence,
            counterpart: isSource ? rel.target : rel.source,
            evidence: rel.evidence,
            createdAt: rel.createdAt,
            updatedAt: rel.updatedAt,
          };
        }),
      };
    },
  }),

  // ── Bloques de Respuesta — tools de presentación visual ──────────────────

  proyectar_metricas: tool({
    description:
      "Proyecta un Bloque de Métricas visual con KPIs y barras de incidencia por rubro. Llamala DESPUÉS de calcular_totales + calcular_incidencia_de_subgrupo (y opcionalmente comparar_con_indices) para presentar el resumen ejecutivo. El frontend renderiza el bloque automáticamente con animación.",
    inputSchema: z.object({
      title: z.string().describe("Título del bloque (ej: 'Incidencia por rubro — Torre A')"),
      kpis: z.array(z.object({
        label: z.string().describe("Etiqueta en mayúsculas (ej: 'TOTAL OBRA')"),
        value: z.string().describe("Valor ya formateado en AR-style (ej: '$128.4M', '34.2%')"),
        delta: z.number().optional().describe("Variación porcentual con signo (ej: 6.8 = +6.8%)"),
        alert: z.boolean().optional().describe("true si el delta es un desvío que requiere atención"),
        sub: z.string().optional().describe("Subtítulo aclaratorio (ej: 'vs presupuesto base')"),
      })).min(2).max(4).describe("Entre 2 y 4 KPIs — llenar SIEMPRE los 4 cuando hay datos"),
      bars: z.array(z.object({
        label: z.string().describe("Nombre del rubro"),
        value: z.number().describe("Monto en $ ARS"),
        pct: z.number().optional().describe("Incidencia % sobre el total"),
        alert: z.boolean().optional().describe("true si el rubro tiene desvío respecto al índice CAC"),
      })).min(1).max(12).describe("Rubros ordenados de mayor a menor incidencia"),
      totalLabel: z.string().optional().describe("Etiqueta del total (default 'Σ')"),
      footer: z.string().optional().describe("Fuente de los datos (ej: 'Presupuesto R3 · CAC abril/2026')"),
    }),
    execute: async (input) => ({
      kind: "metrics" as const,
      title: input.title,
      kpis: input.kpis,
      bars: input.bars,
      totalLabel: input.totalLabel ?? "Σ",
      footer: input.footer,
    }),
  }),

  proyectar_comparativa: tool({
    description:
      "Proyecta un Bloque de Comparativa con ranking y score entre N opciones (proveedores, materiales, ofertas, versiones de presupuesto). Más potente que comparar_presupuestos para comparaciones multi-opción — genera ranking visual con badge RECOMENDADO en el mejor score.",
    inputSchema: z.object({
      title: z.string().describe("Título (ej: 'Hormigón elaborado H21 · 220 m³')"),
      rankBy: z.string().describe("Criterio de ranking (ej: 'score técnico-comercial')"),
      cols: z.array(z.object({
        key: z.string().describe("Clave del campo en values"),
        label: z.string().describe("Encabezado de columna en mayúsculas"),
        format: z.enum(["currency", "duration_h", "boolean_iram", "count_obras", "raw"]).describe("Formato de visualización"),
        alertThreshold: z.number().optional().describe("Umbral de alerta numérico (se marca en naranja si se supera)"),
      })).min(2).max(6),
      items: z.array(z.object({
        name: z.string().describe("Nombre de la opción (proveedor, material, etc.)"),
        sub: z.string().optional().describe("Descripción adicional breve"),
        score: z.number().min(0).max(100).describe("Score técnico-comercial de 0 a 100 — vos lo calculás en base a precio, plazo, calidad, etc."),
        values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).describe("Valores por columna — las claves deben coincidir con cols[].key"),
      })).min(2).max(8),
    }),
    execute: async (input) => ({
      kind: "comparison" as const,
      title: input.title,
      rankBy: input.rankBy,
      cols: input.cols,
      items: input.items,
    }),
  }),

  proyectar_cronograma: tool({
    description:
      "Proyecta un Gantt visual del cronograma de obra con línea HOY automática, fases coloreadas por estado (completado/en curso/pendiente) e hitos. Úsala cuando el usuario pregunta por avance, cronograma, hitos o etapas de la obra.",
    inputSchema: z.object({
      title: z.string().describe("Título del Gantt (ej: 'Cronograma — Las Lomas / Torre A')"),
      fechaInicio: z.string().describe("Fecha de inicio de la obra en formato ISO YYYY-MM-DD — se usa para calcular el día actual automáticamente"),
      totalDays: z.number().int().positive().describe("Duración total de la obra en días"),
      phases: z.array(z.object({
        name: z.string().describe("Nombre de la etapa (ej: 'Estructura H°A°')"),
        crew: z.string().optional().describe("Responsable o cuadrilla"),
        start: z.number().int().nonnegative().describe("Día de inicio desde el inicio de obra"),
        end: z.number().int().positive().describe("Día de fin desde el inicio de obra"),
      })).min(1).max(20).describe("Etapas del cronograma en orden cronológico"),
      milestones: z.array(z.object({
        label: z.string().describe("Nombre del hito"),
        day: z.number().int().nonnegative().describe("Día del hito desde el inicio de obra"),
        note: z.string().optional().describe("Nota aclaratoria (ej: 'aprobación comitente')"),
      })).max(10).optional().describe("Hitos clave del proyecto"),
    }),
    execute: async (input) => {
      const startDate = new Date(input.fechaInicio);
      const todayDay = Math.min(
        input.totalDays,
        Math.max(0, Math.floor((Date.now() - startDate.getTime()) / 86_400_000))
      );

      // Generate month labels from start date spanning totalDays
      const months: string[] = [];
      const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      let cursor = new Date(startDate);
      const endDate = new Date(startDate.getTime() + input.totalDays * 86_400_000);
      while (cursor <= endDate && months.length < 12) {
        const label = monthNames[cursor.getMonth()];
        if (label && !months.includes(label)) months.push(label);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }

      return {
        kind: "timeline" as const,
        title: input.title,
        totalDays: input.totalDays,
        todayDay,
        months: months.length >= 2 ? months : ["Mes 1", "Mes 2"],
        phases: input.phases,
        milestones: input.milestones ?? [],
      };
    },
  }),

  proyectar_legajo_grafico: tool({
    description:
      "Proyecta un Bloque de Legajo Gráfico con planos, renders e inspecciones de obra. Úsala cuando el usuario pide 'mostrame los planos', 'ver fotos', 'legajo gráfico', 'qué documentos visuales hay'. Busca en la base documental y presenta en grilla con miniaturas.",
    inputSchema: z.object({
      query: z.string().describe("Consulta de búsqueda para encontrar documentos visuales (ej: 'planos arquitectura', 'fotos inspección subsuelo')"),
      organizationId: z.string().describe("ID de la organización activa"),
      projectId: z.string().optional().describe("ID del proyecto activo — limita la búsqueda a esta obra"),
      obraCode: z.string().describe("Código o nombre corto de la obra para el footer del bloque"),
      title: z.string().optional().describe("Título del bloque — si se omite, se genera automáticamente"),
    }),
    execute: async (input) => {
      const { searchDocuments } = await import("@/lib/rag/search");

      const results = await searchDocuments(input.query, {
        organizationId: input.organizationId,
        projectId: input.projectId,
        topK: 8,
      });

      const VISUAL_TYPES = ["plano", "dxf", "cad", "render", "foto", "imagen", "jpg", "png", "dwg"];
      const scored = results
        .map((r) => {
          const combined = `${r.fileName} ${r.documentType} ${r.constructionDocType}`.toLowerCase();
          const isVisual = VISUAL_TYPES.some((t) => combined.includes(t));
          return { r, isVisual };
        })
        .sort((a, b) => Number(b.isVisual) - Number(a.isVisual))
        .slice(0, 4);

      if (scored.length === 0) {
        return {
          kind: "media" as const,
          title: input.title ?? `Legajo gráfico — ${input.obraCode}`,
          obra: input.obraCode,
          items: [{
            kind: "plano" as const,
            title: "Sin documentos visuales disponibles en esta obra",
            seed: 1,
          }],
        };
      }

      const items = scored.map(({ r }) => {
        const name = r.fileName.toLowerCase();
        const kind: "plano" | "render" | "obra" =
          name.includes("plano") || name.includes("dxf") || name.includes("cad") || name.includes("dwg") ? "plano" :
          name.includes("render") || name.includes("fachada") ? "render" : "obra";

        const seed = (r.fileName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5) + 1;
        const ext = r.fileName.split(".").pop()?.toUpperCase();

        return {
          kind,
          title: r.fileName.replace(/\.[^.]+$/, ""),
          documentId: r.fileId ?? undefined,
          ext: ext ? `${ext}` : undefined,
          seed,
        };
      });

      return {
        kind: "media" as const,
        title: input.title ?? `Legajo gráfico — ${input.obraCode}`,
        obra: input.obraCode,
        synced: "ahora",
        items,
      };
    },
  }),
};
