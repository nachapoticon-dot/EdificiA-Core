import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getRequestLogger } from "@/lib/logger";
import { captureAppError } from "@/lib/observability/error-events";
import { enterpriseContextResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

type EnterpriseDocumentRow = {
  id: string;
  source_id: string | null;
  uploaded_file_id: string | null;
  project_id: string | null;
  work_case_id: string | null;
  readiness_status: "descubierta" | "inventariada" | "clasificada" | "normalizada" | "indexada" | "operativa" | "observada";
  document_type: string;
  title: string;
  source_path: string | null;
  sensitivity: string;
  confidence: number | string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
};

type SourceRow = {
  id: string;
  source_type: string;
  name: string;
  status: string;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  location: string | null;
};

type WorkCaseRow = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  kind: string;
  verdict: "approved" | "flagged" | "inconclusive" | "rejected" | "superseded" | null;
  project_id: string | null;
  updated_at: string;
};

type ReportRow = {
  id: string;
  file_id: string | null;
  verdict: "consistent" | "inconsistent" | "needs_review" | "unsupported";
  findings: unknown;
  risks: unknown;
  updated_at: string;
};

type RelationRow = {
  id: string;
  source_file_id: string;
  target_file_id: string;
  relation_type: string;
  confidence: number | string;
  updated_at: string;
};

type UploadedFileRow = {
  id: string;
  file_name: string;
};

