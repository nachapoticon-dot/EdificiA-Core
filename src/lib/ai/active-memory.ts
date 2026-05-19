import { writeAuditLogEvent } from "@/lib/audit/audit-log";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";

const ACTIVE_MEMORY_DOCUMENT_TYPE = "agent_memory";
const MAX_KEY_LENGTH = 80;
const MAX_SUMMARY_LENGTH = 700;
const MAX_EVIDENCE_ITEMS = 8;
const MAX_EVIDENCE_LENGTH = 360;
const MAX_TAGS = 8;

interface ActiveMemoryStoredValue {
  key: string;
  summary: string;
  evidence: string[];
  tags: string[];
  source: {
    actorUserId: string | null;
    projectId: string | null;
    workCaseId: string | null;
  };
  updatedBy: "agent_confirmed";
  updatedAt: string;
}

interface ExistingActiveMemory {
  id: string;
  pattern_value: unknown;
  sample_count: number;
  confidence: number;
}

export interface RecordAgentLearningInput {
  organizationId: string;
  actorUserId?: string | null;
  projectId?: string | null;
  workCaseId?: string | null;
  key: string;
  summary: string;
  evidence: string[];
  confidence?: number;
  tags?: string[];
}

export interface RecordAgentLearningResult {
  ok: boolean;
  mode?: "created" | "updated";
  key?: string;
  patternId?: string;
  sampleCount?: number;
  message: string;
  reason?: string;
}

export function normalizeActiveMemoryKey(rawKey: string): string {
  return rawKey
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[_:.-]+|[_:.-]+$/g, "")
    .slice(0, MAX_KEY_LENGTH);
}

export function normalizeActiveMemoryEvidence(evidence: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of evidence) {
    const value = item.trim().replace(/\s+/g, " ").slice(0, MAX_EVIDENCE_LENGTH);
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    normalized.push(value);
    if (normalized.length >= MAX_EVIDENCE_ITEMS) break;
  }

  return normalized;
}

export function mergeActiveMemoryValue(input: {
  key: string;
  summary: string;
  evidence: string[];
  tags?: string[];
  existingValue?: unknown;
  actorUserId?: string | null;
  projectId?: string | null;
  workCaseId?: string | null;
  nowIso: string;
}): ActiveMemoryStoredValue {
  const existing = isStoredValue(input.existingValue) ? input.existingValue : null;
  const evidence = normalizeActiveMemoryEvidence([
    ...input.evidence,
    ...(existing?.evidence ?? []),
  ]);
  const tags = normalizeTags([...(input.tags ?? []), ...(existing?.tags ?? [])]);

  return {
    key: input.key,
    summary: input.summary.trim().replace(/\s+/g, " ").slice(0, MAX_SUMMARY_LENGTH),
    evidence,
    tags,
    source: {
      actorUserId: input.actorUserId ?? existing?.source.actorUserId ?? null,
      projectId: input.projectId ?? existing?.source.projectId ?? null,
      workCaseId: input.workCaseId ?? existing?.source.workCaseId ?? null,
    },
    updatedBy: "agent_confirmed",
    updatedAt: input.nowIso,
  };
}

