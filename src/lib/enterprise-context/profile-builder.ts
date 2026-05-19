import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import {
  aggregateEnterpriseProfile,
  type EntityCandidate,
  type PatternCandidate,
  type ProfileAggregation,
  type ProfileInputs,
  type ProjectCoverage,
} from "./profile-aggregator";

const MAX_PROJECTS = 200;
const MAX_SUBCONTRACTS = 500;
const MAX_SUPPLIES = 1000;
const MAX_HSE = 500;
const MAX_SCHEDULE = 1000;
const MAX_FINANCIALS = 500;
const MAX_DOCUMENTS = 1000;
const MAX_REPORTS = 500;
const MAX_FINDINGS = 500;

export type ProfileTriggerSource = "manual" | "scheduled" | "upload" | "system";

export interface RebuildResult {
  snapshotId: string;
  version: number;
  entityCount: number;
  patternCount: number;
  coverageCount: number;
  summary: string;
}

export async function rebuildEnterpriseProfile(args: {
  organizationId: string;
  triggerSource?: ProfileTriggerSource;
  builtByUserId?: string | null;
}): Promise<RebuildResult> {
  const orgId = args.organizationId;
  const triggerSource: ProfileTriggerSource = args.triggerSource ?? "manual";
  const inputs = await loadProfileInputs(orgId);
  const aggregation = aggregateEnterpriseProfile(inputs);

  const projectIds = new Set(inputs.projects.map((p) => p.id));

  await syncEntities({ organizationId: orgId, entities: aggregation.entities });
  await syncPatterns({ organizationId: orgId, patterns: aggregation.patterns });
  await syncCoverage({ organizationId: orgId, coverage: aggregation.coverage.filter((c) => projectIds.has(c.projectId)) });
  const snapshot = await writeSnapshot({
    organizationId: orgId,
    aggregation,
    triggerSource,
    builtByUserId: args.builtByUserId ?? null,
  });

  return {
    snapshotId: snapshot.id,
    version: snapshot.version,
    entityCount: aggregation.entities.length,
    patternCount: aggregation.patterns.length,
    coverageCount: aggregation.coverage.length,
    summary: aggregation.summary.text,
  };
}

