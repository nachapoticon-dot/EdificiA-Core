import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiBadRequest, apiForbidden, apiRateLimited } from "@/lib/api/errors";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getRequestLogger } from "@/lib/logger";
import {
  LINKED_SESSION_COLUMNS,
  WORK_CASE_COLUMNS,
  toWorkCaseEntry,
  type LinkedSessionRow,
  type WorkCaseRow,
} from "@/lib/work-cases/serialize";
import {
  STATUS_LABELS,
  TERMINAL_STATUSES,
  WORK_CASE_STATUSES,
  WORK_CASE_VERDICTS,
  type WorkCaseStatus,
  type WorkCaseVerdict,
} from "@/lib/work-cases/types";
import { workCaseDetailResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

interface EventRow {
  id: string;
  event_type: string;
  summary: string | null;
  payload: Record<string, unknown> | null;
  actor_user_id: string | null;
  created_at: string;
}

interface AgentRunRow {
  id: string;
  model: string;
  tier: "fast" | "deep";
  route_reason: string | null;
  steps: number;
  tool_calls_total: number;
  tool_errors_total: number;
  latency_ms: number;
  started_at: string;
}

/** Detalle de un expediente: datos, eventos y corridas del agente. */
export async function GET(req: Request, { params }: Params): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "work-case-detail"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const client = getInsForgeAdminClient();

  const workCaseResult = await client.database
    .from("work_cases")
    .select(WORK_CASE_COLUMNS)
    .eq("id", id)
    .eq("organization_id", auth.orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (workCaseResult.error) {
    getRequestLogger(req).warn({ err: workCaseResult.error, workCaseId: id }, "work case detail query failed");
    return Response.json({ error: "No se pudo leer el expediente" }, { status: 500 });
  }
  const workCase = workCaseResult.data as WorkCaseRow | null;
  if (!workCase) return Response.json({ error: "Expediente no encontrado" }, { status: 404 });

  const [sessionResult, eventsResult, runsResult] = await Promise.all([
    client.database
      .from("chat_sessions")
      .select(LINKED_SESSION_COLUMNS)
      .eq("organization_id", auth.orgId)
      .eq("user_id", auth.userId)
      .eq("work_case_id", id)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(1),
    client.database
      .from("work_case_events")
      .select("id, event_type, summary, payload, actor_user_id, created_at")
      .eq("organization_id", auth.orgId)
      .eq("work_case_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    client.database
      .from("agent_runs")
      .select("id, model, tier, route_reason, steps, tool_calls_total, tool_errors_total, latency_ms, started_at")
      .eq("organization_id", auth.orgId)
      .eq("work_case_id", id)
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  const session = ((sessionResult.data ?? []) as LinkedSessionRow[])[0] ?? null;

  return Response.json(workCaseDetailResponseSchema.parse({
    workCase: toWorkCaseEntry(workCase, session),
    events: ((eventsResult.data ?? []) as EventRow[]).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      summary: e.summary,
      payload: e.payload ?? {},
      actorUserId: e.actor_user_id,
      createdAt: e.created_at,
    })),
    agentRuns: ((runsResult.data ?? []) as AgentRunRow[]).map((r) => ({
      id: r.id,
      model: r.model,
      tier: r.tier,
      routeReason: r.route_reason,
      steps: r.steps,
      toolCallsTotal: r.tool_calls_total,
      toolErrorsTotal: r.tool_errors_total,
      latencyMs: r.latency_ms,
      startedAt: r.started_at,
    })),
  }));
}

/**
 * Cambia el estado del expediente. Pasar a un estado terminal registra quién
 * lo cerró; reabrir limpia el cierre y, si no se indica otro, el veredicto.
 */
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "work-case-update"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role === "viewer") return apiForbidden("Sin permisos.");

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    status?: string;
    summary?: string | null;
    verdict?: string | null;
  } | null;

  const nextStatus = WORK_CASE_STATUSES.find((s) => s === body?.status);
  if (!nextStatus) return apiBadRequest("Estado inválido.");

  const hasVerdict = body != null && "verdict" in body;
  const nextVerdict: WorkCaseVerdict | null = body?.verdict == null
    ? null
    : WORK_CASE_VERDICTS.find((v) => v === body.verdict) ?? null;
  if (hasVerdict && body?.verdict != null && !nextVerdict) return apiBadRequest("Veredicto inválido.");

  const client = getInsForgeAdminClient();
  const existingResult = await client.database
    .from("work_cases")
    .select("id, status, project_id, verdict")
    .eq("id", id)
    .eq("organization_id", auth.orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingResult.error) return Response.json({ error: "No se pudo leer el expediente" }, { status: 500 });
  const existing = existingResult.data as {
    id: string;
    status: WorkCaseStatus;
    project_id: string | null;
    verdict: WorkCaseVerdict | null;
  } | null;
  if (!existing) return Response.json({ error: "Expediente no encontrado" }, { status: 404 });

  const now = new Date().toISOString();
  const terminal = TERMINAL_STATUSES.includes(nextStatus);
  const patch: Record<string, unknown> = {
    status: nextStatus,
    updated_at: now,
    closed_at: terminal ? now : null,
    closed_by_user_id: terminal ? auth.userId : null,
  };
  if (hasVerdict || !terminal) patch.verdict = hasVerdict ? nextVerdict : null;
  if (body && "summary" in body) patch.summary = body.summary?.trim().slice(0, 2000) || null;

  const update = await client.database
    .from("work_cases")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", auth.orgId);
  if (update.error) return Response.json({ error: "No se pudo actualizar el expediente" }, { status: 500 });

  await client.database.from("work_case_events").insert({
    organization_id: auth.orgId,
    work_case_id: id,
    project_id: existing.project_id,
    actor_user_id: auth.userId,
    event_type: "work_case.status_changed",
    summary: `${STATUS_LABELS[existing.status]} → ${STATUS_LABELS[nextStatus]}`,
    payload: {
      previousStatus: existing.status,
      status: nextStatus,
      previousVerdict: existing.verdict,
      verdict: "verdict" in patch ? patch.verdict : existing.verdict,
    },
  });

  return GET(req, { params: Promise.resolve({ id }) });
}
