import { tool } from "ai";
import { z } from "zod";
import { agentTools } from "./agent-tools";

/**
 * Returns agentTools with organizationId REMOVED from the schemas of
 * all org-sensitive tools and bound to the server-verified orgId instead.
 *
 * This prevents prompt injection via document content from overriding the
 * organization context (security fix A-04).
 *
 * Optionally accepts `actorUserId` for tools that record actor identity in
 * the audit log (e.g. enviar_email_stakeholder).
 */
export function createBoundTools(
  orgId: string,
  actorUserId?: string | null,
  scope?: { projectId?: string; workCaseId?: string },
) {
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
    evaluar_impacto_clima:          agentTools.evaluar_impacto_clima,

    // ── Bloques de UI generativa — pure computation, no org context ─────────
    proyectar_metricas:    agentTools.proyectar_metricas,
    proyectar_comparativa: agentTools.proyectar_comparativa,
    proyectar_cronograma:  agentTools.proyectar_cronograma,

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
        if (results.length === 0) return { found: false, message: "No se encontraron fuentes empresariales relevantes.", results: [] };
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
          if (cached) {
            items = cached;
          } else {
            // Cache expired (server restart or >2h). Tell the agent to inform the user.
            return {
              error: true as const,
              message: "El caché del archivo Excel expiró. Pedile al usuario que suba el archivo nuevamente.",
            };
          }
        }
        if (items.length === 0) {
          return {
            error: true as const,
            message: "No hay ítems para generar el presupuesto. Necesito que el usuario suba el archivo Excel o que me indique los ítems explícitamente.",
          };
        }
        const safeDate = new Date().toISOString().slice(0, 10);
        const safeName = input.obraName.replace(/\s+/g, "_").slice(0, 40);
        const fileName = `Presupuesto_${safeName}_${safeDate}`;
        return {
          type: "doc_generation_proposal" as const,
          docType: "presupuesto_excel" as const,
          fileName,
          // itemCount only — keeps the LLM context lean; full payload is in the card below
          description: `Presupuesto "${input.obraName}" generado · ${items.length} ítems · listo para descargar.`,
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

    proyectar_legajo_grafico: tool({
      description: agentTools.proyectar_legajo_grafico.description,
      inputSchema: z.object({
        query:     z.string().describe("Consulta de búsqueda para documentos visuales (ej: 'planos arquitectura', 'fotos inspección')"),
        projectId: z.string().optional().describe("ID del proyecto activo — limita la búsqueda a esta obra"),
        obraCode:  z.string().describe("Código o nombre corto de la obra para el footer del bloque"),
        title:     z.string().optional().describe("Título del bloque — si se omite, se genera automáticamente"),
      }),
      execute: async (input) => {
        const { searchDocuments } = await import("@/lib/rag/search");
        const results = await searchDocuments(input.query, {
          organizationId: orgId,
          projectId: input.projectId,
          topK: 8,
        });

        const VISUAL_TYPES = ["plano", "dxf", "cad", "render", "foto", "imagen", "jpg", "png", "dwg"];
        const scored = results
          .map((r) => {
            const combined = `${r.fileName} ${r.documentType} ${r.constructionDocType}`.toLowerCase();
            return { r, isVisual: VISUAL_TYPES.some((t) => combined.includes(t)) };
          })
          .sort((a, b) => Number(b.isVisual) - Number(a.isVisual))
          .slice(0, 4);

        if (scored.length === 0) {
          return {
            kind: "media" as const,
            title: input.title ?? `Legajo gráfico — ${input.obraCode}`,
            obra: input.obraCode,
            items: [{ kind: "plano" as const, title: "Sin documentos visuales disponibles en esta obra", seed: 1 }],
          };
        }

        const items = scored.map(({ r }) => {
          const name = r.fileName.toLowerCase();
          const kind: "plano" | "render" | "obra" =
            name.includes("plano") || name.includes("dxf") || name.includes("cad") || name.includes("dwg") ? "plano" :
            name.includes("render") || name.includes("fachada") ? "render" : "obra";
          const seed = (r.fileName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5) + 1;
          const ext = r.fileName.split(".").pop()?.toUpperCase();
          return { kind, title: r.fileName.replace(/\.[^.]+$/, ""), documentId: r.fileId ?? undefined, ext, seed };
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

    verificar_ingreso_personal: tool({
      description: agentTools.verificar_ingreso_personal.description,
      inputSchema: z.object({
        cuadrilla: z.string().min(2).describe("Nombre del trabajador, cuadrilla o subcontratista a verificar"),
        projectId: z.string().describe("UUID de la obra activa"),
      }),
      execute: async (input) => {
        const { verifyPersonnelClearance } = await import("@/lib/project-operations/personnel");
        return verifyPersonnelClearance({ ...input, organizationId: orgId });
      },
    }),

    reprogramar_e_informar: tool({
      description: agentTools.reprogramar_e_informar.description,
      inputSchema: z.object({
        taskRef:    z.string().min(1).describe("Código exacto, nombre parcial o UUID de la tarea a reprogramar"),
        newDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Nueva fecha YYYY-MM-DD"),
        reason:     z.string().max(280).optional().describe("Motivo breve de la reprogramación"),
        notifyTo:   z.array(z.string()).max(8).optional().describe("Stakeholders a informar — quedan en el audit_log"),
        projectId:  z.string().describe("UUID de la obra activa"),
      }),
      execute: async (input) => {
        const { reprogramAndInform } = await import("@/lib/project-operations/schedule");
        return reprogramAndInform({ ...input, organizationId: orgId });
      },
    }),

    auditar_curva_inversion: tool({
      description: agentTools.auditar_curva_inversion.description,
      inputSchema: z.object({
        projectId: z.string().describe("UUID de la obra activa"),
        limit:     z.number().int().min(2).max(60).optional().describe("Snapshots máximos (default 24)"),
      }),
      execute: async (input) => {
        const { auditInvestmentCurve } = await import("@/lib/project-operations/financial-curve");
        return auditInvestmentCurve({ ...input, organizationId: orgId });
      },
    }),

    registrar_subcontrato: tool({
      description: agentTools.registrar_subcontrato.description,
      inputSchema: z.object({
        projectId:      z.string().describe("UUID de la obra activa"),
        vendorName:     z.string().min(2),
        trade:          z.string().optional(),
        contractAmount: z.number().nonnegative().optional(),
        currency:       z.string().min(3).max(8).optional(),
        status:         z.enum(["draft", "active", "paused", "completed", "terminated"]).optional(),
        startDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        retentionPct:   z.number().min(0).max(100).optional(),
        contactName:    z.string().optional(),
        contactEmail:   z.string().email().optional(),
        contactPhone:   z.string().optional(),
        note:           z.string().max(280).optional(),
      }),
      execute: async (input) => {
        const { registerSubcontract } = await import("@/lib/project-operations/contracts/subcontracts");
        return registerSubcontract({ ...input, organizationId: orgId });
      },
    }),

    auditar_subcontratos: tool({
      description: agentTools.auditar_subcontratos.description,
      inputSchema: z.object({
        projectId:        z.string().describe("UUID de la obra activa"),
        includeCompleted: z.boolean().optional(),
        horizonDays:      z.number().int().min(1).max(180).optional(),
      }),
      execute: async (input) => {
        const { auditSubcontracts } = await import("@/lib/project-operations/contracts/subcontracts");
        return auditSubcontracts({ ...input, organizationId: orgId });
      },
    }),

    registrar_snapshot_financiero: tool({
      description: agentTools.registrar_snapshot_financiero.description,
      inputSchema: z.object({
        projectId:       z.string().describe("UUID de la obra activa"),
        snapshotDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Fecha YYYY-MM-DD"),
        plannedAmount:   z.number().nullable().optional(),
        actualAmount:    z.number().nullable().optional(),
        committedAmount: z.number().nullable().optional(),
        invoicedAmount:  z.number().nullable().optional(),
        paidAmount:      z.number().nullable().optional(),
        currency:        z.string().min(3).max(8).optional(),
        note:            z.string().max(280).optional(),
      }),
      execute: async (input) => {
        const { registerFinancialSnapshot } = await import("@/lib/project-operations/agent-writers/operational-writers");
        return registerFinancialSnapshot({ ...input, organizationId: orgId, source: "agent" });
      },
    }),

    registrar_hse_record: tool({
      description: agentTools.registrar_hse_record.description,
      inputSchema: z.object({
        projectId:         z.string().describe("UUID de la obra activa"),
        recordType:        z.enum(["art", "epp", "training", "medical", "incident", "access"]),
        subjectName:       z.string().optional(),
        subcontractorName: z.string().optional(),
        workerIdentifier:  z.string().optional(),
        issuedAt:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        expiresAt:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        status:            z.enum(["valid", "expiring", "expired", "missing", "incident"]).optional(),
        note:              z.string().max(280).optional(),
      }),
      execute: async (input) => {
        const { registerHseRecord } = await import("@/lib/project-operations/agent-writers/operational-writers");
        return registerHseRecord({ ...input, organizationId: orgId });
      },
    }),

    registrar_acopio: tool({
      description: agentTools.registrar_acopio.description,
      inputSchema: z.object({
        projectId:        z.string().describe("UUID de la obra activa"),
        mode:             z.enum(["create", "update"]),
        itemName:         z.string().min(2),
        category:         z.string().optional(),
        unit:             z.string().optional(),
        requiredQuantity: z.number().nonnegative().optional(),
        orderedQuantity:  z.number().nonnegative().optional(),
        receivedQuantity: z.number().nonnegative().optional(),
        unitCost:         z.number().nonnegative().optional(),
        currency:         z.string().min(3).max(8).optional(),
        supplierName:     z.string().optional(),
        requiredBy:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        status:           z.enum(["planned", "quoted", "ordered", "partial", "received", "delayed", "cancelled"]).optional(),
        note:             z.string().max(280).optional(),
      }),
      execute: async (input) => {
        const { registerSupplyItem } = await import("@/lib/project-operations/agent-writers/operational-writers");
        return registerSupplyItem({ ...input, organizationId: orgId });
      },
    }),

    resolver_relacion_documental: tool({
      description: agentTools.resolver_relacion_documental.description,
      inputSchema: z.object({
        relationId: z.string().uuid().describe("UUID de la relación"),
        action:     z.enum(["confirm", "dismiss", "supersede"]),
        rationale:  z.string().max(280).optional(),
      }),
      execute: async (input) => {
        const { resolveObraRelation } = await import("@/lib/project-operations/agent-writers/operational-writers");
        return resolveObraRelation({ ...input, organizationId: orgId });
      },
    }),

    consultar_perfil_empresa: tool({
      description: agentTools.consultar_perfil_empresa.description,
      inputSchema: z.object({
        facet: z.enum(["summary", "suppliers", "subcontractors", "trades", "patterns", "coverage"]).optional(),
      }),
      execute: async (input) => {
        const { queryEnterpriseProfileFacet } = await import("@/lib/enterprise-context/profile-reader");
        return queryEnterpriseProfileFacet({ organizationId: orgId, facet: input.facet });
      },
    }),

    recordar_aprendizaje: tool({
      description: agentTools.recordar_aprendizaje.description,
      inputSchema: z.object({
        key:             z.string().min(3).max(100).describe("Clave estable y corta, ej: 'proveedores.hormigon.preferido'"),
        summary:         z.string().min(12).max(700).describe("Aprendizaje operativo confirmado, escrito como hecho reusable"),
        evidence:        z.array(z.string().min(3).max(360)).min(1).max(8).describe("Evidencia textual concreta o frase del usuario que justifica guardarlo"),
        confidence:      z.number().min(0.1).max(1).optional(),
        tags:            z.array(z.string().min(2).max(40)).max(8).optional(),
        confirmedByUser: z.literal(true).describe("Debe ser true solo si hubo confirmación explícita del usuario en este turno"),
      }),
      execute: async (input) => {
        if (!actorUserId) {
          return {
            ok: false,
            reason: "missing_actor",
            message: "No se pudo identificar al usuario; no se guarda memoria activa.",
          };
        }
        const { recordAgentLearning } = await import("@/lib/ai/active-memory");
        return recordAgentLearning({
          organizationId: orgId,
          actorUserId,
          projectId: scope?.projectId ?? null,
          workCaseId: scope?.workCaseId ?? null,
          key: input.key,
          summary: input.summary,
          evidence: input.evidence,
          confidence: input.confidence,
          tags: input.tags,
        });
      },
    }),

    resumen_diario_obra: tool({
      description: agentTools.resumen_diario_obra.description,
      inputSchema: z.object({
        projectId:      z.string().describe("UUID de la obra activa"),
        includeWeather: z.object({
          location:  z.string().optional(),
          latitude:  z.number().min(-90).max(90).optional(),
          longitude: z.number().min(-180).max(180).optional(),
        }).optional(),
      }),
      execute: async (input) => {
        const { buildDailyBrief } = await import("@/lib/project-operations/brief/daily-brief");
        return buildDailyBrief({ ...input, organizationId: orgId });
      },
    }),

    buscar_relaciones_documento: tool({
      description: agentTools.buscar_relaciones_documento.description,
      inputSchema: z.object({
        fileId:       z.string().optional().describe("UUID del archivo"),
        fileName:     z.string().optional().describe("Fragmento del nombre del archivo"),
        projectId:    z.string().optional().describe("Restringe a una obra"),
        relationType: z.enum(["contradicts", "derives_from", "supersedes", "references", "duplicates"]).optional().describe("Filtra por tipo de relación"),
        limit:        z.number().int().min(1).max(50).optional().describe("Cantidad máxima (default 20)"),
      }).refine((value) => value.fileId || value.fileName, {
        message: "Indica fileId o fileName",
      }),
      execute: async (input) => {
        const { queryObraRelations } = await import("@/lib/knowledge-graph/relations");
        const result = await queryObraRelations({
          organizationId: orgId,
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
              ? `No encontré un archivo cuyo nombre contenga "${input.fileName}".`
              : "El fileId no existe en esta organización.",
            relations: [],
          };
        }
        if (result.relations.length === 0) {
          return {
            found: true,
            resolvedFileId: result.resolvedFileId,
            resolvedFileName: result.resolvedFileName,
            relationsCount: 0,
            message: "Sin relaciones registradas.",
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

    generar_orden_compra: tool({
      description: agentTools.generar_orden_compra.description,
      inputSchema: z.object({
        obraName:       z.string(),
        projectId:      z.string().optional(),
        supplyItemId:   z.string().uuid().optional(),
        ordenNumber:    z.string().optional(),
        vendor: z.object({
          name:         z.string().min(2),
          contactName:  z.string().optional(),
          contactEmail: z.string().email().optional(),
          contactPhone: z.string().optional(),
        }),
        items: z.array(z.object({
          description: z.string(),
          quantity:    z.number().nonnegative(),
          unit:        z.string(),
          unitPrice:   z.number().nonnegative(),
        })).min(1).max(50),
        currency:        z.string().min(3).max(8).optional(),
        taxPct:          z.number().min(0).max(100).optional(),
        deliveryAddress: z.string().optional(),
        deliveryDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        paymentTerms:    z.string().optional(),
        notes:           z.string().max(500).optional(),
        signedBy:        z.string().optional(),
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
          organizationId: orgId,
        };
      },
    }),

    generar_acta_obra: tool({
      description: agentTools.generar_acta_obra.description,
      inputSchema: z.object({
        obraName:        z.string(),
        date:            z.string(),
        weatherSummary:  z.string().optional(),
        crew: z.array(z.object({
          name:          z.string().optional(),
          role:          z.string().optional(),
          subcontractor: z.string().optional(),
          count:         z.number().int().min(1).max(200).optional(),
        })).optional(),
        tasksExecuted: z.array(z.object({
          description:  z.string(),
          progress:     z.string().optional(),
          observations: z.string().optional(),
        })).min(1).max(20),
        incidents: z.array(z.object({
          severity:    z.enum(["leve", "moderado", "critico"]),
          description: z.string(),
        })).optional(),
        materialsReceived: z.array(z.object({
          item:     z.string(),
          quantity: z.string().optional(),
          supplier: z.string().optional(),
        })).optional(),
        visitsOnSite: z.array(z.object({
          name: z.string(),
          role: z.string().optional(),
        })).optional(),
        notes:    z.string().max(1000).optional(),
        signedBy: z.string().optional(),
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
          organizationId: orgId,
        };
      },
    }),

    enviar_email_stakeholder: tool({
      description: agentTools.enviar_email_stakeholder.description,
      inputSchema: z.object({
        projectId:      z.string().describe("UUID de la obra activa — define la whitelist"),
        to:             z.array(z.string().email()).min(1).max(5),
        cc:             z.array(z.string().email()).max(5).optional(),
        subject:        z.string().min(3).max(160),
        body:           z.string().min(10).max(5000),
        scheduleTaskId: z.string().uuid().optional(),
        subcontractId:  z.string().uuid().optional(),
      }),
      execute: async (input) => {
        const { sendStakeholderEmail } = await import("@/lib/project-operations/communications/stakeholder-email");
        return sendStakeholderEmail({ ...input, organizationId: orgId, actorUserId });
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

    proponer_cierre_expediente: tool({
      description: agentTools.proponer_cierre_expediente.description,
      inputSchema: z.object({
        workCaseId: z.string().uuid().describe("UUID del expediente operativo activo"),
        verdict: z.enum(["approved", "flagged", "inconclusive", "rejected", "superseded"]).describe("Veredicto final"),
        summary: z.string().min(20).max(2000).describe("Resumen ejecutivo del cierre"),
        rationale: z.string().max(600).optional().describe("Justificación corta del veredicto"),
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
              entityType: z.string().min(1),
              entityId: z.string().optional(),
              label: z.string().max(280).optional(),
              confidence: z.number().min(0).max(1).optional(),
              metadata: z.record(z.unknown()).optional(),
            }),
          )
          .max(20)
          .optional(),
      }),
      execute: async (input) => {
        if (!actorUserId) {
          return {
            ok: false,
            reason: "missing_actor",
            message: "No se pudo identificar al usuario que ejecuta el turno; no se cierra el expediente.",
          };
        }
        const { closeWorkCaseFromAgent } = await import("@/lib/agent-core");
        return closeWorkCaseFromAgent({
          organizationId: orgId,
          actorUserId,
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
}