async function loadProfileInputs(organizationId: string): Promise<ProfileInputs> {
  const client = getInsForgeAdminClient();
  const [
    projects,
    subcontracts,
    supplies,
    hse,
    schedule,
    financials,
    documents,
    reports,
    findings,
  ] = await Promise.all([
    client.database
      .from("projects")
      .select("id, name, status, location, updated_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(MAX_PROJECTS),
    client.database
      .from("project_subcontracts")
      .select("project_id, vendor_name, trade, contract_amount, currency, status, updated_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(MAX_SUBCONTRACTS),
    client.database
      .from("project_supply_items")
      .select("project_id, item_name, category, supplier_name, currency, status, updated_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(MAX_SUPPLIES),
    client.database
      .from("project_hse_records")
      .select("project_id, status, record_type, updated_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(MAX_HSE),
    client.database
      .from("project_schedule_tasks")
      .select("project_id, status, updated_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(MAX_SCHEDULE),
    client.database
      .from("project_financial_snapshots")
      .select("project_id, currency, updated_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(MAX_FINANCIALS),
    client.database
      .from("enterprise_documents")
      .select("project_id, document_type, readiness_status, sensitivity, source_id, updated_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(MAX_DOCUMENTS),
    client.database
      .from("document_intelligence_reports")
      .select("project_id, document_type, verdict, confidence, updated_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(MAX_REPORTS),
    client.database
      .from("operational_findings")
      .select("project_id, severity, status")
      .eq("organization_id", organizationId)
      .limit(MAX_FINDINGS),
  ]);

  if (projects.error) throw projects.error;
  if (subcontracts.error) throw subcontracts.error;
  if (supplies.error) throw supplies.error;
  if (hse.error) throw hse.error;
  if (schedule.error) throw schedule.error;
  if (financials.error) throw financials.error;
  if (documents.error) throw documents.error;
  if (reports.error) throw reports.error;
  if (findings.error) throw findings.error;

  const documentRows = (documents.data ?? []) as Array<{
    project_id: string | null;
    document_type: string | null;
    readiness_status: string;
    sensitivity: string | null;
    source_id: string | null;
    updated_at: string | null;
  }>;
  const sourceIds = Array.from(
    new Set(documentRows.map((row) => row.source_id).filter((value): value is string => Boolean(value))),
  );
  const sourceTypeById = await loadSourceTypes(client, organizationId, sourceIds);

  const projectRows = (projects.data ?? []) as Array<{
    id: string;
    name: string;
    status: string | null;
    location: string | null;
    updated_at: string | null;
  }>;
  const subRows = (subcontracts.data ?? []) as Array<{
    project_id: string;
    vendor_name: string | null;
    trade: string | null;
    contract_amount: number | string | null;
    currency: string | null;
    status: string | null;
    updated_at: string | null;
  }>;
  const supplyRows = (supplies.data ?? []) as Array<{
    project_id: string;
    item_name: string | null;
    category: string | null;
    supplier_name: string | null;
    currency: string | null;
    status: string | null;
    updated_at: string | null;
  }>;
  const hseRows = (hse.data ?? []) as Array<{
    project_id: string;
    status: string;
    record_type: string;
    updated_at: string | null;
  }>;
  const scheduleRows = (schedule.data ?? []) as Array<{
    project_id: string;
    status: string;
    updated_at: string | null;
  }>;
  const financialRows = (financials.data ?? []) as Array<{
    project_id: string;
    currency: string | null;
    updated_at: string | null;
  }>;
  const reportRows = (reports.data ?? []) as Array<{
    project_id: string | null;
    document_type: string | null;
    verdict: string;
    confidence: number | string | null;
    updated_at: string | null;
  }>;
  const findingRows = (findings.data ?? []) as Array<{
    project_id: string | null;
    severity: string;
    status: string;
  }>;

  return {
    projects: projectRows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      location: row.location,
      updatedAt: row.updated_at,
    })),
    subcontracts: subRows.map((row) => ({
      projectId: row.project_id,
      vendorName: row.vendor_name,
      trade: row.trade,
      contractAmount: row.contract_amount == null ? null : Number(row.contract_amount),
      currency: row.currency,
      status: row.status,
      updatedAt: row.updated_at,
    })),
    supplies: supplyRows.map((row) => ({
      projectId: row.project_id,
      itemName: row.item_name,
      category: row.category,
      supplierName: row.supplier_name,
      currency: row.currency,
      status: row.status,
      updatedAt: row.updated_at,
    })),
    hse: hseRows.map((row) => ({
      projectId: row.project_id,
      status: row.status,
      recordType: row.record_type,
      updatedAt: row.updated_at,
    })),
    schedule: scheduleRows.map((row) => ({
      projectId: row.project_id,
      status: row.status,
      updatedAt: row.updated_at,
    })),
    financials: financialRows.map((row) => ({
      projectId: row.project_id,
      currency: row.currency,
      updatedAt: row.updated_at,
    })),
    documents: documentRows.map((row) => ({
      projectId: row.project_id,
      documentType: row.document_type,
      readinessStatus: row.readiness_status,
      sensitivity: row.sensitivity,
      sourceType: row.source_id ? sourceTypeById.get(row.source_id) ?? null : null,
      updatedAt: row.updated_at,
    })),
    reports: reportRows.map((row) => ({
      projectId: row.project_id,
      documentType: row.document_type,
      verdict: row.verdict,
      confidence: row.confidence == null ? null : Number(row.confidence),
      updatedAt: row.updated_at,
    })),
    findings: findingRows.map((row) => ({
      projectId: row.project_id,
      severity: row.severity,
      status: row.status,
    })),
  };
}

async function loadSourceTypes(
  client: ReturnType<typeof getInsForgeAdminClient>,
  organizationId: string,
  sourceIds: string[],
): Promise<Map<string, string>> {
  if (sourceIds.length === 0) return new Map();
  const result = await client.database
    .from("enterprise_sources")
    .select("id, source_type")
    .eq("organization_id", organizationId)
    .in("id", sourceIds)
    .limit(sourceIds.length);
  if (result.error) {
    dbLogger.warn({ err: result.error }, "loadSourceTypes failed");
    return new Map();
  }
  const out = new Map<string, string>();
  for (const row of (result.data ?? []) as Array<{ id: string; source_type: string }>) {
    out.set(row.id, row.source_type);
  }
  return out;
}

async function syncEntities(args: { organizationId: string; entities: EntityCandidate[] }): Promise<void> {
  if (args.entities.length === 0) return;
  const client = getInsForgeAdminClient();
  const now = new Date().toISOString();

  for (const entity of args.entities) {
    try {
      const existing = await client.database
        .from("enterprise_entities")
        .select("id")
        .eq("organization_id", args.organizationId)
        .eq("entity_type", entity.entityType)
        .eq("canonical_name", entity.canonicalName)
        .is("deleted_at", null)
        .maybeSingle();

      let entityId: string | null = existing.data?.id ?? null;

      if (entityId) {
        const update = await client.database
          .from("enterprise_entities")
          .update({
            display_name: entity.displayName,
            occurrence_count: entity.occurrenceCount,
            confidence: entity.confidence,
            last_seen_at: entity.lastSeenAt ?? now,
            metadata: entity.metadata ?? {},
            updated_at: now,
          })
          .eq("id", entityId);
        if (update.error) {
          dbLogger.warn({ err: update.error, entity }, "enterprise_entities update failed");
          continue;
        }
      } else {
        const insert = await client.database
          .from("enterprise_entities")
          .insert({
            organization_id: args.organizationId,
            entity_type: entity.entityType,
            canonical_name: entity.canonicalName,
            display_name: entity.displayName,
            occurrence_count: entity.occurrenceCount,
            confidence: entity.confidence,
            last_seen_at: entity.lastSeenAt ?? now,
            metadata: entity.metadata ?? {},
          })
          .select("id")
          .maybeSingle();
        if (insert.error || !insert.data?.id) {
          dbLogger.warn({ err: insert.error, entity }, "enterprise_entities insert failed");
          continue;
        }
        entityId = insert.data.id;
      }

      if (entityId) await syncAliases({ organizationId: args.organizationId, entityId, aliases: entity.aliases });
    } catch (err) {
      dbLogger.warn({ err, entity }, "syncEntities exception");
    }
  }
}

async function syncAliases(args: { organizationId: string; entityId: string; aliases: string[] }): Promise<void> {
  if (args.aliases.length === 0) return;
  const client = getInsForgeAdminClient();
  const now = new Date().toISOString();
  for (const alias of args.aliases) {
    try {
      const existing = await client.database
        .from("enterprise_entity_aliases")
        .select("id, occurrence_count")
        .eq("entity_id", args.entityId)
        .eq("alias", alias)
        .maybeSingle();

      if (existing.data?.id) {
        const update = await client.database
          .from("enterprise_entity_aliases")
          .update({
            occurrence_count: (existing.data.occurrence_count ?? 0) + 1,
            last_seen_at: now,
            updated_at: now,
          })
          .eq("id", existing.data.id);
        if (update.error) dbLogger.warn({ err: update.error }, "enterprise_entity_aliases update failed");
      } else {
        const insert = await client.database
          .from("enterprise_entity_aliases")
          .insert({
            organization_id: args.organizationId,
            entity_id: args.entityId,
            alias,
            occurrence_count: 1,
            last_seen_at: now,
          });
        if (insert.error) dbLogger.warn({ err: insert.error }, "enterprise_entity_aliases insert failed");
      }
    } catch (err) {
      dbLogger.warn({ err }, "syncAliases exception");
    }
  }
}

async function syncPatterns(args: { organizationId: string; patterns: PatternCandidate[] }): Promise<void> {
  if (args.patterns.length === 0) return;
  const client = getInsForgeAdminClient();
  const now = new Date().toISOString();

  for (const pattern of args.patterns) {
    try {
      const existing = await client.database
        .from("enterprise_patterns")
        .select("id")
        .eq("organization_id", args.organizationId)
        .eq("pattern_kind", pattern.patternKind)
        .eq("pattern_key", pattern.patternKey)
        .is("deleted_at", null)
        .maybeSingle();

      if (existing.data?.id) {
        const update = await client.database
          .from("enterprise_patterns")
          .update({
            pattern_value: pattern.patternValue,
            confidence: pattern.confidence,
            evidence_count: pattern.evidenceCount,
            last_observed_at: pattern.lastObservedAt ?? now,
            updated_at: now,
          })
          .eq("id", existing.data.id);
        if (update.error) dbLogger.warn({ err: update.error, pattern }, "enterprise_patterns update failed");
      } else {
        const insert = await client.database
          .from("enterprise_patterns")
          .insert({
            organization_id: args.organizationId,
            pattern_kind: pattern.patternKind,
            pattern_key: pattern.patternKey,
            pattern_value: pattern.patternValue,
            confidence: pattern.confidence,
            evidence_count: pattern.evidenceCount,
            last_observed_at: pattern.lastObservedAt ?? now,
          });
        if (insert.error) dbLogger.warn({ err: insert.error, pattern }, "enterprise_patterns insert failed");
      }
    } catch (err) {
      dbLogger.warn({ err, pattern }, "syncPatterns exception");
    }
  }
}

async function syncCoverage(args: { organizationId: string; coverage: ProjectCoverage[] }): Promise<void> {
  if (args.coverage.length === 0) return;
  const client = getInsForgeAdminClient();
  const now = new Date().toISOString();

  for (const coverage of args.coverage) {
    try {
      const existing = await client.database
        .from("enterprise_project_coverage")
        .select("id")
        .eq("organization_id", args.organizationId)
        .eq("project_id", coverage.projectId)
        .maybeSingle();

      const row = {
        documents_total: coverage.documentsTotal,
        documents_indexed: coverage.documentsIndexed,
        documents_observed: coverage.documentsObserved,
        subcontracts_count: coverage.subcontractsCount,
        supplies_count: coverage.suppliesCount,
        hse_records_count: coverage.hseRecordsCount,
        schedule_tasks_count: coverage.scheduleTasksCount,
        findings_open: coverage.findingsOpen,
        reports_count: coverage.reportsCount,
        coverage_score: coverage.coverageScore,
        risk_level: coverage.riskLevel,
        last_activity_at: coverage.lastActivityAt,
        metadata: coverage.metadata ?? {},
        computed_at: now,
        updated_at: now,
      };

      if (existing.data?.id) {
        const update = await client.database
          .from("enterprise_project_coverage")
          .update(row)
          .eq("id", existing.data.id);
        if (update.error) dbLogger.warn({ err: update.error, coverage }, "enterprise_project_coverage update failed");
      } else {
        const insert = await client.database
          .from("enterprise_project_coverage")
          .insert({
            organization_id: args.organizationId,
            project_id: coverage.projectId,
            ...row,
          });
        if (insert.error) dbLogger.warn({ err: insert.error, coverage }, "enterprise_project_coverage insert failed");
      }
    } catch (err) {
      dbLogger.warn({ err, coverage }, "syncCoverage exception");
    }
  }
}

async function writeSnapshot(args: {
  organizationId: string;
  aggregation: ProfileAggregation;
  triggerSource: ProfileTriggerSource;
  builtByUserId: string | null;
}): Promise<{ id: string; version: number }> {
  const client = getInsForgeAdminClient();
  const latest = await client.database
    .from("enterprise_profile_snapshots")
    .select("version")
    .eq("organization_id", args.organizationId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest.data?.version ?? 0) + 1;

  const insert = await client.database
    .from("enterprise_profile_snapshots")
    .insert({
      organization_id: args.organizationId,
      version: nextVersion,
      entity_count: args.aggregation.entities.length,
      pattern_count: args.aggregation.patterns.length,
      coverage_count: args.aggregation.coverage.length,
      summary: args.aggregation.summary.text,
      payload: {
        summary: args.aggregation.summary,
        entities: args.aggregation.entities.slice(0, 100),
        patterns: args.aggregation.patterns.slice(0, 100),
        coverage: args.aggregation.coverage.slice(0, 100),
      },
      built_by_user_id: args.builtByUserId,
      trigger_source: args.triggerSource,
      built_at: new Date().toISOString(),
    })
    .select("id, version")
    .maybeSingle();

  if (insert.error || !insert.data?.id) {
    throw insert.error ?? new Error("snapshot insert failed");
  }
  return { id: insert.data.id, version: insert.data.version };
}
