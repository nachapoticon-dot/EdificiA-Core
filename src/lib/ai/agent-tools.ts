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
      "Busca información en las fuentes empresariales de la organización (planos, presupuestos, remitos, memorias, etc.). Úsala antes de responder preguntas sobre proyectos anteriores, formatos que usa la empresa, o cualquier dato que pueda estar en documentos subidos. La búsqueda es semántica cuando hay embeddings disponibles, o por texto si no.",
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
          message: "No se encontraron fuentes empresariales relevantes para esa consulta.",
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
      "Propone guardar un archivo generado por el agente como fuente empresarial. IMPORTANTE: esto NO guarda el archivo directamente — el usuario debe revisar y confirmar. Usá esta herramienta cuando hayas generado un cómputo, remito, tabla o cualquier documento listo para guardar.",
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
      confidence: z.number().min(0).max(100).optional().describe("Confianza 0-100 del hallazgo según evidencia disponible"),
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
        confidence: z.number().min(0).max(100).optional().describe("Confianza 0-100 del hallazgo"),
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

  generar_orden_compra: tool({
    description:
      "Genera una orden de compra (.docx) lista para firmar y descargar a partir de datos explícitos del acopio. Úsala cuando el usuario decide formalizar la compra de un material/servicio y pide 'armá la OC', 'generá la orden de compra' o 'pasame el documento para firmar'. Si supplyItemId está presente, agrega trazabilidad al item de project_supply_items. Los items, cantidades y precios deben venir del usuario o de una tool previa (registrar_acopio, comparar_presupuestos), NO los inventes.",
    inputSchema: z.object({
      obraName:       z.string().describe("Nombre de la obra"),
      organizationId: z.string().describe("ID de la organización activa"),
      projectId:      z.string().optional().describe("UUID de la obra (opcional, mejora trazabilidad)"),
      supplyItemId:   z.string().uuid().optional().describe("UUID del item de project_supply_items si la OC corresponde a un acopio ya registrado"),
      ordenNumber:    z.string().optional().describe("Número interno de la OC (si no se pasa, se genera uno)"),
      vendor: z.object({
        name:         z.string().min(2).describe("Razón social del proveedor"),
        contactName:  z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
      }).describe("Datos del proveedor"),
      items: z.array(z.object({
        description: z.string().describe("Descripción del item / servicio"),
        quantity:    z.number().nonnegative().describe("Cantidad"),
        unit:        z.string().describe("Unidad (m³, kg, ml, un...)"),
        unitPrice:   z.number().nonnegative().describe("Precio unitario"),
      })).min(1).max(50).describe("Items de la OC"),
      currency:        z.string().min(3).max(8).optional().describe("Moneda (default ARS)"),
      taxPct:          z.number().min(0).max(100).optional().describe("IVA en %"),
      deliveryAddress: z.string().optional().describe("Lugar de entrega"),
      deliveryDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha de entrega YYYY-MM-DD"),
      paymentTerms:    z.string().optional().describe("Forma / plazo de pago (ej: '30 días fecha factura')"),
      notes:           z.string().max(500).optional().describe("Observaciones adicionales"),
      signedBy:        z.string().optional().describe("Nombre del responsable de compras que firma"),
    }),
    execute: async (input) => {
      const safeDate = new Date().toISOString().slice(0, 10);
      const safeVendor = input.vendor.name.replace(/\s+/g, "_").slice(0, 30);
      const safeObra = input.obraName.replace(/\s+/g, "_").slice(0, 30);
      const itemsCount = input.items.length;
      const total = input.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
      const currency = input.currency ?? "ARS";
      const totalLabel = new Intl.NumberFormat("es-AR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(total);
      return {
        type:        "doc_generation_proposal" as const,
        docType:     "orden_compra" as const,
        fileName:    `OC_${safeVendor}_${safeObra}_${safeDate}`,
        description: `OC a ${input.vendor.name} · ${itemsCount} item(s) · ${currency} ${totalLabel}`,
        payload: {
          obraName:        input.obraName,
          ordenNumber:     input.ordenNumber,
          vendor:          input.vendor,
          items:           input.items,
          currency:        input.currency,
          taxPct:          input.taxPct,
          deliveryAddress: input.deliveryAddress,
          deliveryDate:    input.deliveryDate,
          paymentTerms:    input.paymentTerms,
          notes:           input.notes,
          buyer:           input.signedBy ? { signedBy: input.signedBy } : undefined,
          supplyItemId:    input.supplyItemId,
          projectId:       input.projectId,
        },
        organizationId: input.organizationId,
      };
    },
  }),

  generar_acta_obra: tool({
    description:
      "Genera un acta / parte diario de obra (.docx) listo para firmar. Documenta lo ejecutado en un día: clima, cuadrilla, tareas con avance, materiales recibidos, incidentes HSE, visitas y notas. Úsala cuando el usuario pide 'armá el parte diario', 'generá el acta del DD/MM' o cierra la jornada con un resumen. Los datos deben venir del usuario o de tools previas (resumen_diario_obra, registrar_hse_record, etc.), NO los inventes.",
    inputSchema: z.object({
      obraName:        z.string().describe("Nombre de la obra"),
      organizationId:  z.string().describe("ID de la organización activa"),
      date:            z.string().describe("Fecha del parte en YYYY-MM-DD o texto libre"),
      weatherSummary:  z.string().optional().describe("Resumen del clima del día (ej: 'Soleado, 18-26°C, sin lluvia')"),
      crew: z.array(z.object({
        name:          z.string().optional(),
        role:          z.string().optional().describe("Rol (capataz, oficial albañil, plomero, etc.)"),
        subcontractor: z.string().optional().describe("Empresa subcontratista"),
        count:         z.number().int().min(1).max(200).optional().describe("Cantidad de personas si es grupo"),
      })).optional().describe("Cuadrilla presente en obra"),
      tasksExecuted: z.array(z.object({
        description:  z.string().describe("Qué se ejecutó (ej: 'Hormigonado losa N+2.80')"),
        progress:     z.string().optional().describe("Avance (ej: '80% completado', '120 m² ejecutados')"),
        observations: z.string().optional().describe("Observaciones técnicas"),
      })).min(1).max(20).describe("Tareas ejecutadas en el día"),
      incidents: z.array(z.object({
        severity:    z.enum(["leve", "moderado", "critico"]),
        description: z.string().describe("Descripción del incidente o observación HSE"),
      })).optional().describe("Incidentes y observaciones HSE del día"),
      materialsReceived: z.array(z.object({
        item:     z.string().describe("Material recibido"),
        quantity: z.string().optional().describe("Cantidad con unidad (ej: '12 m³', '500 kg')"),
        supplier: z.string().optional().describe("Proveedor que entregó"),
      })).optional().describe("Materiales recibidos en obra"),
      visitsOnSite: z.array(z.object({
        name: z.string(),
        role: z.string().optional(),
      })).optional().describe("Visitas externas en obra (DT, inspección, propietario)"),
      notes:    z.string().max(1000).optional().describe("Notas libres"),
      signedBy: z.string().optional().describe("Capataz / Conductor de obra que firma"),
    }),
    execute: async (input) => {
      const safeObra = input.obraName.replace(/\s+/g, "_").slice(0, 30);
      const safeDate = input.date.slice(0, 10);
      const taskCount = input.tasksExecuted.length;
      const incidentCount = input.incidents?.length ?? 0;
      const descParts = [`${taskCount} tarea(s)`];
      if (incidentCount > 0) descParts.push(`${incidentCount} incidente(s)`);
      if (input.materialsReceived?.length) descParts.push(`${input.materialsReceived.length} material(es) recibido(s)`);
      return {
        type:        "doc_generation_proposal" as const,
        docType:     "acta_obra" as const,
        fileName:    `Acta_${safeObra}_${safeDate}`,
        description: `Parte diario ${input.obraName} · ${input.date} · ${descParts.join(" · ")}`,
        payload: {
          obraName:          input.obraName,
          date:              input.date,
          weatherSummary:    input.weatherSummary,
          crew:              input.crew,
          tasksExecuted:     input.tasksExecuted,
          incidents:         input.incidents,
          materialsReceived: input.materialsReceived,
          visitsOnSite:      input.visitsOnSite,
          notes:             input.notes,
          signedBy:          input.signedBy,
        },
        organizationId: input.organizationId,
      };
    },
  }),

  enviar_email_stakeholder: tool({
    description:
      "Envía un email a stakeholders de la obra (subcontratistas con contacto registrado en project_subcontracts). SOLO acepta destinatarios que estén en la whitelist de la obra: emails de contactos de subcontratos no eliminados. Si un email no está, lo bloquea y devuelve la lista de bloqueados. Úsala cuando el usuario explícitamente pide 'avisale a X', 'mandale un mail al gremio Y', 'notificá al instalador'. NO la uses para emails internos ni para destinatarios genéricos. Máximo 5 destinatarios entre to+cc.",
    inputSchema: z.object({
      organizationId: z.string().describe("ID de la organización activa"),
      projectId:      z.string().describe("UUID de la obra activa — define la whitelist"),
      to:             z.array(z.string().email()).min(1).max(5).describe("Lista de destinatarios principales"),
      cc:             z.array(z.string().email()).max(5).optional().describe("Lista de destinatarios en copia"),
      subject:        z.string().min(3).max(160).describe("Asunto del email"),
      body:           z.string().min(10).max(5000).describe("Cuerpo del mensaje en texto plano (los saltos de línea se preservan)"),
      scheduleTaskId: z.string().uuid().optional().describe("UUID de la tarea de cronograma asociada (opcional, queda en audit log)"),
      subcontractId:  z.string().uuid().optional().describe("UUID del subcontrato asociado (opcional, queda en audit log)"),
    }),
    execute: async (input) => {
      const { sendStakeholderEmail } = await import("@/lib/project-operations/communications/stakeholder-email");
      return sendStakeholderEmail(input);
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

  registrar_subcontrato: tool({
    description:
      "Registra un subcontrato de obra en project_subcontracts: proveedor, rubro, monto, estado, fechas, retención y contacto. Úsala cuando el usuario informa una contratación concreta o pide cargar un subcontrato. NO inventes montos ni fechas.",
    inputSchema: z.object({
      projectId:       z.string().describe("UUID de la obra activa"),
      organizationId:  z.string().describe("ID de la organización activa"),
      vendorName:      z.string().min(2).describe("Nombre del subcontratista / proveedor"),
      trade:           z.string().optional().describe("Rubro o especialidad: estructura, instalaciones, albañilería, HSE, etc."),
      contractAmount:  z.number().nonnegative().optional().describe("Monto contractual"),
      currency:        z.string().min(3).max(8).optional().describe("Default ARS"),
      status:          z.enum(["draft", "active", "paused", "completed", "terminated"]).optional(),
      startDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      retentionPct:    z.number().min(0).max(100).optional().describe("Porcentaje de fondo de reparo / retención"),
      contactName:     z.string().optional(),
      contactEmail:    z.string().email().optional(),
      contactPhone:    z.string().optional(),
      note:            z.string().max(280).optional(),
    }),
    execute: async (input) => {
      const { registerSubcontract } = await import("@/lib/project-operations/contracts/subcontracts");
      return registerSubcontract(input);
    },
  }),

  auditar_subcontratos: tool({
    description:
      "Audita subcontratos de una obra: incidencia por rubro, montos activos, vencimientos contractuales próximos/vencidos y retenciones acumuladas estimadas. Úsala ante preguntas sobre subcontratistas, contratos, vencimientos, rubros tercerizados o fondo de reparo.",
    inputSchema: z.object({
      projectId:        z.string().describe("UUID de la obra activa"),
      organizationId:   z.string().describe("ID de la organización activa"),
      includeCompleted: z.boolean().optional().describe("Incluir completed/terminated en el cálculo (default false)"),
      horizonDays:      z.number().int().min(1).max(180).optional().describe("Ventana de vencimientos próximos (default 30 días)"),
    }),
    execute: async (input) => {
      const { auditSubcontracts } = await import("@/lib/project-operations/contracts/subcontracts");
      return auditSubcontracts(input);
    },
  }),

  registrar_snapshot_financiero: tool({
    description:
      "Registra un snapshot de inversión de la obra en una fecha dada. Si ya existe snapshot para esa fecha, la actualización REEMPLAZA todos los montos: pasá los campos vigentes completos; los que omitas quedan vacíos (null) — nunca uses 0 para 'borrar' un campo, simplemente omitilo. Úsala cuando el usuario informa cifras concretas. MAPEO DE VOCABULARIO → CAMPO (respetalo siempre): 'certificado / certificación / avance certificado / facturado' → invoicedAmount · 'invertido / ejecutado / gastado / costo real' → actualAmount · 'planificado / presupuestado / curva teórica' → plannedAmount · 'comprometido / OC firmadas' → committedAmount · 'pagado / abonado' → paidAmount. CONSISTENCIA DE SERIE: si los snapshots anteriores de esta obra usan un campo (p. ej. invoicedAmount), los valores siguientes de la misma serie van al MISMO campo — no alternes campos entre fechas; ante duda preguntá. NO inventes montos — solo registralos cuando el usuario los provee. Requiere obra activa.",
    inputSchema: z.object({
      projectId:        z.string().describe("UUID de la obra activa"),
      organizationId:   z.string().describe("ID de la organización activa"),
      snapshotDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Fecha del snapshot YYYY-MM-DD"),
      plannedAmount:    z.number().nullable().optional().describe("Acumulado planificado/presupuestado a esa fecha (curva teórica)"),
      actualAmount:     z.number().nullable().optional().describe("Costo real incurrido acumulado ('invertido', 'ejecutado', 'gastado')"),
      committedAmount:  z.number().nullable().optional().describe("Monto comprometido (OC + contratos firmados)"),
      invoicedAmount:   z.number().nullable().optional().describe("Acumulado certificado/facturado ('certificamos', 'avance certificado')"),
      paidAmount:       z.number().nullable().optional().describe("Monto efectivamente pagado"),
      currency:         z.string().min(3).max(8).optional().describe("Moneda ISO (default ARS)"),
      note:             z.string().max(280).optional().describe("Nota breve de contexto"),
    }),
    execute: async (input) => {
      const { registerFinancialSnapshot } = await import("@/lib/project-operations/agent-writers/operational-writers");
      return registerFinancialSnapshot({ ...input, source: "agent" });
    },
  }),

  registrar_hse_record: tool({
    description:
      "Registra un legajo HSE (ART / EPP / capacitación / médico / incidente / acceso) para un trabajador o subcontratista de la obra. El status se calcula automáticamente desde expiresAt: valid > 14d, expiring ≤14d, expired si vencido. Úsala cuando el usuario informa documentación nueva ('Juan presentó ART vigente hasta 30/09'). NO la uses para inventar credenciales.",
    inputSchema: z.object({
      projectId:          z.string().describe("UUID de la obra activa"),
      organizationId:     z.string().describe("ID de la organización activa"),
      recordType:         z.enum(["art", "epp", "training", "medical", "incident", "access"]),
      subjectName:        z.string().optional().describe("Nombre del trabajador o responsable"),
      subcontractorName:  z.string().optional().describe("Nombre del subcontratista o empresa"),
      workerIdentifier:   z.string().optional().describe("DNI / legajo interno"),
      issuedAt:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha de emisión YYYY-MM-DD"),
      expiresAt:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha de vencimiento YYYY-MM-DD"),
      status:             z.enum(["valid", "expiring", "expired", "missing", "incident"]).optional().describe("Forzar status (override del auto-cálculo). Para incidentes informados, indicar 'incident'"),
      note:               z.string().max(280).optional().describe("Nota breve"),
    }),
    execute: async (input) => {
      const { registerHseRecord } = await import("@/lib/project-operations/agent-writers/operational-writers");
      return registerHseRecord(input);
    },
  }),

  registrar_acopio: tool({
    description:
      "Crea o actualiza un acopio/suministro de la obra (mode='create' inserta nuevo, mode='update' modifica el existente con el mismo itemName). Status se infiere automáticamente: received si receivedQuantity ≥ requiredQuantity, partial si <, ordered si hay orderedQuantity, planned si solo hay requiredQuantity. Úsala cuando el usuario informa 'planificamos comprar X', 'pedimos Y', 'recibimos Z'.",
    inputSchema: z.object({
      projectId:        z.string().describe("UUID de la obra activa"),
      organizationId:   z.string().describe("ID de la organización activa"),
      mode:             z.enum(["create", "update"]),
      itemName:         z.string().min(2).describe("Nombre del item de acopio (ej: 'Hormigón H21', 'Hierro 8mm')"),
      category:         z.string().optional().describe("Categoría general (estructura, terminaciones, instalaciones…)"),
      unit:             z.string().optional().describe("Unidad de medida (m³, kg, ml, un…)"),
      requiredQuantity: z.number().nonnegative().optional(),
      orderedQuantity:  z.number().nonnegative().optional(),
      receivedQuantity: z.number().nonnegative().optional(),
      unitCost:         z.number().nonnegative().optional().describe("Costo unitario en la moneda informada"),
      currency:         z.string().min(3).max(8).optional().describe("Default ARS"),
      supplierName:     z.string().optional().describe("Proveedor"),
      requiredBy:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha en que se necesita en obra"),
      status:           z.enum(["planned", "quoted", "ordered", "partial", "received", "delayed", "cancelled"]).optional().describe("Override del status auto-calculado"),
      note:             z.string().max(280).optional(),
    }),
    execute: async (input) => {
      const { registerSupplyItem } = await import("@/lib/project-operations/agent-writers/operational-writers");
      return registerSupplyItem(input);
    },
  }),

  resolver_relacion_documental: tool({
    description:
      "Cierra una relación del knowledge graph entre dos documentos. action='confirm' marca la relación como confirmada por usuario (confidence=1, detected_by=user). action='dismiss' soft-deletea la relación con resolución 'dismissed'. action='supersede' indica que el target reemplaza al source: crea una relación 'supersedes' nueva en sentido inverso y descarta la original. Úsala cuando el usuario clarifica que una contradicción detectada automáticamente no es válida ('ese cambio fue autorizado') o cuando confirma trazabilidad.",
    inputSchema: z.object({
      relationId:     z.string().uuid().describe("UUID de la relación a resolver"),
      action:         z.enum(["confirm", "dismiss", "supersede"]),
      rationale:      z.string().max(280).optional().describe("Motivo breve de la resolución (queda en el audit log)"),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input) => {
      const { resolveObraRelation } = await import("@/lib/project-operations/agent-writers/operational-writers");
      return resolveObraRelation(input);
    },
  }),

  consultar_perfil_empresa: tool({
    description:
      "Consulta el perfil empresarial vivo: el snapshot agregado del Contexto Empresarial (entidades detectadas, patrones internos, cobertura por obra). El system prompt ya incluye el top compacto; usá esta tool cuando necesites lista completa de proveedores/subcontratistas/rubros, patrones detallados con confianza o cobertura por obra con score y nivel de riesgo. No la uses para datos transaccionales (subcontratos vivos, snapshots financieros, HSE): para eso están las tools específicas.",
    inputSchema: z.object({
      facet:          z.enum(["summary", "suppliers", "subcontractors", "trades", "patterns", "coverage"]).optional().describe("Qué facet del perfil traer. Default: summary."),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input) => {
      const { queryEnterpriseProfileFacet } = await import("@/lib/enterprise-context/profile-reader");
      return queryEnterpriseProfileFacet({ organizationId: input.organizationId, facet: input.facet });
    },
  }),

  recordar_aprendizaje: tool({
    description:
      "Guarda un aprendizaje confirmado por el usuario en la memoria activa de la empresa para futuras sesiones. Usala SOLO cuando el usuario pida explícitamente recordar/guardar o confirme una propuesta de memoria. No guardes inferencias no confirmadas, datos sensibles personales ni secretos.",
    inputSchema: z.object({
      key:             z.string().min(3).max(100).describe("Clave estable y corta, ej: 'proveedores.hormigon.preferido'"),
      summary:         z.string().min(12).max(700).describe("Aprendizaje operativo confirmado, escrito como hecho reusable"),
      evidence:        z.array(z.string().min(3).max(360)).min(1).max(8).describe("Evidencia textual concreta o frase del usuario que justifica guardarlo"),
      confidence:      z.number().min(0.1).max(1).optional().describe("Confianza 0.1-1. Default 0.85"),
      tags:            z.array(z.string().min(2).max(40)).max(8).optional().describe("Tags de búsqueda, ej: proveedor, hse, presupuesto"),
      organizationId:  z.string().describe("ID de la organización activa"),
      projectId:       z.string().uuid().optional().describe("Obra asociada, si aplica"),
      workCaseId:      z.string().uuid().optional().describe("Expediente asociado, si aplica"),
      confirmedByUser: z.literal(true).describe("Debe ser true solo si hubo confirmación explícita del usuario en este turno"),
    }),
    execute: async (input) => {
      const { recordAgentLearning } = await import("@/lib/ai/active-memory");
      return recordAgentLearning({
        organizationId: input.organizationId,
        projectId: input.projectId ?? null,
        workCaseId: input.workCaseId ?? null,
        key: input.key,
        summary: input.summary,
        evidence: input.evidence,
        confidence: input.confidence,
        tags: input.tags,
      });
    },
  }),

  resumen_diario_obra: tool({
    description:
      "Brief diario consolidado de la obra: tareas vencidas/del día/próximas, HSE expirando, acopios demorados o requeridos pronto, último snapshot financiero con desvío, alertas top y opcionalmente clima del día. Úsala cuando el usuario pide 'cómo va la obra', 'qué tengo hoy', 'estado general' o al inicio del día.",
    inputSchema: z.object({
      projectId:      z.string().describe("UUID de la obra activa"),
      organizationId: z.string().describe("ID de la organización activa"),
      includeWeather: z.object({
        location:  z.string().optional(),
        latitude:  z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
      }).optional().describe("Si se pasa, agrega clima del día — requiere location o coordenadas."),
    }),
    execute: async (input) => {
      const { buildDailyBrief } = await import("@/lib/project-operations/brief/daily-brief");
      return buildDailyBrief(input);
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
        confidence: z.number().min(0).max(100).optional().describe("Confianza 0-100 del KPI"),
      })).min(2).max(4).describe("Entre 2 y 4 KPIs — llenar SIEMPRE los 4 cuando hay datos"),
      bars: z.array(z.object({
        label: z.string().describe("Nombre del rubro"),
        value: z.number().describe("Monto en $ ARS"),
        pct: z.number().optional().describe("Incidencia % sobre el total"),
        alert: z.boolean().optional().describe("true si el rubro tiene desvío respecto al índice CAC"),
        confidence: z.number().min(0).max(100).optional().describe("Confianza 0-100 de esta barra/rubro"),
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
      "Proyecta un Bloque de Legajo Gráfico con planos, renders e inspecciones de obra. Úsala cuando el usuario pide 'mostrame los planos', 'ver fotos', 'legajo gráfico', 'qué documentos visuales hay'. Busca en las fuentes empresariales y presenta en grilla con miniaturas.",
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

  proponer_cierre_expediente: tool({
    description:
      "Cierra el expediente operativo activo con veredicto y resumen final. Mueve el estado a 'resolved' (acción reversible — un humano puede reabrir o avanzar a 'closed'/'archived'). Usala SOLO cuando ya tenés evidencia suficiente para concluir (auditorías completas, hallazgos reportados, contradicciones resueltas). NO la uses para abrir nuevas tareas ni para silenciar trabajo pendiente. Si el expediente ya está en estado terminal, NO la llames: solicitá reapertura humana primero. El veredicto debe reflejar el resultado real: approved (todo conforme), flagged (cerrado con observaciones a seguir), inconclusive (no hay datos suficientes), rejected (no procede), superseded (queda reemplazado por otro expediente). Agregá referencias en `evidence` solo cuando sirvan como justificación citable (reportes documentales, hallazgos, eventos auditados).",
    inputSchema: z.object({
      workCaseId: z.string().uuid().describe("UUID del expediente operativo activo"),
      verdict: z.enum(["approved", "flagged", "inconclusive", "rejected", "superseded"]).describe("Veredicto final"),
      summary: z.string().min(20).max(2000).describe("Resumen ejecutivo del cierre (qué se verificó, qué se concluye, qué queda abierto)"),
      rationale: z.string().max(600).optional().describe("Justificación corta del veredicto, citable internamente"),
      evidence: z
        .array(
          z.object({
            evidenceType: z.enum([
              "audit_event",
              "tool_run",
              "finding",
              "document_report",
              "file",
              "message",
              "schedule_task",
              "hse_record",
              "supply_item",
              "financial_snapshot",
              "subcontract",
              "relation",
              "external",
            ]),
            entityType: z.string().min(1).describe("Tabla o tipo de la entidad (ej. document_intelligence_reports, audit_log_events)"),
            entityId: z.string().optional().describe("UUID de la entidad cuando aplica"),
            label: z.string().max(280).optional(),
            confidence: z.number().min(0).max(1).optional(),
            metadata: z.record(z.unknown()).optional(),
          }),
        )
        .max(20)
        .optional()
        .describe("Referencias citables que respaldan el veredicto. Máximo 20."),
      organizationId: z.string().describe("ID de la organización activa"),
      actorUserId: z.string().describe("UUID del usuario que ejecuta el turno"),
    }),
    execute: async (input) => {
      const { closeWorkCaseFromAgent } = await import("@/lib/agent-core");
      return closeWorkCaseFromAgent({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        workCaseId: input.workCaseId,
        verdict: input.verdict,
        summary: input.summary,
        rationale: input.rationale ?? null,
        evidence: input.evidence,
        capabilityId: "operations.update",
      });
    },
  }),
};
