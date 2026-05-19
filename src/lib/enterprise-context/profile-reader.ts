import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";

export type EnterpriseProfileFacet =
  | "suppliers"
  | "subcontractors"
  | "trades"
  | "patterns"
  | "coverage"
  | "summary";

export interface EnterpriseProfileForAgent {
  hasSnapshot: boolean;
  snapshotVersion: number | null;
  builtAt: string | null;
  summaryText: string | null;
  topSuppliers: string[];
  topSubcontractors: string[];
  topTrades: string[];
  dominantCurrency: string | null;
  namingHints: string[];
  riskyProjects: Array<{ projectName: string; riskLevel: string; findingsOpen: number }>;
}

interface SnapshotRow {
  version: number;
  built_at: string;
  summary: string | null;
  payload: Record<string, unknown> | null;
}

interface CoverageRow {
  project_id: string;
  risk_level: string;
  findings_open: number;
  coverage_score: number | string;
  metadata: Record<string, unknown> | null;
}

interface ProjectRow {
  id: string;
  name: string;
}

export async function loadEnterpriseProfileForAgent(organizationId: string): Promise<EnterpriseProfileForAgent | null> {
  const client = getInsForgeAdminClient();
  try {
    const [snapshotResult, coverageResult, projectsResult] = await Promise.all([
      client.database
        .from("enterprise_profile_snapshots")
        .select("version, built_at, summary, payload")
        .eq("organization_id", organizationId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      client.database
        .from("enterprise_project_coverage")
        .select("project_id, risk_level, findings_open, coverage_score, metadata")
        .eq("organization_id", organizationId)
        .in("risk_level", ["alto", "critico"])
        .order("coverage_score", { ascending: true })
        .limit(5),
      client.database
        .from("projects")
        .select("id, name")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .limit(200),
    ]);

    if (snapshotResult.error) {
      dbLogger.warn({ err: snapshotResult.error }, "loadEnterpriseProfileForAgent snapshot failed");
    }
    if (coverageResult.error) {
      dbLogger.warn({ err: coverageResult.error }, "loadEnterpriseProfileForAgent coverage failed");
    }

    const snapshot = (snapshotResult.data ?? null) as SnapshotRow | null;
    const coverage = (coverageResult.data ?? []) as CoverageRow[];
    const projects = (projectsResult.data ?? []) as ProjectRow[];

    if (!snapshot) {
      return {
        hasSnapshot: false,
        snapshotVersion: null,
        builtAt: null,
        summaryText: null,
        topSuppliers: [],
        topSubcontractors: [],
        topTrades: [],
        dominantCurrency: null,
        namingHints: [],
        riskyProjects: [],
      };
    }

    const summary = extractSummary(snapshot.payload);
    const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

    const riskyProjects = coverage
      .map((row) => ({
        projectName: projectNameById.get(row.project_id) ?? "Obra sin nombre",
        riskLevel: row.risk_level,
        findingsOpen: row.findings_open,
      }))
      .slice(0, 4);

    return {
      hasSnapshot: true,
      snapshotVersion: snapshot.version,
      builtAt: snapshot.built_at,
      summaryText: snapshot.summary,
      topSuppliers: summary.topSuppliers.slice(0, 3),
      topSubcontractors: summary.topSubcontractors.slice(0, 3),
      topTrades: summary.topTrades.slice(0, 3),
      dominantCurrency: summary.dominantCurrency,
      namingHints: summary.namingHints.slice(0, 3),
      riskyProjects,
    };
  } catch (err) {
    dbLogger.warn({ err }, "loadEnterpriseProfileForAgent exception");
    return null;
  }
}

export interface FacetResult {
  facet: EnterpriseProfileFacet;
  hasSnapshot: boolean;
  snapshotVersion: number | null;
  builtAt: string | null;
  data: unknown;
  notes?: string;
}

export async function queryEnterpriseProfileFacet(args: {
  organizationId: string;
  facet?: EnterpriseProfileFacet;
}): Promise<FacetResult> {
  const facet: EnterpriseProfileFacet = args.facet ?? "summary";
  const client = getInsForgeAdminClient();

  const snapshotResult = await client.database
    .from("enterprise_profile_snapshots")
    .select("version, built_at, summary, payload")
    .eq("organization_id", args.organizationId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotResult.error) dbLogger.warn({ err: snapshotResult.error }, "queryEnterpriseProfileFacet snapshot failed");
  const snapshot = (snapshotResult.data ?? null) as SnapshotRow | null;

  if (!snapshot) {
    return {
      facet,
      hasSnapshot: false,
      snapshotVersion: null,
      builtAt: null,
      data: null,
      notes: "Sin snapshot todavía. Pedile al usuario que recalcule el perfil desde /dashboard/contexto/perfil.",
    };
  }

  switch (facet) {
    case "summary": {
      const summary = extractSummary(snapshot.payload);
      return {
        facet,
        hasSnapshot: true,
        snapshotVersion: snapshot.version,
        builtAt: snapshot.built_at,
        data: {
          text: snapshot.summary,
          projectsCount: summary.projectsCount,
          dominantCurrency: summary.dominantCurrency,
          riskyProjects: summary.riskyProjects,
          namingHints: summary.namingHints,
          topSuppliers: summary.topSuppliers,
          topSubcontractors: summary.topSubcontractors,
          topTrades: summary.topTrades,
        },
      };
    }
    case "suppliers":
    case "subcontractors":
    case "trades": {
      const entities = await loadEntities(args.organizationId, facetToEntityType(facet));
      return {
        facet,
        hasSnapshot: true,
        snapshotVersion: snapshot.version,
        builtAt: snapshot.built_at,
        data: entities,
      };
    }
    case "patterns": {
      const patterns = await loadPatterns(args.organizationId);
      return {
        facet,
        hasSnapshot: true,
        snapshotVersion: snapshot.version,
        builtAt: snapshot.built_at,
        data: patterns,
      };
    }
    case "coverage": {
      const coverage = await loadCoverage(args.organizationId);
      return {
        facet,
        hasSnapshot: true,
        snapshotVersion: snapshot.version,
        builtAt: snapshot.built_at,
        data: coverage,
      };
    }
  }
}

function facetToEntityType(facet: "suppliers" | "subcontractors" | "trades"): string {
  if (facet === "suppliers") return "supplier";
  if (facet === "subcontractors") return "subcontractor";
  return "trade";
}

async function loadEntities(organizationId: string, entityType: string): Promise<Array<{ displayName: string; occurrenceCount: number; confidence: number | null; aliases: string[] }>> {
  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("enterprise_entities")
    .select("id, display_name, occurrence_count, confidence")
    .eq("organization_id", organizationId)
    .eq("entity_type", entityType)
    .is("deleted_at", null)
    .order("occurrence_count", { ascending: false })
    .limit(20);

  if (result.error) {
    dbLogger.warn({ err: result.error }, "loadEntities failed");
    return [];
  }

  const rows = (result.data ?? []) as Array<{
    id: string;
    display_name: string;
    occurrence_count: number;
    confidence: number | string | null;
  }>;

  const ids = rows.map((row) => row.id);
  const aliasResult = ids.length
    ? await client.database
        .from("enterprise_entity_aliases")
        .select("entity_id, alias")
        .eq("organization_id", organizationId)
        .in("entity_id", ids)
        .limit(200)
    : { data: [], error: null };

  if (aliasResult.error) dbLogger.warn({ err: aliasResult.error }, "loadEntities aliases failed");

  const aliasMap = new Map<string, string[]>();
  for (const row of (aliasResult.data ?? []) as Array<{ entity_id: string; alias: string }>) {
    const list = aliasMap.get(row.entity_id) ?? [];
    list.push(row.alias);
    aliasMap.set(row.entity_id, list);
  }

  return rows.map((row) => ({
    displayName: row.display_name,
    occurrenceCount: row.occurrence_count,
    confidence: row.confidence == null ? null : Number(row.confidence),
    aliases: aliasMap.get(row.id) ?? [],
  }));
}

async function loadPatterns(organizationId: string): Promise<Array<{ patternKind: string; patternKey: string; patternValue: Record<string, unknown>; confidence: number; evidenceCount: number }>> {
  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("enterprise_patterns")
    .select("pattern_kind, pattern_key, pattern_value, confidence, evidence_count")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("evidence_count", { ascending: false })
    .limit(40);

  if (result.error) {
    dbLogger.warn({ err: result.error }, "loadPatterns failed");
    return [];
  }

  return ((result.data ?? []) as Array<{
    pattern_kind: string;
    pattern_key: string;
    pattern_value: Record<string, unknown> | null;
    confidence: number | string;
    evidence_count: number;
  }>).map((row) => ({
    patternKind: row.pattern_kind,
    patternKey: row.pattern_key,
    patternValue: row.pattern_value ?? {},
    confidence: typeof row.confidence === "number" ? row.confidence : Number(row.confidence),
    evidenceCount: row.evidence_count,
  }));
}

async function loadCoverage(organizationId: string): Promise<Array<{ projectId: string; projectName: string | null; riskLevel: string; coverageScore: number; documentsTotal: number; documentsObserved: number; findingsOpen: number }>> {
  const client = getInsForgeAdminClient();
  const [coverageResult, projectsResult] = await Promise.all([
    client.database
      .from("enterprise_project_coverage")
      .select("project_id, risk_level, coverage_score, documents_total, documents_observed, findings_open")
      .eq("organization_id", organizationId)
      .order("coverage_score", { ascending: true })
      .limit(50),
    client.database
      .from("projects")
      .select("id, name")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(200),
  ]);

  if (coverageResult.error) dbLogger.warn({ err: coverageResult.error }, "loadCoverage failed");
  const rows = (coverageResult.data ?? []) as Array<{
    project_id: string;
    risk_level: string;
    coverage_score: number | string;
    documents_total: number;
    documents_observed: number;
    findings_open: number;
  }>;
  const nameById = new Map(((projectsResult.data ?? []) as ProjectRow[]).map((p) => [p.id, p.name]));

  return rows.map((row) => ({
    projectId: row.project_id,
    projectName: nameById.get(row.project_id) ?? null,
    riskLevel: row.risk_level,
    coverageScore: typeof row.coverage_score === "number" ? row.coverage_score : Number(row.coverage_score),
    documentsTotal: row.documents_total,
    documentsObserved: row.documents_observed,
    findingsOpen: row.findings_open,
  }));
}

interface ExtractedSummary {
  projectsCount: number;
  dominantCurrency: string | null;
  riskyProjects: number;
  namingHints: string[];
  topSuppliers: string[];
  topSubcontractors: string[];
  topTrades: string[];
}

export function extractSummary(payload: Record<string, unknown> | null): ExtractedSummary {
  const empty: ExtractedSummary = {
    projectsCount: 0,
    dominantCurrency: null,
    riskyProjects: 0,
    namingHints: [],
    topSuppliers: [],
    topSubcontractors: [],
    topTrades: [],
  };
  if (!payload || typeof payload !== "object") return empty;
  const summary = (payload as { summary?: unknown }).summary;
  if (!summary || typeof summary !== "object") return empty;
  const s = summary as Record<string, unknown>;
  return {
    projectsCount: typeof s.projectsCount === "number" ? s.projectsCount : 0,
    dominantCurrency: typeof s.dominantCurrency === "string" ? s.dominantCurrency : null,
    riskyProjects: typeof s.riskyProjects === "number" ? s.riskyProjects : 0,
    namingHints: Array.isArray(s.namingHints) ? (s.namingHints as unknown[]).filter((v): v is string => typeof v === "string") : [],
    topSuppliers: Array.isArray(s.topSuppliers) ? (s.topSuppliers as unknown[]).filter((v): v is string => typeof v === "string") : [],
    topSubcontractors: Array.isArray(s.topSubcontractors) ? (s.topSubcontractors as unknown[]).filter((v): v is string => typeof v === "string") : [],
    topTrades: Array.isArray(s.topTrades) ? (s.topTrades as unknown[]).filter((v): v is string => typeof v === "string") : [],
  };
}
