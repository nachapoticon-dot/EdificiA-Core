import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import type { ContextScanResult } from "@/lib/document-intelligence/context-scan";

export type ObraRelationType = "contradicts" | "derives_from" | "supersedes" | "references" | "duplicates";
export type ObraRelationDetector = "system" | "agent" | "user";

export interface UpsertRelationInput {
  organizationId: string;
  projectId: string | null;
  sourceFileId: string;
  targetFileId: string;
  relationType: ObraRelationType;
  detectedBy?: ObraRelationDetector;
  confidence?: number;
  evidence?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}

interface RelationRow {
  id: string;
  source_file_id: string;
  target_file_id: string;
  relation_type: ObraRelationType;
  confidence: number | string;
  detected_by: ObraRelationDetector;
  evidence: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Inserts or updates a relation. For `system`-detected relations the partial
 * unique index (org, source, target, type) where detected_by='system' means
 * we can safely upsert. For agent/user, we always insert (caller dedupes).
 */
export async function upsertObraRelation(input: UpsertRelationInput): Promise<void> {
  if (input.sourceFileId === input.targetFileId) return;
  const client = getInsForgeAdminClient();
  const detectedBy: ObraRelationDetector = input.detectedBy ?? "system";

  try {
    if (detectedBy === "system") {
      // Look up an existing system relation for this pair+type.
      const existing = await client.database
        .from("obra_relations")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("source_file_id", input.sourceFileId)
        .eq("target_file_id", input.targetFileId)
        .eq("relation_type", input.relationType)
        .eq("detected_by", "system")
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (existing.data?.id) {
        const update = await client.database
          .from("obra_relations")
          .update({
            confidence: input.confidence ?? 0.5,
            evidence: input.evidence ?? {},
            metadata: input.metadata ?? {},
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.data.id);
        if (update.error) dbLogger.warn({ err: update.error }, "obra_relations update failed");
        return;
      }
    }

    const insert = await client.database
      .from("obra_relations")
      .insert({
        organization_id: input.organizationId,
        project_id: input.projectId,
        source_file_id: input.sourceFileId,
        target_file_id: input.targetFileId,
        relation_type: input.relationType,
        confidence: input.confidence ?? 0.5,
        detected_by: detectedBy,
        evidence: input.evidence ?? {},
        metadata: input.metadata ?? {},
        created_by: input.createdBy ?? null,
      });

    if (insert.error) dbLogger.warn({ err: insert.error }, "obra_relations insert failed");
  } catch (err) {
    dbLogger.warn({ err }, "obra_relations upsert exception");
  }
}

/**
 * Persist context-scan findings as `contradicts` relations. Called from
 * /api/upload right after `scanDocumentContext` returns. Only writes when
 * we have a stable relatedFileId (no point linking to a name).
 */
export async function writeRelationsFromContextScan(args: {
  organizationId: string;
  projectId: string | null;
  fileId: string;
  scan: ContextScanResult;
}): Promise<void> {
  if (!args.scan.hasFindings) return;
  for (const finding of args.scan.findings) {
    if (!finding.relatedFileId) continue;
    await upsertObraRelation({
      organizationId: args.organizationId,
      projectId: args.projectId,
      sourceFileId: args.fileId,
      targetFileId: finding.relatedFileId,
      relationType: "contradicts",
      detectedBy: "system",
      confidence: finding.severity === "error" ? 0.85 : 0.6,
      evidence: {
        findingType: finding.type,
        severity: finding.severity,
        message: finding.message,
        currentValue: finding.evidence.currentValue,
        relatedValue: finding.evidence.relatedValue,
        deltaPct: finding.evidence.deltaPct,
      },
    });
  }
}

export interface QueryRelationsInput {
  organizationId: string;
  projectId?: string | null;
  fileId?: string | null;
  fileName?: string | null;
  relationType?: ObraRelationType | null;
  limit?: number;
}

export interface RelationWithFileNames {
  id: string;
  relationType: ObraRelationType;
  detectedBy: ObraRelationDetector;
  confidence: number;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  source: { fileId: string; fileName: string | null };
  target: { fileId: string; fileName: string | null };
}

/**
 * Query relations touching a specific file (as source OR target). If
 * `fileName` is provided instead of `fileId`, we resolve the latest matching
 * upload by ilike. Returns relations enriched with file names.
 */
export async function queryObraRelations(input: QueryRelationsInput): Promise<{
  resolvedFileId: string | null;
  resolvedFileName: string | null;
  relations: RelationWithFileNames[];
}> {
  const client = getInsForgeAdminClient();
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

  let resolvedFileId = input.fileId ?? null;
  let resolvedFileName: string | null = null;

  if (!resolvedFileId && input.fileName) {
    const match = await client.database
      .from("uploaded_files")
      .select("id, file_name")
      .eq("organization_id", input.organizationId)
      .ilike("file_name", `%${input.fileName}%`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (match.data) {
      resolvedFileId = (match.data as { id: string }).id;
      resolvedFileName = (match.data as { file_name: string }).file_name;
    }
  } else if (resolvedFileId) {
    const lookup = await client.database
      .from("uploaded_files")
      .select("file_name")
      .eq("id", resolvedFileId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    resolvedFileName = (lookup.data as { file_name?: string } | null)?.file_name ?? null;
  }

  if (!resolvedFileId) {
    return { resolvedFileId: null, resolvedFileName, relations: [] };
  }

  let query = client.database
    .from("obra_relations")
    .select("id, source_file_id, target_file_id, relation_type, confidence, detected_by, evidence, metadata, created_at, updated_at")
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .or(`source_file_id.eq.${resolvedFileId},target_file_id.eq.${resolvedFileId}`)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (input.projectId) query = query.eq("project_id", input.projectId);
  if (input.relationType) query = query.eq("relation_type", input.relationType);

  const result = await query;
  if (result.error) {
    dbLogger.warn({ err: result.error }, "obra_relations query failed");
    return { resolvedFileId, resolvedFileName, relations: [] };
  }

  const rows = (result.data ?? []) as RelationRow[];
  const fileIds = new Set<string>();
  for (const row of rows) {
    fileIds.add(row.source_file_id);
    fileIds.add(row.target_file_id);
  }
  fileIds.delete(resolvedFileId);

  const nameMap = new Map<string, string>();
  if (resolvedFileName) nameMap.set(resolvedFileId, resolvedFileName);

  if (fileIds.size > 0) {
    const idsArray = Array.from(fileIds);
    const filesResult = await client.database
      .from("uploaded_files")
      .select("id, file_name")
      .in("id", idsArray)
      .eq("organization_id", input.organizationId);
    for (const row of (filesResult.data ?? []) as { id: string; file_name: string }[]) {
      nameMap.set(row.id, row.file_name);
    }
  }

  const relations: RelationWithFileNames[] = rows.map((row) => ({
    id: row.id,
    relationType: row.relation_type,
    detectedBy: row.detected_by,
    confidence: typeof row.confidence === "number" ? row.confidence : Number(row.confidence) || 0,
    evidence: row.evidence ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: { fileId: row.source_file_id, fileName: nameMap.get(row.source_file_id) ?? null },
    target: { fileId: row.target_file_id, fileName: nameMap.get(row.target_file_id) ?? null },
  }));

  return { resolvedFileId, resolvedFileName, relations };
}
