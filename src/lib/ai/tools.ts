import { tool } from "ai";
import { z } from "zod";
import { budgetItemSchema, type BudgetItem } from "@/lib/math-engine/validators";
import { calcularTotalLinea, calcularCostoDirecto } from "@/lib/math-engine/calculator";
import {
  validarCierreDeTotal,
  detectarExclusionesLogicas,
  calcularIncidenciaDeSubgrupo,
} from "@/lib/math-engine/auditor";
import { getItems } from "@/lib/file-cache";
import { searchDocuments } from "@/lib/rag/search";
import { getCoverageForProject } from "@/lib/obra/coverage";
import { compareItemsWithIndices } from "@/lib/indices/compare";
import { closeWorkCaseFromAgent } from "@/lib/work-cases/close";
import { WORK_CASE_VERDICTS } from "@/lib/work-cases/types";

const geometrySummarySchema = z.object({
  totalAreaM2: z.number(),
  totalLinearM: z.number(),
  areasByLayer: z.array(z.object({ layer: z.string(), areaM2: z.number() })),
  linearByLayer: z.array(z.object({ layer: z.string(), totalM: z.number() })),
  unitFactor: z.number(),
});

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

const AREA_UNITS = new Set(["m2", "m²", "M2", "M²"]);
const LINEAR_UNITS = new Set(["ml", "m", "ML", "M"]);

const CACHE_MISS = {
  error: true as const,
  message: "No hay ítems disponibles: el caché del archivo expiró o no se pasaron ítems. Pedí que se vuelva a subir el archivo.",
};

/** Los ítems pueden venir por `cacheId` (archivo subido en la sesión) o explícitos. */
const itemsSourceSchema = z.object({
  cacheId: z.string().optional().describe("ID de caché del Excel subido. Preferido sobre `items`."),
  items: z.array(budgetItemSchema).optional().describe("Ítems explícitos, solo si no hay cacheId."),
});

function resolveItems(input: { cacheId?: string; items?: BudgetItem[] }): BudgetItem[] | null {
  const items = input.cacheId ? getItems(input.cacheId) : input.items;
  return items && items.length > 0 ? items : null;
}

const findingSchema = z.object({
  code: z.string().describe("Código del hallazgo, ej. 'ERR-001'"),
  severity: z.enum(["error", "warning", "info"]),
  title: z.string().describe("Título breve, máx. 60 caracteres"),
  detail: z.string(),
  impact: z.string().optional().describe("Impacto económico estimado"),
  item: z.string().optional().describe("Ítem o referencia del documento afectado"),
});

