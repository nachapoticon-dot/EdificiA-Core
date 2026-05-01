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
  /** Injected so the agent can supply the correct organizationId to tools that require it. */
  organizationId?: string;
  learnedPatterns?: Record<string, unknown>;
  /** Active project selected by the user in the UI. */
  projectName?: string;
  /** UUID of the active project — pass to buscar_en_base_documental for scoped search. */
  projectId?: string;
}): string {
  const agentName = ctx?.agentName ?? "EdificIA";
  const companyName = ctx?.companyName;

  const companySection = companyName
    ? `\n## Empresa activa\nEstás trabajando para **${companyName}**. Todas las auditorías corresponden a esta organización.`
    : "";

  const projectSection = ctx?.projectName
    ? `\n\n## Proyecto activo\nEstás trabajando en el proyecto **"${ctx.projectName}"**. Todos los documentos, cálculos e informes de esta sesión pertenecen a este proyecto. Mencioná el nombre del proyecto en el resumen ejecutivo final.`
    : "";

  // Critical: agent must know its orgId to call buscar_en_base_documental / sugerir_formato / generar_archivo
  const orgIdSection = ctx?.organizationId
    ? `\n\n**ID de organización activa**: \`${ctx.organizationId}\` — usá este valor exacto en el campo \`organizationId\` de las herramientas \`buscar_en_base_documental\`, \`sugerir_formato\` y \`generar_archivo\`.`
    : "";

  const projectIdSection = ctx?.projectId
    ? `\n**ID del proyecto activo**: \`${ctx.projectId}\` — pasá este valor en el campo \`projectId\` de \`buscar_en_base_documental\` para limitar la búsqueda a los archivos de esta obra.`
    : "";

  const patternsSection = ctx?.learnedPatterns
    ? `\n## Patrones aprendidos de esta empresa\n${formatLearnedPatterns(ctx.learnedPatterns)}`
    : "";

  return `Sos ${agentName}, el auditor de obras de Argentina. Trabajás para una plataforma B2B que ayuda a empresas constructoras a detectar errores, inconsistencias y fugas de rentabilidad en sus presupuestos.${companySection}${projectSection}${orgIdSection}${projectIdSection}${patternsSection}

## Generación de documentos
Cuando el usuario pide generar un presupuesto, planilla, tabla o memoria descriptiva:
- Para presupuestos en Excel: usá **generar_presupuesto_excel** con los ítems de la conversación.
- Para memorias descriptivas en Word: usá **generar_memoria_descriptiva** con las secciones necesarias.
- Para informes de auditoría en PDF: usá **generar_informe_pdf** con los resultados del análisis.
- El sistema mostrará una tarjeta de descarga — el usuario descarga el archivo con un clic.
- NO uses \`generar_archivo\` para estos formatos estructurados. Usá las herramientas específicas.

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

**Para mejorar el formato:**
1. **sugerir_formato** → Compara el formato del presupuesto con el estándar del sector (datos anónimos de otras empresas).

**Para validar precios contra índices de mercado:**
1. **comparar_con_indices** → Cruza precios del presupuesto con los índices de la empresa, CAC e INDEC. Mostrá siempre las tres capas disponibles.

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


## Proactividad de obra — comportamiento obligatorio
Cuando hay un **proyecto activo** (ves un ID de proyecto en el contexto):
1. Al inicio de la sesion, usa **analizar_estado_obra** para ver que fases tienen documentacion.
2. Si una fase tiene plano pero no computo: mencionalo y ofrecelo generar.
3. Cuando el usuario suba un archivo, deteca su fase y avisa que documento complementario faltaria.

## Hallazgos
Cuando encontres errores, usa **reportar_hallazgo** para cada uno con codigo (ERR-001, WARN-003) e impacto economico. Luego escribe el resumen ejecutivo.

## Comparaciones
Cuando tengas dos conjuntos de datos, usa **comparar_presupuestos** en vez de listar diferencias en texto.
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
5. La base documental es sagrada: NUNCA la modifiques sin confirmación explícita del usuario.
6. Los índices de precio son registros históricos inmutables. NUNCA podés modificarlos, reemplazarlos ni eliminarlos. Si el usuario pide corregir un precio, decile que debe subir la versión nueva desde el panel de administración — el sistema resuelve la precedencia por fecha automáticamente. Tus herramientas de índices son SOLO de lectura y comparación.`;
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
      projectId: z.string().optional().describe("ID del proyecto activo — limita la búsqueda a documentos de esa obra"),
      topK: z.number().int().min(1).max(10).optional().describe("Cantidad de resultados (default 5)"),
    }),
    execute: async (input: { query: string; organizationId: string; projectId?: string; topK?: number }) => {
      // Dynamic import to avoid bundling server-only code in edge runtime
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
          fileName: r.fileName,
          documentType: r.documentType,
          excerpt: r.chunkText.slice(0, 400),
          score: Math.round(r.score * 100) / 100,
        })),
      };
    },
  }),

  sugerir_formato: tool({
    description:
      "Sugiere mejoras de formato basadas en patrones aprendidos de otras empresas constructoras (datos anónimos). Úsalo cuando el usuario quiera saber si su formato de presupuesto es estándar, si le falta algún rubro típico del sector, o si sus precios están en el rango esperado. Requiere que la empresa haya subido al menos un Excel previamente.",
    inputSchema: z.object({
      documentType: z.enum(["excel", "pdf", "dxf", "docx"]).describe("Tipo de documento a comparar"),
      organizationId: z.string().describe("ID de la organización activa"),
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
      "Reporta un hallazgo puntual encontrado durante el análisis: errores de cálculo, inconsistencias estructurales, faltantes de documentos, etc. El frontend lo renderiza como una tarjeta visual destacada con código, severidad e impacto económico. Usá esta herramienta para CADA hallazgo individual antes de escribir el resumen ejecutivo.",
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

  generar_presupuesto_excel: tool({
    description:
      "Genera un presupuesto de obra en formato .xlsx listo para descargar. Úsalo cuando el usuario pide 'haceme un presupuesto', 'generá la planilla', 'exportá los ítems en Excel', etc. Los ítems pueden venir de la conversación, del análisis de un documento o de lo que el usuario dicte.",
    inputSchema: z.object({
      obraName: z.string().describe("Nombre de la obra o proyecto"),
      items: z.array(z.object({
        code:        z.string().describe("Código del ítem (ej. '1.1', 'MOB-01')"),
        description: z.string().describe("Descripción del ítem"),
        quantity:    z.number().describe("Cantidad"),
        unit:        z.string().describe("Unidad de medida (m², ml, un, hs, kg, etc.)"),
        unitPrice:   z.number().describe("Precio unitario en pesos"),
        group:       z.string().optional().describe("Rubro o capítulo al que pertenece el ítem"),
      })).describe("Ítems del presupuesto a incluir en el Excel"),
      notes:         z.string().optional().describe("Notas o aclaraciones al pie del presupuesto"),
      organizationId: z.string().describe("ID de la organización activa"),
    }),
    execute: async (input) => {
      const safeDate = new Date().toISOString().slice(0, 10);
      const safeName = input.obraName.replace(/\s+/g, "_").slice(0, 40);
      return {
        type: "doc_generation_proposal" as const,
        docType: "presupuesto_excel" as const,
        fileName: `Presupuesto_${safeName}_${safeDate}`,
        description: `Presupuesto de obra "${input.obraName}" · ${input.items.length} ítems`,
        payload: {
          obraName: input.obraName,
          items:    input.items,
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
      obraName:  z.string().describe("Nombre de la obra"),
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

      const hasAlerts = comparisons.some(c => c.alert === "over" || c.alert === "under");
      const overCount = comparisons.filter(c => c.alert === "over").length;
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
          delta === null || Math.abs(deltaPct ?? 0) < 3
            ? "equal"
            : delta > 0
            ? "higher"
            : "lower";
        return { ...r, delta, deltaPct, status };
      });
      return { type: "comparison_table" as const, title: input.title, columnA: input.columnA, columnB: input.columnB, rows };
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
