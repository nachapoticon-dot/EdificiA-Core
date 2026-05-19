import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getRequestLogger, dbLogger } from "@/lib/logger";
import { captureAppError } from "@/lib/observability/error-events";
import { proactivityFindingsResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

type Severity = "info" | "warning" | "critical";

interface OperationalFindingRow {
  finding_key: string;
  type: string;
  severity: Severity;
  title: string;
  detail: string;
  organization_id: string;
  project_id: string;
  project_name: string;
  entity_type: string;
  entity_id: string | null;
  due_date: string | null;
  metadata: Record<string, unknown> | null;
  last_detected_at: string;
}

export async function GET(req: Request) {
  if (!checkRateLimit(rateLimitKey(req, "proactivity"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const log = getRequestLogger(req);
  const url = new URL(req.url);
  const projectIdFilter = url.searchParams.get("projectId");

  try {
    const client = getInsForgeAdminClient();
    let query = client.database
      .from("operational_findings")
      .select("finding_key, type, severity, title, detail, organization_id, project_id, project_name, entity_type, entity_id, due_date, metadata, last_detected_at")
      .eq("organization_id", auth.orgId)
      .eq("status", "open")
      .is("deleted_at", null)
      .order("last_detected_at", { ascending: false })
      .limit(500);

    if (projectIdFilter) query = query.eq("project_id", projectIdFilter);

    const result = await query;
    if (result.error) {
      log.warn({ err: result.error }, "proactivity findings query failed");
      return Response.json({ error: "No se pudieron leer las alertas" }, { status: 500 });
    }

    const rows = (result.data ?? []) as OperationalFindingRow[];
    const findingsByProject = new Map<string, OperationalFindingRow[]>();
    for (const row of rows) {
      const group = findingsByProject.get(row.project_id) ?? [];
      group.push(row);
      findingsByProject.set(row.project_id, group);
    }

    const projects = Array.from(findingsByProject.entries()).map(([projectId, findings]) => {
      const sortedFindings = findings.sort(compareFindings);
      const bySeverity = countBySeverity(sortedFindings);
      return {
        projectId,
        projectName: sortedFindings[0]?.project_name ?? "Obra sin nombre",
        scannedAt: sortedFindings.reduce(
          (latest, finding) => finding.last_detected_at > latest ? finding.last_detected_at : latest,
          sortedFindings[0]?.last_detected_at ?? new Date(0).toISOString(),
        ),
        findingsCount: sortedFindings.length,
        bySeverity,
        findings: sortedFindings.map(toResponseFinding),
      };
    });

    projects.sort((a, b) => (a.bySeverity.critical === b.bySeverity.critical
      ? b.bySeverity.warning - a.bySeverity.warning
      : b.bySeverity.critical - a.bySeverity.critical
    ));

    const totals: Record<Severity, number> = projects.reduce(
      (acc, p) => ({
        info: acc.info + p.bySeverity.info,
        warning: acc.warning + p.bySeverity.warning,
        critical: acc.critical + p.bySeverity.critical,
      }),
      { info: 0, warning: 0, critical: 0 }
    );

    const latestScanAt = projects.reduce<string | null>(
      (latest, p) => (latest === null || p.scannedAt > latest ? p.scannedAt : latest),
      null
    );

    const response = {
      hasData: projects.length > 0,
      latestScanAt,
      projectsScanned: projects.length,
      findingsCount: projects.reduce((sum, p) => sum + p.findingsCount, 0),
      bySeverity: totals,
      projects,
    };

    return Response.json(proactivityFindingsResponseSchema.parse(response));
  } catch (err) {
    dbLogger.error({ err }, "GET /api/proactivity/findings failed");
    await captureAppError({
      err,
      req,
      organizationId: auth.orgId,
      actorUserId: auth.userId,
      route: "/api/proactivity/findings",
      severity: "error",
      context: { projectIdFilter },
    });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

function toResponseFinding(row: OperationalFindingRow) {
  return {
    id: row.finding_key,
    type: row.type,
    severity: row.severity,
    title: row.title,
    detail: row.detail,
    organizationId: row.organization_id,
    projectId: row.project_id,
    projectName: row.project_name,
    entityType: row.entity_type,
    entityId: row.entity_id,
    dueDate: row.due_date,
    metadata: row.metadata ?? undefined,
  };
}

function countBySeverity(rows: OperationalFindingRow[]): Record<Severity, number> {
  return rows.reduce<Record<Severity, number>>(
    (acc, row) => {
      acc[row.severity] += 1;
      return acc;
    },
    { info: 0, warning: 0, critical: 0 },
  );
}

function compareFindings(a: OperationalFindingRow, b: OperationalFindingRow): number {
  const severityDelta = severityRank(b.severity) - severityRank(a.severity);
  if (severityDelta !== 0) return severityDelta;
  return b.last_detected_at.localeCompare(a.last_detected_at);
}

function severityRank(severity: Severity): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}
