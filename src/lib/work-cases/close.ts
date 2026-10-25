import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import { STATUS_LABELS, TERMINAL_STATUSES, type WorkCaseStatus, type WorkCaseVerdict } from "./types";

export interface CloseWorkCaseInput {
  organizationId: string;
  actorUserId: string;
  workCaseId: string;
  verdict: WorkCaseVerdict;
  summary: string;
  rationale?: string;
}

export interface CloseWorkCaseResult {
  ok: boolean;
  reason?: "not_found" | "already_terminal" | "db_error";
  message: string;
}

/**
 * Cierre propuesto por el agente. Solo mueve a `resolved`: pasar a `closed` o
 * `archived` sigue siendo una acción humana desde la UI.
 */
export async function closeWorkCaseFromAgent(input: CloseWorkCaseInput): Promise<CloseWorkCaseResult> {
  const client = getInsForgeAdminClient();

  const lookup = await client.database
    .from("work_cases")
    .select("id, project_id, status, verdict")
    .eq("id", input.workCaseId)
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookup.error) return { ok: false, reason: "db_error", message: "No se pudo leer el expediente." };
  const existing = lookup.data as { id: string; project_id: string | null; status: WorkCaseStatus; verdict: WorkCaseVerdict | null } | null;
  if (!existing) return { ok: false, reason: "not_found", message: "Expediente no encontrado en esta organización." };
  if (TERMINAL_STATUSES.includes(existing.status)) {
    return { ok: false, reason: "already_terminal", message: `El expediente ya está ${STATUS_LABELS[existing.status].toLowerCase()}.` };
  }

  const now = new Date().toISOString();
  const update = await client.database
    .from("work_cases")
    .update({
      status: "resolved",
      verdict: input.verdict,
      summary: input.summary.trim(),
      closed_at: now,
      closed_by_user_id: input.actorUserId,
      updated_at: now,
    })
    .eq("id", existing.id)
    .eq("organization_id", input.organizationId);

  if (update.error) {
    dbLogger.warn({ err: update.error, workCaseId: existing.id }, "agent close update failed");
    return { ok: false, reason: "db_error", message: "No se pudo actualizar el expediente." };
  }

  const event = await client.database.from("work_case_events").insert({
    organization_id: input.organizationId,
    work_case_id: existing.id,
    project_id: existing.project_id,
    actor_user_id: input.actorUserId,
    event_type: "work_case.status_changed",
    summary: `${STATUS_LABELS[existing.status]} → ${STATUS_LABELS.resolved} (agente)`,
    payload: {
      previousStatus: existing.status,
      status: "resolved",
      previousVerdict: existing.verdict,
      verdict: input.verdict,
      rationale: input.rationale ?? null,
      source: "agent_closure",
    },
  });
  if (event.error) dbLogger.warn({ err: event.error, workCaseId: existing.id }, "agent close event insert failed");

  return { ok: true, message: "Expediente marcado como resuelto. Un usuario puede reabrirlo o cerrarlo." };
}