export async function GET(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "enterprise-context-search"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const log = getRequestLogger(req);
  const client = getInsForgeAdminClient();
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, 120);
  const needle = normalize(query);

  try {
    const [sourcesResult, documentsResult, projectsResult, workCasesResult, reportsResult, relationsResult] = await Promise.all([
      client.database
        .from("enterprise_sources")
        .select("id, source_type, name, status")
        .eq("organization_id", auth.orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),

      client.database
        .from("enterprise_documents")
        .select("id, source_id, uploaded_file_id, project_id, work_case_id, readiness_status, document_type, title, source_path, sensitivity, confidence, metadata, updated_at")
        .eq("organization_id", auth.orgId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(150),

      client.database
        .from("projects")
        .select("id, name, status, location")
        .eq("organization_id", auth.orgId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(100),

      client.database
        .from("work_cases")
        .select("id, title, summary, status, kind, verdict, project_id, updated_at")
        .eq("organization_id", auth.orgId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(100),

      client.database
        .from("document_intelligence_reports")
        .select("id, file_id, verdict, findings, risks, updated_at")
        .eq("organization_id", auth.orgId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(150),

      client.database
        .from("obra_relations")
        .select("id, source_file_id, target_file_id, relation_type, confidence, updated_at")
        .eq("organization_id", auth.orgId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);

    if (sourcesResult.error) throw sourcesResult.error;
    if (documentsResult.error) throw documentsResult.error;
    if (projectsResult.error) throw projectsResult.error;
    if (workCasesResult.error) throw workCasesResult.error;
    if (reportsResult.error) throw reportsResult.error;
    if (relationsResult.error) throw relationsResult.error;

    const sources = (sourcesResult.data ?? []) as SourceRow[];
    const documents = (documentsResult.data ?? []) as EnterpriseDocumentRow[];
    const projects = (projectsResult.data ?? []) as ProjectRow[];
    const workCases = (workCasesResult.data ?? []) as WorkCaseRow[];
    const reports = (reportsResult.data ?? []) as ReportRow[];
    const relations = (relationsResult.data ?? []) as RelationRow[];

    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const workCaseById = new Map(workCases.map((workCase) => [workCase.id, workCase]));
    const latestReportByFileId = latestReportMap(reports);

    const fileIds = Array.from(new Set([
      ...relations.map((relation) => relation.source_file_id),
      ...relations.map((relation) => relation.target_file_id),
    ]));
    const fileNameById = await loadFileNames(auth.orgId, fileIds);

    const matchedDocuments = documents
      .filter((doc) => matchesNeedle(needle, [
        doc.title,
        doc.document_type,
        doc.source_path,
        JSON.stringify(doc.metadata ?? {}),
        projectById.get(doc.project_id ?? "")?.name,
        workCaseById.get(doc.work_case_id ?? "")?.title,
      ]))
      .slice(0, 30);

    const matchedProjects = projects
      .filter((project) => matchesNeedle(needle, [project.name, project.status, project.location]))
      .slice(0, 12);

    const matchedWorkCases = workCases
      .filter((workCase) => matchesNeedle(needle, [workCase.title, workCase.summary, workCase.kind, workCase.status, projectById.get(workCase.project_id ?? "")?.name]))
      .slice(0, 12);

    const matchedFileIds = new Set(matchedDocuments.map((doc) => doc.uploaded_file_id).filter((value): value is string => Boolean(value)));
    const matchedRelations = relations
      .filter((relation) => {
        if (matchedFileIds.has(relation.source_file_id) || matchedFileIds.has(relation.target_file_id)) return true;
        return matchesNeedle(needle, [
          relation.relation_type,
          fileNameById.get(relation.source_file_id),
          fileNameById.get(relation.target_file_id),
        ]);
      })
      .slice(0, 20);

    const documentCountsByProject = countDocumentsByProject(documents);
    const observedCountsByProject = countObservedByProject(documents);

    const response = {
      meta: {
        query,
        generatedAt: new Date().toISOString(),
        totalResults: matchedDocuments.length + matchedProjects.length + matchedWorkCases.length + matchedRelations.length,
      },
      summary: {
        sources: sources.length,
        documents: documents.length,
        indexed: documents.filter((doc) => doc.readiness_status === "indexada" || doc.readiness_status === "operativa").length,
        observed: documents.filter((doc) => doc.readiness_status === "observada").length,
        projects: projects.length,
        workCases: workCases.length,
      },
      documents: matchedDocuments.map((doc) => {
        const source = doc.source_id ? sourceById.get(doc.source_id) ?? null : null;
        const project = doc.project_id ? projectById.get(doc.project_id) ?? null : null;
        const workCase = doc.work_case_id ? workCaseById.get(doc.work_case_id) ?? null : null;
        const report = doc.uploaded_file_id ? latestReportByFileId.get(doc.uploaded_file_id) ?? null : null;
        return {
          id: doc.id,
          title: doc.title,
          documentType: doc.document_type,
          readinessStatus: doc.readiness_status,
          sensitivity: doc.sensitivity,
          confidence: doc.confidence == null ? null : Number(doc.confidence),
          sourceName: source?.name ?? null,
          sourceType: source?.source_type ?? null,
          sourcePath: doc.source_path,
          uploadedFileId: doc.uploaded_file_id,
          projectId: doc.project_id,
          projectName: project?.name ?? null,
          workCaseId: doc.work_case_id,
          workCaseTitle: workCase?.title ?? null,
          reportVerdict: report?.verdict ?? null,
          findingsCount: Array.isArray(report?.findings) ? report.findings.length : 0,
          risksCount: Array.isArray(report?.risks) ? report.risks.length : 0,
          why: explainDocumentMatch(needle, doc, project, workCase, source),
          updatedAt: doc.updated_at,
        };
      }),
      projects: matchedProjects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        location: project.location,
        documentCount: documentCountsByProject.get(project.id) ?? 0,
        observedCount: observedCountsByProject.get(project.id) ?? 0,
        why: needle ? "Coincide por nombre, estado, ubicación o documentos asociados." : "Obra disponible en el contexto de empresa.",
      })),
      workCases: matchedWorkCases.map((workCase) => ({
        id: workCase.id,
        title: workCase.title,
        status: workCase.status,
        kind: workCase.kind,
        verdict: workCase.verdict,
        projectId: workCase.project_id,
        projectName: workCase.project_id ? projectById.get(workCase.project_id)?.name ?? null : null,
        why: needle ? "Coincide por título, resumen, tipo, estado u obra vinculada." : "Expediente operativo reciente.",
        updatedAt: workCase.updated_at,
      })),
      relations: matchedRelations.map((relation) => ({
        id: relation.id,
        relationType: relation.relation_type,
        confidence: typeof relation.confidence === "number" ? relation.confidence : Number(relation.confidence) || 0,
        sourceFileName: fileNameById.get(relation.source_file_id) ?? null,
        targetFileName: fileNameById.get(relation.target_file_id) ?? null,
        why: "Relación del grafo documental vinculada a los resultados de la lupa.",
        updatedAt: relation.updated_at,
      })),
    };

    return Response.json(enterpriseContextResponseSchema.parse(response));
  } catch (err) {
    log.error({ err }, "enterprise context search failed");
    await captureAppError({
      err,
      req,
      organizationId: auth.orgId,
      actorUserId: auth.userId,
      route: "/api/enterprise-context/search",
      severity: "error",
      context: { query },
    });
    return Response.json({ error: "No se pudo consultar el contexto de empresa" }, { status: 500 });
  }
}

async function loadFileNames(orgId: string, fileIds: string[]): Promise<Map<string, string>> {
  if (fileIds.length === 0) return new Map();
  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("uploaded_files")
    .select("id, file_name")
    .eq("organization_id", orgId)
    .in("id", fileIds)
    .limit(fileIds.length);

  return new Map(((result.data ?? []) as UploadedFileRow[]).map((row) => [row.id, row.file_name]));
}

function latestReportMap(reports: ReportRow[]): Map<string, ReportRow> {
  const out = new Map<string, ReportRow>();
  for (const report of reports) {
    if (!report.file_id) continue;
    if (!out.has(report.file_id)) out.set(report.file_id, report);
  }
  return out;
}

function countDocumentsByProject(documents: EnterpriseDocumentRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const doc of documents) {
    if (!doc.project_id) continue;
    out.set(doc.project_id, (out.get(doc.project_id) ?? 0) + 1);
  }
  return out;
}

function countObservedByProject(documents: EnterpriseDocumentRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const doc of documents) {
    if (!doc.project_id || doc.readiness_status !== "observada") continue;
    out.set(doc.project_id, (out.get(doc.project_id) ?? 0) + 1);
  }
  return out;
}

function explainDocumentMatch(
  needle: string,
  doc: EnterpriseDocumentRow,
  project: ProjectRow | null,
  workCase: WorkCaseRow | null,
  source: SourceRow | null,
): string {
  if (!needle) return "Documento inventariado en el contexto de empresa.";
  if (normalize(doc.title).includes(needle)) return "Coincide por nombre de documento.";
  if (normalize(doc.document_type).includes(needle)) return "Coincide por tipo documental.";
  if (project && normalize(project.name).includes(needle)) return "Aparece por obra vinculada.";
  if (workCase && normalize(workCase.title).includes(needle)) return "Aparece por expediente vinculado.";
  if (source && normalize(source.name).includes(needle)) return "Aparece por fuente de datos.";
  return "Coincide por metadata o ruta de origen.";
}

function matchesNeedle(needle: string, values: Array<string | null | undefined>): boolean {
  if (!needle) return true;
  return values.some((value) => value != null && normalize(value).includes(needle));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
