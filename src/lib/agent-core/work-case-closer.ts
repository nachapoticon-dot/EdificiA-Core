import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import type { WorkCaseStatus, WorkCaseVerdict } from "./types";

type EvidenceType =
  | "audit_event"
  | "tool_run"
  | "finding"
  | "document_report"
  | "file"
  | "message"
  | "schedule_task"
  | "hse_record"
  | "supply_item"
  | "financial_snapshot"
  | "subcontract"
  | "relation"
  | "external";

export interface ProposedClosureEvidenceInput {
  evidenceType: EvidenceType;
  entityType: string;
  entityId?: string | null;
  label?: string | null;
  confidence?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface CloseWorkCaseFromAgentInput {
  organizationId: string;
  actorUserId: string;
  workCaseId: string;
  verdict: WorkCaseVerdict;
  summary: string;
  rationale?: string | null;
  evidence?: ProposedClosureEvidenceInput[];
  capabilityId?: string | null;
  agentRunId?: string | null;
}

export interface CloseWorkCaseFromAgentResult {
  ok: boolean;
  reason?: string;
  message: string;
  workCaseId?: string;
  status?: WorkCaseStatus;
  verdict?: WorkCaseVerdict;
  evidenceInserted?: number;
  eventId?: string;
}

const TERMINAL_STATUSES: WorkCaseStatus[] = ["resolved", "closed", "archived"];
const AGENT_TERMINAL_STATUS: WorkCaseStatus = "resolved";
const MAX_SUMMARY = 2000;
const MAX_RATIONALE = 600;

interface WorkCaseRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  status: WorkCaseStatus;
  summary: string | null;
  verdict: WorkCaseVerdict | null;
}

/**
 * Cierra un expediente operativo desde el agente con veredicto + summary.
 *
 * Restricciones:
 * - Solo mueve a `resolved`. `closed`/`archived` siguen siendo acción humana.
 * - Solo aplica si el expediente está activo (no en estado terminal).
 * - Soft: si el insert de evidencia/evento falla, no rompe la operación principal.
 */
export async function closeWorkCaseFromAgent(
  input: CloseWorkCaseFromAgentInput,
): Promise<CloseWorkCaseFromAgentResult> {
  const client = getInsForgeAdminClient();
  const trimmedSummary = input.summary?.trim() ?? "";
  if (!trimmedSummary) {
    return { ok: false, reason: "missing_summary", message: "Falta el resumen / conclusión del expediente." };
  }
  const summary = trimmedSummary.slice(0, MAX_SUMMARY);
  const rationale = input.rationale?.trim() ? input.rationale.trim().slice(0, MAX_RATIONALE) : null;

  const lookup = await client.database
    .from("work_cases")
    .select("id, organization_id, project_id, status, summary, verdict")
    .eq("id", input.workCaseId)
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (lookup.error) {
    dbLogger.warn(
      { err: lookup.error, workCaseId: input.workCaseId },
      "agent close lookup failed",
    );
    return { ok: false, reason: "db_error", message: "No se pudo leer el expediente." };
  }
  const existing = lookup.data as WorkCaseRow | null;
  if (!existing) {
    return { ok: false, reason: "not_found", message: "Expediente no encontrado en esta organización." };
  }
  if (TERMINAL_STATUSES.includes(existing.status)) {
    return {
      ok: false,
      reason: "already_terminal",
      message: `El expediente ya está en estado terminal (${existing.status}). Reabrilo antes de cerrar de nuevo.`,
    };
  }

  const now = new Date().toISOString();
  const updateResult = await client.database
    .from("work_cases")
    .update({
      status: AGENT_TERMINAL_STATUS,
      verdict: input.verdict,
      summary,
      closed_at: now,
      closed_by_user_id: input.actorUserId,
      updated_at: now,
    })
    .eq("id", existing.id)
    .eq("organization_id", existing.organization_id)
    .is("deleted_at", null);

  if (updateResult.error) {
    dbLogger.warn(
      { err: updateResult.error, workCaseId: existing.id },
      "agent close update failed",
    );
    return { ok: false, reason: "db_error", message: "No se pudo actualizar el expediente." };
  }

  const evidenceRows = Array.isArray(input.evidence) ? input.evidence : [];
  let evidenceInserted = 0;
  if (evidenceRows.length > 0) {
    const payload = evidenceRows.map((row) => ({
      organization_id: existing.organization_id,
      work_case_id: existing.id,
      project_id: existing.project_id,
      evidence_type: row.evidenceType,
      entity_type: row.entityType,
      entity_id: row.entityId ?? null,
      label: row.label ?? null,
      confidence: row.confidence == null ? null : Number(row.confidence),
      metadata: {
        ...(row.metadata ?? {}),
        source: "agent_closure",
        agentRunId: input.agentRunId ?? null,
      },
    }));

    const insertResult = await client.database.from("work_case_evidence").insert(payload);
    if (insertResult.error) {
      dbLogger.warn(
        { err: insertResult.error, workCaseId: existing.id, count: payload.length },
        "agent close evidence insert failed",
      );
    } else {
      evidenceInserted = payload.length;
    }
  }

  const eventResult = await client.database
    .from("work_case_events")
    .insert({
      organization_id: existing.organization_id,
      work_case_id: existing.id,
      project_id: existing.project_id,
      actor_user_id: input.actorUserId,
      event_type: "work_case.status_changed",
      summary: `${statusLabel(existing.status)} → ${statusLabel(AGENT_TERMINAL_STATUS)} (agente)`,
      payload: {
        previousStatus: existing.status,
        status: AGENT_TERMINAL_STATUS,
        previousVerdict: existing.verdict,
        verdict: input.verdict,
        summary,
        rationale,
        closedByUserId: input.actorUserId,
        evidenceCount: evidenceInserted,
        capabilityId: input.capabilityId ?? null,
        agentRunId: input.agentRunId ?? null,
        source: "agent_closure",
      },
    })
    .select("id")
    .single();

  if (eventResult.error) {
    dbLogger.warn(
      { err: eventResult.error, workCaseId: existing.id },
      "agent close event insert failed",
    );
  }

  return {
    ok: true,
    message: "Expediente marcado como resuelto por el agente. Un humano puede reabrirlo o avanzar a 'cerrado'.",
    workCaseId: existing.id,
    status: AGENT_TERMINAL_STATUS,
    verdict: input.verdict,
    evidenceInserted,
    eventId: (eventResult.data as { id: string } | null)?.id ?? undefined,
  };
}

function statusLabel(status: WorkCaseStatus): string {
  if (status === "open") return "Abierto";
  if (status === "in_progress") return "En curso";
  if (status === "waiting") return "En espera";
  if (status === "resolved") return "Resuelto";
  if (status === "closed") return "Cerrado";
  return "Archivado";
}
