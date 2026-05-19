import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import type { ContextScanResult } from "@/lib/document-intelligence/context-scan";
import type { ProcessedFile } from "@/lib/file-processor/types";

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

export interface SemanticTargetDocument {
  fileId: string;
  fileName: string;
  chunks: string[];
}

export interface SemanticRelationCandidate {
  sourceFileId: string;
  targetFileId: string;
  relationType: Extract<ObraRelationType, "derives_from" | "supersedes">;
  confidence: number;
  evidence: Record<string, unknown>;
  metadata?: Record<string, unknown>;
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

/**
 * Adds conservative semantic edges when a new upload clearly references prior
 * documents. This is best-effort and intentionally deterministic: no LLM call,
 * no broad fuzzy matching.
 */
export async function writeSemanticRelationsForUpload(args: {
  organizationId: string;
  projectId: string | null;
  fileId: string | null;
  processed: ProcessedFile;
}): Promise<void> {
  if (!args.fileId) return;

  const client = getInsForgeAdminClient();
  try {
    const [filesResult, chunksResult] = await Promise.all([
      (() => {
        let query = client.database
          .from("uploaded_files")
          .select("id, file_name")
          .eq("organization_id", args.organizationId)
          .is("deleted_at", null)
          .neq("id", args.fileId)
          .limit(120);
        if (args.projectId) query = query.eq("project_id", args.projectId);
        return query;
      })(),
      (() => {
        let query = client.database
          .from("document_chunks")
          .select("file_id, file_name, chunk_text")
          .eq("organization_id", args.organizationId)
          .neq("file_id", args.fileId)
          .limit(240);
        if (args.projectId) query = query.eq("project_id", args.projectId);
        return query;
      })(),
    ]);

    if (filesResult.error) dbLogger.warn({ err: filesResult.error }, "semantic relations files query failed");
    if (chunksResult.error) dbLogger.warn({ err: chunksResult.error }, "semantic relations chunks query failed");

    const targets = buildSemanticTargets(
      (filesResult.data ?? []) as { id: string; file_name: string }[],
      (chunksResult.data ?? []) as { file_id: string | null; file_name: string; chunk_text: string }[],
    );

    const candidates = detectSemanticRelationCandidates({
      currentFileId: args.fileId,
      currentFileName: args.processed.fileName,
      currentText: buildSemanticText(args.processed),
      targets,
    }).slice(0, 8);

    for (const candidate of candidates) {
      await upsertObraRelation({
        organizationId: args.organizationId,
        projectId: args.projectId,
        sourceFileId: candidate.sourceFileId,
        targetFileId: candidate.targetFileId,
        relationType: candidate.relationType,
        detectedBy: "system",
        confidence: candidate.confidence,
        evidence: candidate.evidence,
        metadata: candidate.metadata,
      });
    }
  } catch (err) {
    dbLogger.warn({ err, fileId: args.fileId }, "semantic relations write failed");
  }
}

export function detectSemanticRelationCandidates(input: {
  currentFileId: string;
  currentFileName: string;
  currentText: string;
  targets: SemanticTargetDocument[];
}): SemanticRelationCandidate[] {
  const candidates: SemanticRelationCandidate[] = [];
  const currentVersion = parseVersionedFileName(input.currentFileName);
  const normalizedCurrentText = normalizeSemanticText(input.currentText);
  const seen = new Set<string>();

  if (currentVersion) {
    for (const target of input.targets) {
      const targetVersion = parseVersionedFileName(target.fileName);
      if (!targetVersion || targetVersion.baseKey !== currentVersion.baseKey) continue;
      if (targetVersion.version === currentVersion.version) continue;

      const sourceFileId = currentVersion.version > targetVersion.version ? input.currentFileId : target.fileId;
      const targetFileId = currentVersion.version > targetVersion.version ? target.fileId : input.currentFileId;
      const key = `${sourceFileId}:${targetFileId}:supersedes`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        sourceFileId,
        targetFileId,
        relationType: "supersedes",
        confidence: Math.abs(currentVersion.version - targetVersion.version) === 1 ? 0.9 : 0.78,
        evidence: {
          detector: "filename_version",
          baseName: currentVersion.baseKey,
          sourceVersion: Math.max(currentVersion.version, targetVersion.version),
          targetVersion: Math.min(currentVersion.version, targetVersion.version),
          currentFileName: input.currentFileName,
          relatedFileName: target.fileName,
        },
        metadata: { autoDetected: true },
      });
    }
  }

  for (const target of input.targets) {
    const relationKey = `${input.currentFileId}:${target.fileId}:derives_from`;
    if (seen.has(relationKey)) continue;

    const nameHit = targetNameMentioned(target.fileName, normalizedCurrentText);
    const codeHits = extractDistinctTaskCodes(target.chunks.join("\n"))
      .filter((code) => taskCodeMentioned(code, normalizedCurrentText))
      .slice(0, 6);

    if (!nameHit && codeHits.length === 0) continue;
    seen.add(relationKey);

    candidates.push({
      sourceFileId: input.currentFileId,
      targetFileId: target.fileId,
      relationType: "derives_from",
      confidence: nameHit ? 0.74 : codeHits.length >= 2 ? 0.7 : 0.62,
      evidence: {
        detector: nameHit ? "document_name_reference" : "task_code_reference",
        relatedFileName: target.fileName,
        matchedTaskCodes: codeHits,
        matchedDocumentName: nameHit,
      },
      metadata: { autoDetected: true },
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

function buildSemanticTargets(
  files: { id: string; file_name: string }[],
  chunks: { file_id: string | null; file_name: string; chunk_text: string }[],
): SemanticTargetDocument[] {
  const byId = new Map<string, SemanticTargetDocument>();
  for (const file of files) {
    byId.set(file.id, { fileId: file.id, fileName: file.file_name, chunks: [] });
  }

  for (const chunk of chunks) {
    if (!chunk.file_id) continue;
    const existing = byId.get(chunk.file_id) ?? {
      fileId: chunk.file_id,
      fileName: chunk.file_name,
      chunks: [],
    };
    existing.chunks.push(chunk.chunk_text);
    byId.set(chunk.file_id, existing);
  }

  return Array.from(byId.values());
}

function buildSemanticText(file: ProcessedFile): string {
  switch (file.type) {
    case "excel":
      return file.items.map((item) => `${item.code} ${item.description}`).join("\n");
    case "pdf":
    case "docx":
      return file.text;
    case "dxf":
      return [...file.textAnnotations, ...file.layers, ...file.blockNames].join("\n");
    case "image":
      return file.fileName;
    case "dwg_unsupported":
      return "";
  }
}

function parseVersionedFileName(fileName: string): { baseKey: string; version: number } | null {
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");
  const patterns = [
    /(?:^|[\s._-])v(?:er(?:si[oó]n)?)?\.?\s*(\d{1,3})(?=$|[\s._-])/i,
    /(?:^|[\s._-])rev(?:isi[oó]n)?\.?\s*(\d{1,3})(?=$|[\s._-])/i,
    /(?:^|[\s._-])r\s*(\d{1,3})(?=$|[\s._-])/i,
  ];

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    const version = match?.[1] ? Number.parseInt(match[1], 10) : 0;
    if (!match || !Number.isFinite(version) || version <= 0) continue;

    const baseKey = normalizeSemanticText(nameWithoutExt.replace(match[0], " "))
      .replace(/\b(final|aprobado|borrador|copia)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return baseKey.length >= 4 ? { baseKey, version } : null;
  }

  return null;
}

function targetNameMentioned(fileName: string, normalizedCurrentText: string): boolean {
  const normalizedName = normalizeSemanticText(fileName.replace(/\.[^.]+$/, ""));
  const withoutVersion = normalizedName
    .replace(/\b(v|ver|version|revision|rev|r)\s*\d{1,3}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutVersion.length >= 10 && normalizedCurrentText.includes(withoutVersion);
}

function extractDistinctTaskCodes(text: string): string[] {
  const codes = new Set<string>();
  const lineCodePattern = /^\s*([A-Za-z]{0,6}[-_.]?\d[\w.-]{1,18})\s*\|/gm;
  for (const match of text.matchAll(lineCodePattern)) {
    const code = normalizeTaskCode(match[1]);
    if (isDistinctTaskCode(code)) codes.add(code);
  }

  const labeledPattern = /\b(?:item|rubro|tarea|task[_\s-]?code|c[oó]digo)\s*[:#-]?\s*([A-Za-z]{0,6}[-_.]?\d[\w.-]{1,18})\b/gi;
  for (const match of text.matchAll(labeledPattern)) {
    const code = normalizeTaskCode(match[1]);
    if (isDistinctTaskCode(code)) codes.add(code);
  }

  return Array.from(codes).slice(0, 30);
}

function taskCodeMentioned(code: string, normalizedCurrentText: string): boolean {
  if (!isDistinctTaskCode(code)) return false;
  const escaped = escapeRegExp(code);
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "i").test(normalizedCurrentText);
}

function isDistinctTaskCode(code: string): boolean {
  if (code.length < 3) return false;
  if (/^row-\d+$/i.test(code)) return false;
  if (/^\d{1,2}$/.test(code)) return false;
  return /[a-z]/i.test(code) || /[.-]/.test(code) || code.length >= 4;
}

function normalizeTaskCode(value: string | undefined): string {
  return normalizeSemanticText(value ?? "").replace(/\s+/g, "");
}

function normalizeSemanticText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

// ─────────────────────────────────────────────────────────────────────────────
// Bulk dump del grafo (consumo externo)
// ─────────────────────────────────────────────────────────────────────────────

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  fileType: string;
  projectId: string | null;
  projectName: string | null;
  indexingStatus: string | null;
  processingStatus: string | null;
  createdAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: ObraRelationType;
  confidence: number;
  detectedBy: ObraRelationDetector;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphDump {
  meta: {
    organizationId: string;
    projectId: string | null;
    generatedAt: string;
    nodeCount: number;
    edgeCount: number;
  };
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

/**
 * Devuelve el grafo completo de archivos + relaciones para la org (y opcionalmente
 * para una obra específica). Pensado para alimentar herramientas externas de
 * visualización (react-flow, Cytoscape, Gephi, etc.) sin atarse a un formato.
 * El shape `{ nodes: [{id, ...}], edges: [{id, source, target, ...}] }` es el
 * más universal — la mayoría de las libs lo consumen directo o con un transform
 * de 5 líneas.
 *
 * Incluye archivos huérfanos (sin relaciones) como nodos sueltos.
 */
export async function fetchKnowledgeGraph(input: {
  organizationId: string;
  projectId?: string | null;
}): Promise<KnowledgeGraphDump> {
  const client = getInsForgeAdminClient();

  // 1. Nodos: todos los uploaded_files de la org (filtrados por proyecto si aplica)
  let filesQuery = client.database
    .from("uploaded_files")
    .select("id, file_name, file_type, project_id, processing_status, indexing_status, created_at")
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (input.projectId) filesQuery = filesQuery.eq("project_id", input.projectId);

  const filesResult = await filesQuery;
  if (filesResult.error) {
    dbLogger.warn({ err: filesResult.error }, "fetchKnowledgeGraph files query failed");
  }

  const fileRows = (filesResult.data ?? []) as Array<{
    id: string;
    file_name: string;
    file_type: string;
    project_id: string | null;
    processing_status: string | null;
    indexing_status: string | null;
    created_at: string;
  }>;

  // 2. Resolver nombres de proyecto en bulk
  const projectIds = Array.from(
    new Set(fileRows.map((f) => f.project_id).filter((id): id is string => Boolean(id))),
  );
  const projectNames = new Map<string, string>();
  if (projectIds.length > 0) {
    const projectsResult = await client.database
      .from("projects")
      .select("id, name")
      .eq("organization_id", input.organizationId)
      .in("id", projectIds);
    for (const row of (projectsResult.data ?? []) as { id: string; name: string }[]) {
      projectNames.set(row.id, row.name);
    }
  }

  const nodes: KnowledgeGraphNode[] = fileRows.map((row) => ({
    id: row.id,
    label: row.file_name,
    fileType: row.file_type,
    projectId: row.project_id,
    projectName: row.project_id ? projectNames.get(row.project_id) ?? null : null,
    indexingStatus: row.indexing_status,
    processingStatus: row.processing_status,
    createdAt: row.created_at,
  }));

  // 3. Aristas: obra_relations de la org (acotadas a archivos visibles del set anterior)
  const visibleFileIds = new Set(nodes.map((n) => n.id));

  let edgesQuery = client.database
    .from("obra_relations")
    .select("id, source_file_id, target_file_id, relation_type, confidence, detected_by, evidence, metadata, created_at, updated_at")
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (input.projectId) edgesQuery = edgesQuery.eq("project_id", input.projectId);

  const edgesResult = await edgesQuery;
  if (edgesResult.error) {
    dbLogger.warn({ err: edgesResult.error }, "fetchKnowledgeGraph edges query failed");
  }

  const edgeRows = (edgesResult.data ?? []) as Array<RelationRow & { project_id?: string | null }>;
  const edges: KnowledgeGraphEdge[] = edgeRows
    .filter((row) => visibleFileIds.has(row.source_file_id) && visibleFileIds.has(row.target_file_id))
    .map((row) => ({
      id: row.id,
      source: row.source_file_id,
      target: row.target_file_id,
      relationType: row.relation_type,
      confidence: typeof row.confidence === "number" ? row.confidence : Number(row.confidence) || 0,
      detectedBy: row.detected_by,
      evidence: row.evidence ?? {},
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

  return {
    meta: {
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      generatedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
    nodes,
    edges,
  };
}
