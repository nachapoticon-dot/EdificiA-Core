// Servicio de lectura/agregación del registro de fuentes empresariales.
// Concentra el acceso a enterprise_sources / enterprise_documents / enterprise_sync_runs
// para que las rutas API queden delgadas. Todo filtrado por organization_id.

import { getInsForgeAdminClient } from "@/lib/insforge/server";
import type {
  EnterpriseSourceSummary,
  EnterpriseSourceDocumentsResponse,
} from "@/lib/validators/api-responses";

const READINESS_ORDER = [
  "descubierta",
  "inventariada",
  "clasificada",
  "normalizada",
  "indexada",
  "operativa",
  "observada",
] as const;

type ReadinessStatus = (typeof READINESS_ORDER)[number];
type ReadinessCount = EnterpriseSourceSummary["readiness"][number];
type SyncRun = NonNullable<EnterpriseSourceSummary["lastSyncRun"]>;

interface SourceRow {
  id: string;
  source_type: EnterpriseSourceSummary["sourceType"];
  name: string;
  status: EnterpriseSourceSummary["status"];
  read_only: boolean;
  scopes: unknown;
  last_synced_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface DocCountRow {
  source_id: string | null;
  readiness_status: ReadinessStatus;
}

interface SyncRunRow {
  id: string;
  source_id: string | null;
  status: SyncRun["status"];
  trigger_type: SyncRun["triggerType"];
  discovered_count: number;
  inventoried_count: number;
  classified_count: number;
  indexed_count: number;
  observed_count: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

interface CatalogDocRow {
  id: string;
  title: string;
  document_type: string;
  readiness_status: ReadinessStatus;
  sensitivity: string;
  confidence: number | string | null;
  source_path: string | null;
  external_id: string | null;
  uploaded_file_id: string | null;
  project_id: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

type DocumentStructure = EnterpriseSourceDocumentsResponse["documents"][number]["documentStructure"];
type DocumentStructureStatus = NonNullable<DocumentStructure>["status"];

function toScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === "string");
  return [];
}

function buildReadiness(counts: Map<ReadinessStatus, number>): ReadinessCount[] {
  return READINESS_ORDER.filter((status) => (counts.get(status) ?? 0) > 0).map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

function mapSyncRun(row: SyncRunRow): SyncRun {
  return {
    id: row.id,
    sourceId: row.source_id,
    status: row.status,
    triggerType: row.trigger_type,
    discoveredCount: row.discovered_count ?? 0,
    inventoriedCount: row.inventoried_count ?? 0,
    classifiedCount: row.classified_count ?? 0,
    indexedCount: row.indexed_count ?? 0,
    observedCount: row.observed_count ?? 0,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function summarizeReadiness(counts: Map<ReadinessStatus, number>): {
  total: number;
  indexed: number;
  observed: number;
  readiness: ReadinessCount[];
} {
  let total = 0;
  for (const value of counts.values()) total += value;
  const indexed = (counts.get("indexada") ?? 0) + (counts.get("operativa") ?? 0);
  const observed = counts.get("observada") ?? 0;
  return { total, indexed, observed, readiness: buildReadiness(counts) };
}

function normalizeDocumentStructure(metadata: unknown): DocumentStructure {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  const candidate = record.documentStructure ?? record.document_structure;
  if (!candidate || typeof candidate !== "object") return null;

  const structure = candidate as Record<string, unknown>;
  const validStatus = ["structured", "flat", "scanned", "unsupported"].includes(String(structure.status));
  if (!validStatus) return null;

  const sectionCount = Number(structure.sectionCount ?? structure.section_count ?? 0);
  const maxDepth = Number(structure.maxDepth ?? structure.max_depth ?? 0);
  const rawTopSections = structure.topSections ?? structure.top_sections;
  const topSections = Array.isArray(rawTopSections)
    ? rawTopSections.filter((item): item is string => typeof item === "string")
    : [];

  if (!Number.isFinite(sectionCount) || !Number.isFinite(maxDepth)) return null;

  return {
    status: structure.status as DocumentStructureStatus,
    sectionCount: Math.max(0, Math.trunc(sectionCount)),
    maxDepth: Math.max(0, Math.trunc(maxDepth)),
    topSections: topSections.slice(0, 8),
  };
}

/** Lista las fuentes de una organización con conteos de preparación y último sync run. */
export async function listEnterpriseSources(orgId: string): Promise<EnterpriseSourceSummary[]> {
  const client = getInsForgeAdminClient();

  const [sourcesResult, docsResult, runsResult] = await Promise.all([
    client.database
      .from("enterprise_sources")
      .select("id, source_type, name, status, read_only, scopes, last_synced_at, error_message, created_at, updated_at")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200),
    client.database
      .from("enterprise_documents")
      .select("source_id, readiness_status")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .limit(5000),
    client.database
      .from("enterprise_sync_runs")
      .select(
        "id, source_id, status, trigger_type, discovered_count, inventoried_count, classified_count, indexed_count, observed_count, error_message, started_at, finished_at",
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (sourcesResult.error) throw sourcesResult.error;
  if (docsResult.error) throw docsResult.error;
  if (runsResult.error) throw runsResult.error;

  const sources = (sourcesResult.data ?? []) as SourceRow[];
  const docs = (docsResult.data ?? []) as DocCountRow[];
  const runs = (runsResult.data ?? []) as SyncRunRow[];

  const countsBySource = new Map<string, Map<ReadinessStatus, number>>();
  for (const doc of docs) {
    if (!doc.source_id) continue;
    const map = countsBySource.get(doc.source_id) ?? new Map<ReadinessStatus, number>();
    map.set(doc.readiness_status, (map.get(doc.readiness_status) ?? 0) + 1);
    countsBySource.set(doc.source_id, map);
  }

  const latestRunBySource = new Map<string, SyncRunRow>();
  for (const run of runs) {
    if (!run.source_id || latestRunBySource.has(run.source_id)) continue;
    latestRunBySource.set(run.source_id, run);
  }

  return sources.map((source) => {
    const counts = countsBySource.get(source.id) ?? new Map<ReadinessStatus, number>();
    const { total, indexed, observed, readiness } = summarizeReadiness(counts);
    const latestRun = latestRunBySource.get(source.id);
    return {
      id: source.id,
      sourceType: source.source_type,
      name: source.name,
      status: source.status,
      readOnly: source.read_only,
      scopes: toScopes(source.scopes),
      lastSyncedAt: source.last_synced_at,
      errorMessage: source.error_message,
      documentsTotal: total,
      documentsIndexed: indexed,
      documentsObserved: observed,
      readiness,
      lastSyncRun: latestRun ? mapSyncRun(latestRun) : null,
      createdAt: source.created_at,
      updatedAt: source.updated_at,
    };
  });
}

/** Devuelve el catálogo de documentos + sync runs de una fuente, o null si no pertenece a la org. */
export async function getEnterpriseSourceCatalog(
  orgId: string,
  sourceId: string,
): Promise<EnterpriseSourceDocumentsResponse | null> {
  const client = getInsForgeAdminClient();

  const sourceResult = await client.database
    .from("enterprise_sources")
    .select("id, source_type, name")
    .eq("id", sourceId)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (sourceResult.error) throw sourceResult.error;
  const source = sourceResult.data as { id: string; source_type: EnterpriseSourceSummary["sourceType"]; name: string } | null;
  if (!source) return null;

  const [docsResult, runsResult, projectsResult] = await Promise.all([
    client.database
      .from("enterprise_documents")
      .select(
        "id, title, document_type, readiness_status, sensitivity, confidence, source_path, external_id, uploaded_file_id, project_id, metadata, created_at, updated_at",
      )
      .eq("organization_id", orgId)
      .eq("source_id", sourceId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(500),
    client.database
      .from("enterprise_sync_runs")
      .select(
        "id, source_id, status, trigger_type, discovered_count, inventoried_count, classified_count, indexed_count, observed_count, error_message, started_at, finished_at",
      )
      .eq("organization_id", orgId)
      .eq("source_id", sourceId)
      .order("created_at", { ascending: false })
      .limit(25),
    client.database
      .from("projects")
      .select("id, name")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .limit(300),
  ]);

  if (docsResult.error) throw docsResult.error;
  if (runsResult.error) throw runsResult.error;
  if (projectsResult.error) throw projectsResult.error;

  const docs = (docsResult.data ?? []) as CatalogDocRow[];
  const runs = (runsResult.data ?? []) as SyncRunRow[];
  const projects = (projectsResult.data ?? []) as { id: string; name: string }[];
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const counts = new Map<ReadinessStatus, number>();
  for (const doc of docs) {
    counts.set(doc.readiness_status, (counts.get(doc.readiness_status) ?? 0) + 1);
  }

  return {
    meta: {
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.source_type,
      generatedAt: new Date().toISOString(),
      totalDocuments: docs.length,
    },
    readiness: buildReadiness(counts),
    documents: docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      documentType: doc.document_type,
      readinessStatus: doc.readiness_status,
      sensitivity: doc.sensitivity,
      confidence: doc.confidence == null ? null : Number(doc.confidence),
      sourcePath: doc.source_path,
      externalId: doc.external_id,
      uploadedFileId: doc.uploaded_file_id,
      projectId: doc.project_id,
      projectName: doc.project_id ? projectName.get(doc.project_id) ?? null : null,
      documentStructure: normalizeDocumentStructure(doc.metadata),
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    })),
    syncRuns: runs.map(mapSyncRun),
  };
}

/** Lee una sola fuente como summary (post-mutación). */
export async function getEnterpriseSourceSummary(
  orgId: string,
  sourceId: string,
): Promise<EnterpriseSourceSummary | null> {
  const sources = await listEnterpriseSources(orgId);
  return sources.find((s) => s.id === sourceId) ?? null;
}