function docFileName(prefix: string, name: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}_${name.replace(/\s+/g, "_").slice(0, 40)}_${date}`;
}

function formatPeriod(index: { period_month: number | null; period_year: number }): string {
  return `${index.period_month ?? "?"}/${index.period_year}`;
}

/**
 * Tools del agente. `organizationId` y el usuario se fijan del lado del
 * servidor: el modelo nunca los recibe como parámetro, así que un documento
 * con instrucciones inyectadas no puede apuntar a datos de otra empresa.
 */
export function createAgentTools(orgId: string, actorUserId: string) {
  return {
    calcular_totales: tool({
      description: "Calcula el total de cada línea (cantidad × precio unitario) y el costo directo del presupuesto.",
      inputSchema: itemsSourceSchema.extend({
        declaredTotal: z.number().optional().describe("Total declarado, para informar la diferencia"),
      }),
      execute: async (input) => {
        const items = resolveItems(input);
        if (!items) return CACHE_MISS;
        const computedTotal = calcularCostoDirecto(items);
        const difference = input.declaredTotal != null
          ? Math.round((input.declaredTotal - computedTotal) * 100) / 100
          : null;
        return {
          computedTotal,
          declaredTotal: input.declaredTotal ?? null,
          difference,
          lineTotals: items.map(calcularTotalLinea),
          itemCount: items.length,
        };
      },
    }),

    validar_cierre_de_total: tool({
      description: "Verifica que la suma de los ítems coincida con el total declarado, dentro de una tolerancia.",
      inputSchema: itemsSourceSchema.extend({
        declaredTotal: z.number(),
        tolerancePct: z.number().min(0).max(0.1).optional().describe("Tolerancia relativa (default 0.005)"),
      }),
      execute: async (input) => {
        const items = resolveItems(input);
        if (!items) return CACHE_MISS;
        return validarCierreDeTotal(items, input.declaredTotal, input.tolerancePct);
      },
    }),

    detectar_exclusiones_logicas: tool({
      description:
        "Aplica las reglas de consistencia del presupuesto: subcontrato con mano de obra propia, precio cero, " +
        "total mal calculado, cantidad cero, códigos duplicados, ítems en %, valores negativos, precios redondos " +
        "por m² y outliers de precio por unidad.",
      inputSchema: itemsSourceSchema,
      execute: async (input) => {
        const items = resolveItems(input);
        if (!items) return CACHE_MISS;
        const issues = detectarExclusionesLogicas(items);
        const count = (s: string) => issues.filter((i) => i.severity === s).length;
        return {
          totalIssues: issues.length,
          errors: count("error"),
          warnings: count("warning"),
          infos: count("info"),
          issues,
        };
      },
    }),

    calcular_incidencia_de_subgrupo: tool({
      description: "Calcula qué porcentaje del total representa un subgrupo de ítems (por código).",
      inputSchema: itemsSourceSchema.extend({
        subgroupCodes: z.array(z.string()),
        grandTotal: z.number(),
      }),
      execute: async (input) => {
        const items = resolveItems(input);
        if (!items) return CACHE_MISS;
        return calcularIncidenciaDeSubgrupo(items, input.subgroupCodes, input.grandTotal);
      },
    }),

    comparar_con_indices: tool({
      description:
        "Agrupa los ítems por rubro y compara su precio unitario promedio contra los índices cargados " +
        "(lista propia de la empresa, CAC, INDEC). Marca desvíos mayores a ±15 %.",
      inputSchema: z.object({
        items: z.array(z.object({
          code: z.string(),
          description: z.string(),
          unit: z.string(),
          unitPrice: z.number(),
          quantity: z.number(),
        })),
      }),
      execute: async (input) => {
        const comparisons = await compareItemsWithIndices(input.items, orgId);
        if (comparisons.length === 0) {
          return { found: false, message: "No hay índices de precio cargados para estos rubros.", comparisons: [] };
        }
        return {
          found: true,
          overCount: comparisons.filter((c) => c.alert === "over").length,
          underCount: comparisons.filter((c) => c.alert === "under").length,
          comparisons: comparisons.map((c) => ({
            category: c.categoryLabel,
            itemCount: c.itemCount,
            avgBudgetPrice: c.avgBudgetPrice,
            companyRef: c.companyIndex ? { avg: c.companyIndex.value_avg, period: formatPeriod(c.companyIndex) } : null,
            cacRef: c.cacIndex ? { avg: c.cacIndex.value_avg, period: formatPeriod(c.cacIndex) } : null,
            indecRef: c.indecIndex ? { avg: c.indecIndex.value_avg, period: formatPeriod(c.indecIndex) } : null,
            deviationPct: c.deviationPct,
            alert: c.alert,
          })),
        };
      },
    }),

    analizar_geometria_plano: tool({
      description: "Arma un cómputo métrico básico (m² y ml por capa) a partir del resumen geométrico de un DXF.",
      inputSchema: z.object({ geometrySummary: geometrySummarySchema }),
      execute: async ({ geometrySummary: g }) => {
        const quantityTakeoff = [
          ...g.areasByLayer.map((e) => ({ element: interpretLayerName(e.layer), layer: e.layer, qty: e.areaM2, unit: "m²" })),
          ...g.linearByLayer.map((e) => ({ element: interpretLayerName(e.layer), layer: e.layer, qty: e.totalM, unit: "ml" })),
        ];
        return {
          hasGeometry: g.totalAreaM2 > 0 || g.totalLinearM > 0,
          totalAreaM2: g.totalAreaM2,
          totalLinearM: g.totalLinearM,
          unitFactor: g.unitFactor,
          quantityTakeoff,
        };
      },
    }),

    comparar_computo_con_plano: tool({
      description: "Cruza las cantidades en m² y ml del presupuesto con las medidas del plano DXF. Marca desvíos > 5 %.",
      inputSchema: z.object({
        budgetItems: z.array(z.object({
          code: z.string(),
          description: z.string(),
          unit: z.string(),
          quantity: z.number(),
        })),
        planGeometry: geometrySummarySchema,
      }),
      execute: async ({ budgetItems, planGeometry }) => {
        const sumBy = (units: Set<string>) =>
          budgetItems.filter((i) => units.has(i.unit)).reduce((s, i) => s + i.quantity, 0);
        const budgetArea = sumBy(AREA_UNITS);
        const budgetLinear = sumBy(LINEAR_UNITS);

        const discrepancies: string[] = [];
        const check = (label: string, unit: string, budget: number, plan: number) => {
          if (plan <= 0) return;
          const delta = budget - plan;
          if (Math.abs(delta) / plan > 0.05) {
            discrepancies.push(
              `${label}: presupuesto ${budget.toFixed(2)} ${unit}, plano ${plan.toFixed(2)} ${unit} (diferencia ${delta.toFixed(2)} ${unit})`,
            );
          }
        };
        check("Área", "m²", budgetArea, planGeometry.totalAreaM2);
        check("Longitud", "ml", budgetLinear, planGeometry.totalLinearM);

        return {
          totalBudgetAreaM2: budgetArea,
          totalBudgetLinearM: budgetLinear,
          totalPlanAreaM2: planGeometry.totalAreaM2,
          totalPlanLinearM: planGeometry.totalLinearM,
          coveragePct: planGeometry.totalAreaM2 > 0 ? Math.round((budgetArea / planGeometry.totalAreaM2) * 100) : null,
          discrepancies,
          ok: discrepancies.length === 0,
        };
      },
    }),

    comparar_presupuestos: tool({
      description: "Arma una tabla comparativa entre dos columnas de valores (dos versiones de presupuesto, presupuesto vs. referencia, etc.).",
      inputSchema: z.object({
        title: z.string(),
        columnA: z.string(),
        columnB: z.string(),
        rows: z.array(z.object({
          label: z.string(),
          valueA: z.number().nullable(),
          valueB: z.number().nullable(),
          unit: z.string().optional(),
        })),
      }),
      execute: async (input) => {
        const rows = input.rows.map((r) => {
          const delta = r.valueA !== null && r.valueB !== null ? r.valueA - r.valueB : null;
          const deltaPct = delta !== null && r.valueB ? Math.round((delta / Math.abs(r.valueB)) * 100) : null;
          const status: "higher" | "lower" | "equal" =
            delta === null || Math.abs(deltaPct ?? 0) < 3 ? "equal" : delta > 0 ? "higher" : "lower";
          return { ...r, delta, deltaPct, status };
        });
        return { type: "comparison_table" as const, title: input.title, columnA: input.columnA, columnB: input.columnB, rows };
      },
    }),

    generar_grafica: tool({
      description: "Muestra una gráfica (barras, torta o línea) con hasta 12 puntos. El frontend la renderiza.",
      inputSchema: z.object({
        type: z.enum(["bar", "pie", "line"]),
        title: z.string(),
        data: z.array(z.object({ label: z.string(), value: z.number() })),
        unit: z.string().optional(),
      }),
      execute: async (input) => ({ ...input, data: input.data.slice(0, 12), unit: input.unit ?? "" }),
    }),

    buscar_en_base_documental: tool({
      description:
        "Busca en los documentos subidos por la empresa (presupuestos, pliegos, memorias, planos). " +
        "Usa búsqueda semántica si hay embeddings, o texto completo si no.",
      inputSchema: z.object({
        query: z.string(),
        projectId: z.string().optional().describe("Limita la búsqueda a una obra"),
        topK: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (input) => {
        const results = await searchDocuments(input.query, {
          organizationId: orgId,
          projectId: input.projectId,
          topK: input.topK ?? 5,
        });
        return {
          found: results.length > 0,
          results: results.map((r) => ({
            fileName: r.fileName,
            documentType: r.documentType,
            excerpt: r.chunkText.slice(0, 800),
            score: Math.round(r.score * 100) / 100,
          })),
        };
      },
    }),

    analizar_estado_obra: tool({
      description: "Devuelve qué fases de la obra tienen documentación cargada y cuáles faltan.",
      inputSchema: z.object({ projectId: z.string() }),
      execute: async (input) => getCoverageForProject(input.projectId, orgId),
    }),

    reportar_hallazgos: tool({
      description: "Presenta los hallazgos de la auditoría como tarjetas. Llamarla una sola vez con todos los hallazgos.",
      inputSchema: z.object({ hallazgos: z.array(findingSchema).min(1) }),
      execute: async (input) => ({
        type: "finding_batch" as const,
        hallazgos: input.hallazgos.map((h) => ({ type: "finding_callout" as const, ...h })),
      }),
    }),

    generar_presupuesto_excel: tool({
      description: "Prepara un presupuesto .xlsx descargable a partir del archivo subido (cacheId) o de ítems explícitos.",
      inputSchema: z.object({
        obraName: z.string(),
        cacheId: z.string().optional(),
        items: z.array(z.object({
          code: z.string(),
          description: z.string(),
          quantity: z.number(),
          unit: z.string(),
          unitPrice: z.number(),
          group: z.string().optional().describe("Rubro"),
        })).optional(),
        notes: z.string().optional(),
      }),
      execute: async (input) => {
        const items = input.items?.length ? input.items : (input.cacheId ? getItems(input.cacheId) : null);
        if (!items?.length) return CACHE_MISS;
        return {
          type: "doc_generation_proposal" as const,
          docType: "presupuesto_excel" as const,
          fileName: docFileName("Presupuesto", input.obraName),
          description: `Presupuesto "${input.obraName}" · ${items.length} ítems`,
          payload: { obraName: input.obraName, items, notes: input.notes },
          organizationId: orgId,
        };
      },
    }),

    generar_memoria_descriptiva: tool({
      description: "Prepara una memoria descriptiva .docx con las secciones indicadas.",
      inputSchema: z.object({
        obraName: z.string(),
        sections: z.array(z.object({ title: z.string(), content: z.string() })),
        redactor: z.string().optional(),
      }),
      execute: async (input) => ({
        type: "doc_generation_proposal" as const,
        docType: "memoria_descriptiva" as const,
        fileName: docFileName("Memoria", input.obraName),
        description: `Memoria descriptiva de "${input.obraName}" · ${input.sections.length} secciones`,
        payload: input,
        organizationId: orgId,
      }),
    }),

    generar_informe_pdf: tool({
      description: "Prepara un informe de auditoría .pdf con totales, ítems y hallazgos.",
      inputSchema: z.object({
        title: z.string(),
        veredicto: z.enum(["Aprobado", "Observado", "Requiere revisión"]),
        computedTotal: z.number().optional(),
        declaredTotal: z.number().optional(),
        difference: z.number().optional(),
        items: z.array(z.object({
          code: z.string(),
          description: z.string(),
          quantity: z.number(),
          unit: z.string(),
          unitPrice: z.number(),
          lineTotal: z.number(),
        })).optional(),
        findings: z.array(findingSchema).optional(),
      }),
      execute: async (input) => ({
        type: "doc_generation_proposal" as const,
        docType: "informe_pdf" as const,
        fileName: docFileName("Informe", input.title),
        description: `Informe de auditoría · ${input.veredicto} · ${input.findings?.length ?? 0} hallazgos`,
        payload: input,
        organizationId: orgId,
      }),
    }),

    proponer_cierre_expediente: tool({
      description:
        "Marca el expediente activo como resuelto, con veredicto y resumen. Solo cuando la tarea está completa " +
        "y respaldada por evidencia; un usuario puede reabrirlo.",
      inputSchema: z.object({
        workCaseId: z.string().uuid(),
        verdict: z.enum(WORK_CASE_VERDICTS),
        summary: z.string().min(20).max(2000).describe("Qué se verificó, qué se concluye y qué queda abierto"),
        rationale: z.string().max(600).optional(),
      }),
      execute: async (input) =>
        closeWorkCaseFromAgent({ ...input, organizationId: orgId, actorUserId }),
    }),
  };
}

export type AgentTools = ReturnType<typeof createAgentTools>;
