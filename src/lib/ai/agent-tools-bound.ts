import { tool } from "ai";
import { z } from "zod";
import { agentTools } from "./agent-tools";

/**
 * Returns agentTools with organizationId REMOVED from the schemas of
 * all org-sensitive tools and bound to the server-verified orgId instead.
 *
 * This prevents prompt injection via document content from overriding the
 * organization context (security fix A-04).
 */
export function createBoundTools(orgId: string) {
  return {
    // ── Pure computation — no org context, pass through unchanged ──────────
    calcular_totales:               agentTools.calcular_totales,
    validar_cierre_de_total:        agentTools.validar_cierre_de_total,
    detectar_exclusiones_logicas:   agentTools.detectar_exclusiones_logicas,
    calcular_incidencia_de_subgrupo: agentTools.calcular_incidencia_de_subgrupo,
    analizar_geometria_plano:       agentTools.analizar_geometria_plano,
    comparar_computo_con_plano:     agentTools.comparar_computo_con_plano,
    generar_grafica:                agentTools.generar_grafica,
    reportar_hallazgo:              agentTools.reportar_hallazgo,
    reportar_hallazgos_batch:       agentTools.reportar_hallazgos_batch,
    comparar_presupuestos:          agentTools.comparar_presupuestos,

    // ── Org-sensitive tools — organizationId removed from schema ───────────

    buscar_en_base_documental: tool({
      description: agentTools.buscar_en_base_documental.description,
      inputSchema: z.object({
        query:     z.string().describe("Consulta de búsqueda en lenguaje natural"),
        projectId: z.string().optional().describe("ID del proyecto activo — limita la búsqueda a esa obra"),
        topK:      z.number().int().min(1).max(10).optional().describe("Cantidad de resultados (default 5)"),
      }),
      execute: async (input) => {
        const { searchDocuments } = await import("@/lib/rag/search");
        const results = await searchDocuments(input.query, {
          organizationId: orgId,
          projectId: input.projectId,
          topK: input.topK ?? 5,
        });
        if (results.length === 0) return { found: false, message: "No se encontraron documentos relevantes en la base documental.", results: [] };
        return {
          found: true,
          count: results.length,
          results: results.map((r) => ({
            fileName: r.fileName, documentType: r.documentType,
            excerpt: r.chunkText.slice(0, 800), score: Math.round(r.score * 100) / 100,
          })),
        };
      },
    }),

    sugerir_formato: tool({
      description: agentTools.sugerir_formato.description,
      inputSchema: z.object({
        documentType:    z.enum(["excel", "pdf", "dxf", "docx"]).describe("Tipo de documento a comparar"),
        currentPatterns: z.record(z.unknown()).optional().describe("Patrones del documento actual"),
      }),
      execute: async (input) => {
        const { searchCrossCompanyPatterns } = await import("@/lib/pattern-extractor/benchmarks");
        return searchCrossCompanyPatterns(input.documentType, orgId, input.currentPatterns);
      },
    }),

    generar_archivo: tool({
      description: agentTools.generar_archivo.description,
      inputSchema: z.object({
        fileName:    z.string().describe("Nombre del archivo propuesto (con extensión, ej. 'computo_yeso.txt')"),
        content:     z.string().describe("Contenido del archivo en texto plano"),
        description: z.string().describe("Descripción breve de qué contiene el archivo y por qué se generó"),
      }),
      execute: async (input) => ({
        type: "file_proposal" as const,
        fileName: input.fileName,
        content: Buffer.from(input.content).toString("base64"),
        contentType: "text/plain",
        description: input.description,
        organizationId: orgId,
        awaiting_confirmation: true,
      }),
    }),

    analizar_estado_obra: tool({
      description: agentTools.analizar_estado_obra.description,
      inputSchema: z.object({
        projectId: z.string().describe("UUID del proyecto activo"),
      }),
      execute: async (input) => {
        const { getCoverageForProject } = await import("@/lib/obra/coverage");
        return getCoverageForProject(input.projectId, orgId);
      },
    }),

    comparar_con_indices: tool({
      description: agentTools.comparar_con_indices.description,
      inputSchema: z.object({
        items: z.array(z.object({
          code: z.string(), description: z.string(), unit: z.string(),
          unitPrice: z.number(), quantity: z.number(),
        })).describe("Ítems del presupuesto a comparar"),
      }),
      execute: async (input) => {
        const { compareItemsWithIndices } = await import("@/lib/indices/compare");
        const comparisons = await compareItemsWithIndices(input.items, orgId);
        if (comparisons.length === 0) return {
          found: false,
          message: "No hay índices de referencia cargados. Podés cargarlos desde el panel de Administración → Índices de Precio.",
          comparisons: [],
        };
        const hasAlerts  = comparisons.some(c => c.alert === "over" || c.alert === "under");
        const overCount  = comparisons.filter(c => c.alert === "over").length;
        const underCount = comparisons.filter(c => c.alert === "under").length;
        return {
          found: true, categoryCount: comparisons.length, hasAlerts, overCount, underCount,
          comparisons: comparisons.map(c => ({
            category: c.categoryLabel, itemCount: c.itemCount, avgBudgetPrice: c.avgBudgetPrice,
            companyRef: c.companyIndex ? { avg: c.companyIndex.value_avg, source: c.companyIndex.source, period: `${c.companyIndex.period_month ?? "?"}/${c.companyIndex.period_year}` } : null,
            cacRef:     c.cacIndex     ? { avg: c.cacIndex.value_avg,     period: `${c.cacIndex.period_month ?? "?"}/${c.cacIndex.period_year}` }     : null,
            indecRef:   c.indecIndex   ? { avg: c.indecIndex.value_avg,   period: `${c.indecIndex.period_month ?? "?"}/${c.indecIndex.period_year}` } : null,
            deviationPct: c.deviationPct, alert: c.alert,
          })),
          summary: hasAlerts
            ? `${overCount > 0 ? `${overCount} categoría(s) sobre índice` : ""}${overCount > 0 && underCount > 0 ? " y " : ""}${underCount > 0 ? `${underCount} categoría(s) bajo índice` : ""}. Revisá las categorías marcadas.`
            : "Todos los precios están dentro del rango de referencia (±15%).",
        };
      },
    }),

    generar_presupuesto_excel: tool({
      description: agentTools.generar_presupuesto_excel.description,
      inputSchema: z.object({
        obraName: z.string().describe("Nombre de la obra o proyecto"),
        cacheId:  z.string().optional().describe("ID de caché del archivo Excel subido — preferido cuando está disponible"),
        items: z.array(z.object({
          code: z.string(), description: z.string(), quantity: z.number(),
          unit: z.string(), unitPrice: z.number(), group: z.string().optional(),
        })).optional().describe("Ítems del presupuesto — omitir si se pasa cacheId"),
        notes: z.string().optional().describe("Notas o aclaraciones al pie del presupuesto"),
      }),
      execute: async (input) => {
        let items = input.items ?? [];
        if (input.cacheId && items.length === 0) {
          const { getItems } = await import("@/lib/file-cache");
          const cached = await getItems(input.cacheId);
          if (cached) items = cached;
        }
        const safeDate = new Date().toISOString().slice(0, 10);
        const safeName = input.obraName.replace(/\s+/g, "_").slice(0, 40);
        return {
          type: "doc_generation_proposal" as const, docType: "presupuesto_excel" as const,
          fileName: `Presupuesto_${safeName}_${safeDate}`,
          description: `Presupuesto de obra "${input.obraName}" · ${items.length} ítems`,
          payload: { obraName: input.obraName, items, notes: input.notes },
          organizationId: orgId,
        };
      },
    }),

    generar_memoria_descriptiva: tool({
      description: agentTools.generar_memoria_descriptiva.description,
      inputSchema: z.object({
        obraName: z.string().describe("Nombre de la obra"),
        sections: z.array(z.object({
          title: z.string().describe("Título de la sección"),
          content: z.string().describe("Contenido de la sección"),
        })).describe("Secciones de la memoria"),
        redactor: z.string().optional().describe("Nombre del profesional redactor"),
      }),
      execute: async (input) => {
        const safeDate = new Date().toISOString().slice(0, 10);
        const safeName = input.obraName.replace(/\s+/g, "_").slice(0, 40);
        return {
          type: "doc_generation_proposal" as const, docType: "memoria_descriptiva" as const,
          fileName: `Memoria_${safeName}_${safeDate}`,
          description: `Memoria descriptiva de "${input.obraName}" · ${input.sections.length} secciones`,
          payload: { obraName: input.obraName, sections: input.sections, redactor: input.redactor },
          organizationId: orgId,
        };
      },
    }),

    recuperar_sesion_anterior: tool({
      description: "Recupera contexto de auditorías previas de esta organización: hallazgos frecuentes y títulos de sesiones recientes. Usá esta herramienta cuando el usuario mencione 'la auditoría anterior', 'lo que vimos la vez pasada', 'los errores habituales' o pida comparar con sesiones previas.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(10).optional().describe("Cantidad de sesiones a recuperar (default 5)"),
      }),
      execute: async (input) => {
        const { getInsForgeAdminClient } = await import("@/lib/insforge/server");
        const client = getInsForgeAdminClient();

        const [historyResult, sessionsResult] = await Promise.all([
          client.database
            .from("company_learned_patterns")
            .select("pattern_value, sample_count, updated_at")
            .eq("organization_id", orgId)
            .eq("document_type", "audit_history")
            .eq("pattern_key", "recent_error_codes")
            .maybeSingle(),

          client.database
            .from("chat_sessions")
            .select("title, file_type, started_at, project_id")
            .eq("organization_id", orgId)
            .is("deleted_at", null)
            .order("started_at", { ascending: false })
            .limit(input.limit ?? 5),
        ]);

        const errorCodes = (historyResult.data?.pattern_value as string[] | undefined) ?? [];
        const sessions = (sessionsResult.data ?? []) as { title: string; file_type: string | null; started_at: number; project_id: string | null }[];

        if (errorCodes.length === 0 && sessions.length === 0) {
          return { found: false, message: "No hay historial de auditorías previas para esta organización." };
        }

        return {
          found: true,
          recurrentErrorCodes: errorCodes,
          auditCount: historyResult.data?.sample_count ?? 0,
          recentSessions: sessions.map((s) => ({
            title: s.title,
            fileType: s.file_type,
            date: new Date(s.started_at).toLocaleDateString("es-AR"),
          })),
        };
      },
    }),

    generar_informe_pdf: tool({
      description: agentTools.generar_informe_pdf.description,
      inputSchema: z.object({
        title:         z.string().describe("Título del informe"),
        veredicto:     z.enum(["Aprobado", "Observado", "Requiere revisión"]).describe("Veredicto final de la auditoría"),
        computedTotal: z.number().optional().describe("Costo directo calculado"),
        declaredTotal: z.number().optional().describe("Total declarado"),
        difference:    z.number().optional().describe("Diferencia"),
        items: z.array(z.object({
          code: z.string(), description: z.string(), quantity: z.number(),
          unit: z.string(), unitPrice: z.number(), lineTotal: z.number(),
        })).optional().describe("Ítems del presupuesto"),
        findings: z.array(z.object({
          severity: z.enum(["error", "warning", "info"]), code: z.string(),
          title: z.string(), detail: z.string(),
          impact: z.string().optional(), item: z.string().optional(),
        })).optional().describe("Hallazgos de la auditoría"),
      }),
      execute: async (input) => {
        const safeDate = new Date().toISOString().slice(0, 10);
        const safeName = input.title.replace(/\s+/g, "_").slice(0, 40);
        return {
          type: "doc_generation_proposal" as const, docType: "informe_pdf" as const,
          fileName: `Informe_${safeName}_${safeDate}`,
          description: `Informe de auditoría · ${input.veredicto} · ${input.findings?.length ?? 0} hallazgos`,
          payload: {
            title: input.title, veredicto: input.veredicto,
            computedTotal: input.computedTotal, declaredTotal: input.declaredTotal, difference: input.difference,
            items: input.items, findings: input.findings,
          },
          organizationId: orgId,
        };
      },
    }),
  };
}