export async function recordAgentLearning(
  input: RecordAgentLearningInput,
): Promise<RecordAgentLearningResult> {
  const key = normalizeActiveMemoryKey(input.key);
  if (key.length < 3) {
    return { ok: false, reason: "invalid_key", message: "La clave de memoria es demasiado corta o inválida." };
  }

  const evidence = normalizeActiveMemoryEvidence(input.evidence);
  if (evidence.length === 0) {
    return { ok: false, reason: "missing_evidence", message: "Falta evidencia concreta para guardar el aprendizaje." };
  }

  const summary = input.summary.trim().replace(/\s+/g, " ").slice(0, MAX_SUMMARY_LENGTH);
  if (summary.length < 12) {
    return { ok: false, reason: "missing_summary", message: "Falta un resumen suficientemente claro del aprendizaje." };
  }

  const confidence = clampConfidence(input.confidence ?? 0.85);
  const client = getInsForgeAdminClient();

  const lookup = await client.database
    .from("company_learned_patterns")
    .select("id, pattern_value, sample_count, confidence")
    .eq("organization_id", input.organizationId)
    .eq("document_type", ACTIVE_MEMORY_DOCUMENT_TYPE)
    .eq("pattern_key", key)
    .limit(1)
    .maybeSingle();

  if (lookup.error) {
    dbLogger.warn({ err: lookup.error, key }, "active memory lookup failed");
    return { ok: false, reason: "db_error", message: "No se pudo leer la memoria activa." };
  }

  const nowIso = new Date().toISOString();
  const existing = lookup.data as ExistingActiveMemory | null;
  const patternValue = mergeActiveMemoryValue({
    key,
    summary,
    evidence,
    tags: input.tags,
    existingValue: existing?.pattern_value,
    actorUserId: input.actorUserId ?? null,
    projectId: input.projectId ?? null,
    workCaseId: input.workCaseId ?? null,
    nowIso,
  });

  if (existing) {
    const nextSampleCount = (existing.sample_count ?? 0) + 1;
    const update = await client.database
      .from("company_learned_patterns")
      .update({
        pattern_value: patternValue,
        confidence: Math.max(existing.confidence ?? 0, confidence),
        sample_count: nextSampleCount,
        updated_at: nowIso,
      })
      .eq("id", existing.id);

    if (update.error) {
      dbLogger.warn({ err: update.error, key }, "active memory update failed");
      return { ok: false, reason: "db_error", message: update.error.message ?? "No se pudo actualizar la memoria activa." };
    }

    await logActiveMemoryWrite(input, existing.id, key, "updated", patternValue);
    return {
      ok: true,
      mode: "updated",
      key,
      patternId: existing.id,
      sampleCount: nextSampleCount,
      message: `Aprendizaje actualizado en memoria activa: ${key}.`,
    };
  }

  const insert = await client.database
    .from("company_learned_patterns")
    .insert({
      organization_id: input.organizationId,
      document_type: ACTIVE_MEMORY_DOCUMENT_TYPE,
      pattern_key: key,
      pattern_value: patternValue,
      confidence,
      sample_count: 1,
      updated_at: nowIso,
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    dbLogger.warn({ err: insert.error, key }, "active memory insert failed");
    return { ok: false, reason: "db_error", message: insert.error?.message ?? "No se pudo guardar la memoria activa." };
  }

  const patternId = (insert.data as { id: string }).id;
  await logActiveMemoryWrite(input, patternId, key, "created", patternValue);
  return {
    ok: true,
    mode: "created",
    key,
    patternId,
    sampleCount: 1,
    message: `Aprendizaje guardado en memoria activa: ${key}.`,
  };
}

function isStoredValue(value: unknown): value is ActiveMemoryStoredValue {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ActiveMemoryStoredValue>;
  return typeof candidate.summary === "string" && Array.isArray(candidate.evidence);
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeActiveMemoryKey(tag);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.85;
  return Math.min(1, Math.max(0.1, value));
}

async function logActiveMemoryWrite(
  input: RecordAgentLearningInput,
  patternId: string,
  key: string,
  mode: "created" | "updated",
  patternValue: ActiveMemoryStoredValue,
): Promise<void> {
  await writeAuditLogEvent({
    organizationId: input.organizationId,
    projectId: input.projectId ?? null,
    actorUserId: input.actorUserId ?? null,
    eventType: "agent.memory_recorded",
    entityType: "company_learned_pattern",
    entityId: patternId,
    severity: "info",
    payload: {
      mode,
      key,
      workCaseId: input.workCaseId ?? null,
      evidenceCount: patternValue.evidence.length,
      tags: patternValue.tags,
    },
  });
}
