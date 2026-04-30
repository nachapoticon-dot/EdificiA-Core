import { tool } from "ai";
import { z } from "zod";
import {
  calcularTotalesInputSchema,
  validarCierreInputSchema,
  detectarExclusionesInputSchema,
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
import type { DxfGeometrySummary } from "@/lib/file-processor/types";

export const AI_MODEL = "claude-sonnet-4-6";

/** Builds a dynamic system prompt that incorporates company context. */
export function buildSystemPrompt(ctx?: {
  companyName?: string;
  agentName?: string;
  learnedPatterns?: Record<string, unknown>;
}): string {
  const agentName = ctx?.agentName ?? "EdificIA";
  const companyName = ctx?.companyName;

  const companySection = companyName
    ? `\n## Empresa activa\nEstás trabajando para **${companyName}**. Todas las auditorías corresponden a esta organización.`
    : "";

  const patternsSection = ctx?.learnedPatterns
    ? `\n## Patrones aprendidos de esta empresa\n${formatLearnedPatterns(ctx.learnedPatterns)}`
    : "";

  return `Sos ${agentName}, el auditor de obras de Argentina. Trabajás para una plataforma B2B que ayuda a empresas constructoras a detectar errores, inconsistencias y fugas de rentabilidad en sus presupuestos.${companySection}${patternsSection}

## Tu estilo de trabajo
- Sos preciso y directo. Los ingenieros no quieren rodeos.
- Cuando detectás un error, lo nombrás claramente con el ítem afectado y el impacto económico en pesos.
- Cuando el presupuesto está correcto, lo confirmás con un resumen ejecutivo estructurado.
- Si los datos son incompletos, identificás exactamente qué falta antes de proceder.
- Usás los términos del sector: "costo directo", "incidencia", "rubros", "subcontratistas", "mano de obra", "materiales", "cómputo métrico".

## Tus herramientas — úsalas SIEMPRE, en orden
**Para Excel y presupuestos:**
1. **calcular_totales** → Primer paso: calcula totales y costo directo.
2. **validar_cierre_de_total** → Verifica que el presupuesto cierre.
3. **detectar_exclusiones_logicas** → Encuentra los 9 tipos de inconsistencias estructurales.
4. **calcular_incidencia_de_subgrupo** → Peso porcentual de cada rubro.
5. **generar_grafica** → Visualiza los rubros más pesados o las anomalías detectadas.

**Para planos DXF:**
1. **analizar_geometria_plano** → Extrae cómputo métrico de coordenadas reales.
2. **generar_grafica** → Muestra distribución de áreas por capa.

**Para cruzar presupuesto y plano:**
1. **comparar_computo_con_plano** → Detecta diferencias entre cantidades del presupuesto y geometría del plano.

## Flujo obligatorio — Excel
1. calcular_totales → verificá costo directo real vs declarado.
2. validar_cierre_de_total (si hay total) → detectá brechas.
3. detectar_exclusiones_logicas → 9 reglas de auditoría.
4. calcular_incidencia_de_subgrupo → analizá rubros ≥ 10%.
5. generar_grafica → gráfico de incidencia de rubros.
6. Resumen ejecutivo:
   - **Veredicto**: [✓ Aprobado / ✗ Observado / ⚠ Requiere revisión]
   - **Costo directo calculado**: $X.XXX.XXX
   - **Brecha detectada**: $X.XXX (si aplica)
   - **Hallazgos** (lista numerada por severidad: error → warning → info)
   - **Recomendación**

## Flujo obligatorio — DXF
1. analizar_geometria_plano → cómputo métrico.
2. generar_grafica → distribución de áreas.
3. Interpretación del tipo de plano y elementos constructivos.

## Base documental — reglas de la base sagrada
- La base documental es **SOLO LECTURA**. No podés borrar ni modificar archivos de la empresa.
- Para buscar información sobre proyectos anteriores, planos o documentos: usá **buscar_en_base_documental**.
- Si el usuario pide que borres o modifiques un archivo existente: respondé que eso no es una función del agente. Los archivos de la empresa son intocables.
- Si generás un archivo nuevo (cómputo, remito, tabla), **no lo guardés sin confirmación del usuario**. Usá **generar_archivo** para proponer el archivo, y el sistema pedirá confirmación antes de guardarlo.

## Reglas de oro
1. NUNCA inventes números. Si no tenés los datos, pedílos.
2. SIEMPRE usá las herramientas matemáticas. Nunca calcules mentalmente.
3. El motor es agnóstico: no existe "un solo valor correcto" de incidencia. Vos analizás en contexto.
4. Cuando detectés una "Fuga de Rentabilidad", cuantificala en pesos.
5. La base documental es sagrada: NUNCA la modifiques sin confirmación explícita del usuario.`;
}

/** Formats learned patterns into a readable context block. */
function formatLearnedPatterns(patterns: Record<string, unknown>): string {
  const lines: string[] = [];

  const excel = patterns["excel"] as Record<string, unknown> | undefined;
  if (excel) {
    const colAliases = excel["column_aliases"] as { units?: string[]; code_prefix_set?: string[] } | undefined;
    if (colAliases?.units?.length) {
      lines.push(`- Unidades de medida típicas: ${(colAliases.units as string[]).join(", ")}`);
    }
    if (colAliases?.code_prefix_set?.length) {
      lines.push(`- Prefijos de código de rubros: ${(colAliases.code_prefix_set as string[]).join(", ")}`);
    }
    const priceRanges = excel["price_ranges"] as { min?: number; max?: number; avg?: number } | undefined;
    if (priceRanges?.avg) {
      lines.push(`- Rango de precios unitarios: $${Math.round(priceRanges.min ?? 0).toLocaleString("es-AR")} – $${Math.round(priceRanges.max ?? 0).toLocaleString("es-AR")} (promedio $${Math.round(priceRanges.avg).toLocaleString("es-AR")})`);
    }
  }

  const dxf = patterns["dxf"] as Record<string, unknown> | undefined;
  if (dxf) {
    const layers = dxf["layer_conventions"] as string[] | undefined;
    if (layers?.length) {
      lines.push(`- Capas DXF conocidas: ${layers.slice(0, 10).join(", ")}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "Sin patrones previos registrados.";
}

// Default system prompt (no company context)
export const SYSTEM_PROMPT = buildSystemPrompt();

// ── Tool schemas ─────────────────────────────────────────────────────────────

const geometrySummarySchema = z.object({
  totalAreaM2: z.number(),
  totalLinearM: z.number(),
  areasByLayer: z.array(z.object({ layer: z.string(), areaM2: z.number() })),
  linearByLayer: z.array(z.object({ layer: z.string(), totalM: z.number() })),
  unitFactor: z.number(),
});

const chartDataSchema = z.object({
  type: z.enum(["bar", "pie", "line"]).describe("Tipo de gráfica"),
  title: z.string().describe("Título de la gráfica"),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
  })).describe("Datos de la gráfica (máx 12 puntos para legibilidad)"),
  unit: z.string().optional().describe("Unidad de los valores (ej. '%', '$', 'm²')"),
});

// ── Tool implementations ──────────────────────────────────────────────────────

export const agentTools = {
  calcular_totales: tool({
    description:
      "Calcula los totales individuales de cada ítem y el costo directo total del presupuesto. Úsalo cuando necesités saber cuánto suma el presupuesto o verificar los cálculos línea por línea.",
    inputSchema: calcularTotalesInputSchema,
    execute: async (input: { items: BudgetItem[]; declaredTotal?: number }) => {
      const lineTotals = input.items.map(calcularTotalLinea);
      const computedTotal = calcularCostoDirecto(input.items);
      const diff = input.declaredTotal != null
        ? Math.round((input.declaredTotal - computedTotal) * 100) / 100
        : null;

      return {
        computedTotal,
        declaredTotal: input.declaredTotal ?? null,
        difference: diff,
        lineTotals,
        itemCount: input.items.length,
      };
    },
  }),

  validar_cierre_de_total: tool({
    description:
      "Verifica que la suma de los ítems coincida con el total declarado del presupuesto. Detecta errores de redondeo y líneas mal calculadas. Úsalo para auditar si el presupuesto 'cierra' correctamente.",
    inputSchema: validarCierreInputSchema,
    execute: async (input: {
      items: BudgetItem[];
      declaredTotal: number;
      tolerancePct?: number;
    }) => {
      return validarCierreDeTotal(
        input.items,
        input.declaredTotal,
        input.tolerancePct,
      );
    },
  }),

  detectar_exclusiones_logicas: tool({
    description:
      "Encuentra inconsistencias estructurales en el presupuesto. Ejecuta 9 reglas: subcontrato+mano de obra, precio cero, total mal calculado, cantidad cero, códigos duplicados, ítems de porcentaje, valores negativos, precios redondos sospechosos, y outliers estadísticos de precio. Úsalo en toda auditoría.",
    inputSchema: detectarExclusionesInputSchema,
    execute: async (input: { items: BudgetItem[] }) => {
      const issues = detectarExclusionesLogicas(input.items);
      const byseverity = {
        error:   issues.filter((i) => i.severity === "error"),
        warning: issues.filter((i) => i.severity === "warning"),
        info:    issues.filter((i) => i.severity === "info"),
      };
      return {
        totalIssues: issues.length,
        byseverity,
        ok: issues.filter((i) => i.severity !== "info").length === 0,
        resumen:
          issues.length === 0
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

      const areaItems = budgetItems.filter((i) =>
        ["m2", "m²", "M2", "M²"].includes(i.unit)
      );
      const linearItems = budgetItems.filter((i) =>
        ["ml", "m", "ML", "M"].includes(i.unit)
      );

      const totalBudgetArea = areaItems.reduce((s, i) => s + i.quantity, 0);
      const totalBudgetLinear = linearItems.reduce((s, i) => s + i.quantity, 0);

      const areaDelta = planGeometry.totalAreaM2 > 0
        ? totalBudgetArea - planGeometry.totalAreaM2
        : null;
      const linearDelta = planGeometry.totalLinearM > 0
        ? totalBudgetLinear - planGeometry.totalLinearM
        : null;

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
        budgetAreaItems: areaItems.length,
        budgetLinearItems: linearItems.length,
        totalBudgetAreaM2: totalBudgetArea,
        totalBudgetLinearM: totalBudgetLinear,
        totalPlanAreaM2: planGeometry.totalAreaM2,
        totalPlanLinearM: planGeometry.totalLinearM,
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
    execute: async (input) => {
      // The agent just returns the spec — frontend intercepts and renders it with Recharts.
      return {
        chartType: input.type,
        title: input.title,
        data: input.data.slice(0, 12),
        unit: input.unit ?? "",
        rendered: true,
      };
    },
  }),

  buscar_en_base_documental: tool({
    description:
      "Busca información en la base documental de la empresa (planos, presupuestos, remitos, memorias, etc.). Úsala antes de responder preguntas sobre proyectos anteriores, formatos que usa la empresa, o cualquier dato que pueda estar en documentos subidos. La búsqueda es semántica cuando hay embeddings disponibles, o por texto si no.",
    inputSchema: z.object({
      query: z.string().describe("Consulta de búsqueda en lenguaje natural"),
      organizationId: z.string().describe("ID de la organización activa"),
      topK: z.number().int().min(1).max(10).optional().describe("Cantidad de resultados (default 5)"),
    }),
    execute: async (input: { query: string; organizationId: string; topK?: number }) => {
      // Dynamic import to avoid bundling server-only code in edge runtime
      const { searchDocuments } = await import("@/lib/rag/search");
      const results = await searchDocuments(input.query, {
        organizationId: input.organizationId,
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
          fileName: r.fileName,
          documentType: r.documentType,
          excerpt: r.chunkText.slice(0, 400),
          score: Math.round(r.score * 100) / 100,
        })),
      };
    },
  }),

  generar_archivo: tool({
    description:
      "Propone guardar un archivo generado por el agente en la base documental de la empresa. IMPORTANTE: esto NO guarda el archivo directamente — el usuario debe revisar y confirmar. Usá esta herramienta cuando hayas generado un cómputo, remito, tabla o cualquier documento listo para guardar.",
    inputSchema: z.object({
      fileName: z.string().describe("Nombre del archivo propuesto (con extensión, ej. 'computo_yeso_planta_baja.txt')"),
      content: z.string().describe("Contenido del archivo en texto plano"),
      description: z.string().describe("Descripción breve de qué contiene el archivo y por qué se generó"),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input: { fileName: string; content: string; description: string; organizationId: string }) => {
      // Returns a proposal spec — the frontend (MessageBubble) intercepts this
      // and renders a DocumentProposalCard for the user to accept or reject.
      return {
        type: "file_proposal",
        fileName: input.fileName,
        content: Buffer.from(input.content).toString("base64"),
        contentType: "text/plain",
        description: input.description,
        organizationId: input.organizationId,
        awaiting_confirmation: true,
      };
    },
  }),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function interpretLayerName(layer: string): string {
  const lower = layer.toLowerCase();
  if (lower.includes("muro") || lower.includes("wall") || lower.includes("pared")) return "Muros";
  if (lower.includes("losa") || lower.includes("slab") || lower.includes("techo")) return "Losas/Techos";
  if (lower.includes("piso") || lower.includes("floor")) return "Pisos";
  if (lower.includes("local") || lower.includes("habitación") || lower.includes("room")) return "Locales";
  if (lower.includes("viga") || lower.includes("beam")) return "Vigas";
  if (lower.includes("column")) return "Columnas";
  if (lower.includes("puerta") || lower.includes("door") || lower.includes("ventana") || lower.includes("window")) return "Aberturas";
  if (lower.includes("exterior") || lower.includes("fachada")) return "Fachada/Exterior";
  return layer;
}
