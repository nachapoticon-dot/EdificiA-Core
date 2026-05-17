import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getRequestLogger, dbLogger } from "@/lib/logger";
import { proactivityFindingsResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

type Severity = "info" | "warning" | "critical";

interface AuditEventRow {
  project_id: string | null;
  created_at: string;
  payload: {
    projectName?: string;
    findingCount?: number;
    bySeverity?: Partial<Record<Severity, number>>;
    findings?: unknown[];
  } | null;
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
      .from("audit_log_events")
      .select("project_id, created_at, payload")
      .eq("organization_id", auth.orgId)
      .eq("event_type", "project.proactivity_scan")
      .order("created_at", { ascending: false })
      .limit(120);

    if (projectIdFilter) query = query.eq("project_id", projectIdFilter);

    const result = await query;
    if (result.error) {
      log.warn({ err: result.error }, "proactivity findings query failed");
      return Response.json({ error: "No se pudieron leer las alertas" }, { status: 500 });
    }

    const rows = (result.data ?? []) as AuditEventRow[];
    const latestPerProject = new Map<string, AuditEventRow>();
    for (const row of rows) {
      if (!row.project_id) continue;
      if (!latestPerProject.has(row.project_id)) latestPerProject.set(row.project_id, row);
    }

    const projects = Array.from(latestPerProject.values()).map((row) => {
      const findings = (row.payload?.findings ?? []).filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null);
      const bySeverity: Record<Severity, number> = {
        info: row.payload?.bySeverity?.info ?? 0,
        warning: row.payload?.bySeverity?.warning ?? 0,
        critical: row.payload?.bySeverity?.critical ?? 0,
      };
      return {
        projectId: row.project_id!,
        projectName: row.payload?.projectName ?? "Obra sin nombre",
        scannedAt: row.created_at,
        findingsCount: row.payload?.findingCount ?? findings.length,
        bySeverity,
        findings: findings as unknown,
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
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
