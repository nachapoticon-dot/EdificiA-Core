import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getRequestLogger } from "@/lib/logger";
import { captureAppError } from "@/lib/observability/error-events";
import {
  enterpriseProfileResponseSchema,
  type EnterpriseProfileResponse,
} from "@/lib/validators/api-responses";

export const runtime = "nodejs";

type EntityRow = {
  id: string;
  entity_type: EnterpriseProfileResponse["entities"][number]["entityType"];
  canonical_name: string;
  display_name: string;
  occurrence_count: number;
  confidence: number | string | null;
  last_seen_at: string | null;
};

type AliasRow = {
  entity_id: string;
  alias: string;
};

type PatternRow = {
  id: string;
  pattern_kind: EnterpriseProfileResponse["patterns"][number]["patternKind"];
  pattern_key: string;
  pattern_value: Record<string, unknown> | null;
  confidence: number | string;
  evidence_count: number;
  last_observed_at: string | null;
};

type CoverageRow = {
  project_id: string;
  documents_total: number;
  documents_indexed: number;
  documents_observed: number;
  subcontracts_count: number;
  supplies_count: number;
  hse_records_count: number;
  schedule_tasks_count: number;
  findings_open: number;
  reports_count: number;
  coverage_score: number | string;
  risk_level: EnterpriseProfileResponse["coverage"][number]["riskLevel"];
  last_activity_at: string | null;
  computed_at: string;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string | null;
};

type SnapshotRow = {
  id: string;
  version: number;
  built_at: string;
  trigger_source: string | null;
};

export async function GET(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "enterprise-context-profile"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const log = getRequestLogger(req);
  const client = getInsForgeAdminClient();

  try {
    const [entitiesResult, aliasesResult, patternsResult, coverageResult, projectsResult, snapshotResult] =
      await Promise.all([
        client.database
          .from("enterprise_entities")
          .select("id, entity_type, canonical_name, display_name, occurrence_count, confidence, last_seen_at")
          .eq("organization_id", auth.orgId)
          .is("deleted_at", null)
          .order("occurrence_count", { ascending: false })
          .limit(200),
        client.database
          .from("enterprise_entity_aliases")
          .select("entity_id, alias")
          .eq("organization_id", auth.orgId)
          .limit(500),
        client.database
          .from("enterprise_patterns")
          .select("id, pattern_kind, pattern_key, pattern_value, confidence, evidence_count, last_observed_at")
          .eq("organization_id", auth.orgId)
          .is("deleted_at", null)
          .order("evidence_count", { ascending: false })
          .limit(100),
        client.database
          .from("enterprise_project_coverage")
          .select(
            "project_id, documents_total, documents_indexed, documents_observed, subcontracts_count, supplies_count, hse_records_count, schedule_tasks_count, findings_open, reports_count, coverage_score, risk_level, last_activity_at, computed_at",
          )
          .eq("organization_id", auth.orgId)
          .order("coverage_score", { ascending: false })
          .limit(200),
        client.database
          .from("projects")
          .select("id, name, status")
          .eq("organization_id", auth.orgId)
          .is("deleted_at", null)
          .limit(200),
        client.database
          .from("enterprise_profile_snapshots")
          .select("id, version, built_at, trigger_source")
          .eq("organization_id", auth.orgId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (entitiesResult.error) throw entitiesResult.error;
    if (aliasesResult.error) throw aliasesResult.error;
    if (patternsResult.error) throw patternsResult.error;
    if (coverageResult.error) throw coverageResult.error;
    if (projectsResult.error) throw projectsResult.error;

    const entities = (entitiesResult.data ?? []) as EntityRow[];
    const aliases = (aliasesResult.data ?? []) as AliasRow[];
    const patterns = (patternsResult.data ?? []) as PatternRow[];
    const coverage = (coverageResult.data ?? []) as CoverageRow[];
    const projects = (projectsResult.data ?? []) as ProjectRow[];
    const snapshot = (snapshotResult.data ?? null) as SnapshotRow | null;

    const aliasesByEntity = new Map<string, string[]>();
    for (const alias of aliases) {
      const list = aliasesByEntity.get(alias.entity_id) ?? [];
      list.push(alias.alias);
      aliasesByEntity.set(alias.entity_id, list);
    }

    const projectById = new Map(projects.map((project) => [project.id, project]));

    const dominantCurrency = patterns.find((p) => p.pattern_kind === "currency");
    const dominantCurrencyValue =
      dominantCurrency?.pattern_value && typeof dominantCurrency.pattern_value === "object"
        ? String((dominantCurrency.pattern_value as { currency?: unknown }).currency ?? "") || null
        : null;

    const summaryText = snapshot
      ? `Perfil v${snapshot.version} actualizado ${snapshot.built_at}`
      : "Sin snapshot generado todavía";

    const riskyProjects = coverage.filter((c) => c.risk_level === "alto" || c.risk_level === "critico").length;

    const response: EnterpriseProfileResponse = {
      meta: {
        organizationId: auth.orgId,
        generatedAt: new Date().toISOString(),
        latestSnapshotAt: snapshot?.built_at ?? null,
        latestSnapshotVersion: snapshot?.version ?? null,
        triggerSource: snapshot?.trigger_source ?? null,
      },
      summary: {
        text: summaryText,
        projectsCount: projects.length,
        entityCount: entities.length,
        patternCount: patterns.length,
        coverageCount: coverage.length,
        riskyProjects,
        dominantCurrency: dominantCurrencyValue,
      },
      entities: entities.map((row) => ({
        id: row.id,
        entityType: row.entity_type,
        canonicalName: row.canonical_name,
        displayName: row.display_name,
        occurrenceCount: row.occurrence_count,
        confidence: row.confidence == null ? null : Number(row.confidence),
        lastSeenAt: row.last_seen_at,
        aliases: aliasesByEntity.get(row.id) ?? [],
      })),
      patterns: patterns.map((row) => ({
        id: row.id,
        patternKind: row.pattern_kind,
        patternKey: row.pattern_key,
        patternValue: (row.pattern_value ?? {}) as Record<string, unknown>,
        confidence: typeof row.confidence === "number" ? row.confidence : Number(row.confidence),
        evidenceCount: row.evidence_count,
        lastObservedAt: row.last_observed_at,
      })),
      coverage: coverage.map((row) => {
        const project = projectById.get(row.project_id) ?? null;
        return {
          projectId: row.project_id,
          projectName: project?.name ?? null,
          projectStatus: project?.status ?? null,
          documentsTotal: row.documents_total,
          documentsIndexed: row.documents_indexed,
          documentsObserved: row.documents_observed,
          subcontractsCount: row.subcontracts_count,
          suppliesCount: row.supplies_count,
          hseRecordsCount: row.hse_records_count,
          scheduleTasksCount: row.schedule_tasks_count,
          findingsOpen: row.findings_open,
          reportsCount: row.reports_count,
          coverageScore: typeof row.coverage_score === "number" ? row.coverage_score : Number(row.coverage_score),
          riskLevel: row.risk_level,
          lastActivityAt: row.last_activity_at,
          computedAt: row.computed_at,
        };
      }),
    };

    return Response.json(enterpriseProfileResponseSchema.parse(response));
  } catch (err) {
    log.error({ err }, "enterprise profile fetch failed");
    await captureAppError({
      err,
      req,
      organizationId: auth.orgId,
      actorUserId: auth.userId,
      route: "/api/enterprise-context/profile",
      severity: "error",
    });
    return Response.json({ error: "No se pudo cargar el perfil de empresa" }, { status: 500 });
  }
}
