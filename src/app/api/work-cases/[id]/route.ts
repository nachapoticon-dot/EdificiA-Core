import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiBadRequest, apiForbidden, apiRateLimited } from "@/lib/api/errors";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getRequestLogger } from "@/lib/logger";
import { workCaseDetailResponseSchema } from "@/lib/validators/api-responses";
import type { WorkCaseKind, WorkCaseStatus, WorkCaseVerdict } from "@/lib/agent-core";

export const runtime = "nodejs";

interface WorkCaseRow {
  id: string;
  kind: WorkCaseKind;
  status: WorkCaseStatus;
  title: string;
  summary: string | null;
  verdict: WorkCaseVerdict | null;
  closed_by_user_id: string | null;
  closed_at: string | null;
  project_id: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatSessionRow {
  id: string;
  title: string;
  file_type: string | null;
  started_at: number;
  work_case_id: string | null;
}

interface WorkCaseEventRow {
  id: string;
  event_type: string;
  summary: string | null;
  payload: Record<string, unknown> | null;
  actor_user_id: string | null;
  project_id: string | null;
  created_at: string;
}

interface WorkCaseEvidenceRow {
  id: string;
  evidence_type: string;
  entity_type: string;
  entity_id: string | null;
  label: string | null;
  confidence: number | string | null;
  metadata: Record<string, unknown> | null;
  project_id: string | null;
  created_at: string;
}

interface DocumentIntelligenceReportRow {
  id: string;
  file_id: string | null;
  report_type: "upload_scan" | "agent_audit" | "manual_review";
  status: "ready" | "needs_review" | "superseded" | "failed";
  source: "system" | "agent" | "user";
  document_type: string;
  verdict: "consistent" | "inconsistent" | "needs_review" | "unsupported";
  confidence: number | string | null;
  summary: string | null;
  classification: Record<string, unknown> | null;
  extraction: Record<string, unknown> | null;
  risks: unknown;
  findings: unknown;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface AgentRunRow {
  id: string;
  status: "completed" | "failed" | "cancelled";
  model_provider: string;
  model: string;
  tier: "fast" | "deep";
  route_reason: string | null;
  capability_ids: string[] | null;
  step_budget: number;
  steps: number;
  usage: Record<string, unknown> | null;
  tool_telemetry: unknown;
  tool_calls_total: number;
  tool_errors_total: number;
  tool_retries_total: number;
  latency_ms: number;
  request_id: string | null;
  started_at: string;
  finished_at: string;
  created_at: string;
}

interface UploadedFileRow {
  id: string;
  file_name: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "work-case-detail"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const log = getRequestLogger(req);
  const client = getInsForgeAdminClient();

  const workCaseResult = await client.database
    .from("work_cases")
    .select(
      "id, kind, status, title, summary, verdict, closed_by_user_id, closed_at, project_id, owner_user_id, created_at, updated_at",
    )
    .eq("id", id)
    .eq("organization_id", auth.orgId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (workCaseResult.error) {
    log.warn({ err: workCaseResult.error, workCaseId: id }, "work case detail query failed");
    return Response.json({ error: "No se pudo leer el expediente" }, { status: 500 });
  }

  const workCase = workCaseResult.data as WorkCaseRow | null;
  if (!workCase) return Response.json({ error: "Expediente no encontrado" }, { status: 404 });

  const [sessionResult, eventsResult, evidenceResult, reportsResult, agentRunsResult] = await Promise.all([
    client.database
      .from("chat_sessions")
      .select("id, title, file_type, started_at, work_case_id")
      .eq("organization_id", auth.orgId)
      .eq("user_id", auth.userId)
      .eq("work_case_id", id)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(1),

    client.database
      .from("work_case_events")
      .select("id, event_type, summary, payload, actor_user_id, project_id, created_at")
      .eq("organization_id", auth.orgId)
      .eq("work_case_id", id)
      .order("created_at", { ascending: false })
      .limit(100),

    client.database
      .from("work_case_evidence")
      .select("id, evidence_type, entity_type, entity_id, label, confidence, metadata, project_id, created_at")
      .eq("organization_id", auth.orgId)
      .eq("work_case_id", id)
      .order("created_at", { ascending: false })
      .limit(100),

    client.database
      .from("document_intelligence_reports")
      .select(
        "id, file_id, report_type, status, source, document_type, verdict, confidence, summary, classification, extraction, risks, findings, metadata, created_at, updated_at",
      )
      .eq("organization_id", auth.orgId)
      .eq("work_case_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),

    client.database
      .from("agent_runs")
      .select(
        "id, status, model_provider, model, tier, route_reason, capability_ids, step_budget, steps, usage, tool_telemetry, tool_calls_total, tool_errors_total, tool_retries_total, latency_ms, request_id, started_at, finished_at, created_at",
      )
      .eq("organization_id", auth.orgId)
      .eq("work_case_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (eventsResult.error) log.warn({ err: eventsResult.error, workCaseId: id }, "work case events query failed");
  if (evidenceResult.error) log.warn({ err: evidenceResult.error, workCaseId: id }, "work case evidence query failed");
  if (reportsResult.error) log.warn({ err: reportsResult.error, workCaseId: id }, "work case reports query failed");
  if (agentRunsResult.error) log.warn({ err: agentRunsResult.error, workCaseId: id }, "work case agent runs query failed");

  const reports = (reportsResult.data ?? []) as DocumentIntelligenceReportRow[];
  const fileIds = Array.from(
    new Set(reports.map((report) => report.file_id).filter((value): value is string => Boolean(value))),
  );

  const fileNameById = new Map<string, string>();
  if (fileIds.length > 0) {
    const filesResult = await client.database
      .from("uploaded_files")
      .select("id, file_name")
      .eq("organization_id", auth.orgId)
      .in("id", fileIds)
      .limit(fileIds.length);

    if (filesResult.error) {
      log.warn({ err: filesResult.error, workCaseId: id }, "work case report files lookup failed");
    } else {
      for (const row of (filesResult.data ?? []) as UploadedFileRow[]) {
        fileNameById.set(row.id, row.file_name);
      }
    }
  }

  const session = ((sessionResult.data ?? []) as ChatSessionRow[])[0] ?? null;
  const response = {
    workCase: {
      id: workCase.id,
      kind: workCase.kind,
      status: workCase.status,
      title: workCase.title,
      summary: workCase.summary,
      verdict: workCase.verdict,
      closedByUserId: workCase.closed_by_user_id,
      closedAt: workCase.closed_at,
      projectId: workCase.project_id,
      ownerUserId: workCase.owner_user_id,
      createdAt: workCase.created_at,
      updatedAt: workCase.updated_at,
      chatSessionId: session?.id ?? null,
      chatSessionTitle: session?.title ?? null,
      chatSessionFileType: normalizeSessionFileType(session?.file_type ?? null) ?? null,
      chatSessionStartedAt: session?.started_at ?? null,
    },
    events: ((eventsResult.data ?? []) as WorkCaseEventRow[]).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      summary: event.summary,
      payload: event.payload ?? {},
      actorUserId: event.actor_user_id,
      projectId: event.project_id,
      createdAt: event.created_at,
    })),
    evidence: ((evidenceResult.data ?? []) as WorkCaseEvidenceRow[]).map((item) => ({
      id: item.id,
      evidenceType: item.evidence_type,
      entityType: item.entity_type,
      entityId: item.entity_id,
      label: item.label,
      confidence: item.confidence == null ? null : Number(item.confidence),
      metadata: item.metadata ?? {},
      projectId: item.project_id,
      createdAt: item.created_at,
    })),
    documentReports: reports.map((report) => ({
      id: report.id,
      fileId: report.file_id,
      fileName: report.file_id ? fileNameById.get(report.file_id) ?? null : null,
      reportType: report.report_type,
      status: report.status,
      source: report.source,
      documentType: report.document_type,
      verdict: report.verdict,
      confidence: report.confidence == null ? null : Number(report.confidence),
      summary: report.summary,
      classification: (report.classification ?? {}) as Record<string, unknown>,
      extraction: (report.extraction ?? {}) as Record<string, unknown>,
      risks: Array.isArray(report.risks) ? (report.risks as Record<string, unknown>[]) : [],
      findings: Array.isArray(report.findings) ? (report.findings as Record<string, unknown>[]) : [],
      metadata: (report.metadata ?? {}) as Record<string, unknown>,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
    })),
    agentRuns: ((agentRunsResult.data ?? []) as AgentRunRow[]).map((run) => ({
      id: run.id,
      status: run.status,
      modelProvider: run.model_provider,
      model: run.model,
      tier: run.tier,
      routeReason: run.route_reason,
      capabilityIds: run.capability_ids ?? [],
      stepBudget: run.step_budget,
      steps: run.steps,
      usage: run.usage ?? {},
      toolTelemetry: Array.isArray(run.tool_telemetry) ? (run.tool_telemetry as Record<string, unknown>[]) : [],
      toolCallsTotal: run.tool_calls_total,
      toolErrorsTotal: run.tool_errors_total,
      toolRetriesTotal: run.tool_retries_total,
      latencyMs: run.latency_ms,
      requestId: run.request_id,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      createdAt: run.created_at,
    })),
  };

  return Response.json(workCaseDetailResponseSchema.parse(response));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "work-case-update"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role === "viewer") return apiForbidden("Sin permisos.");

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    status?: WorkCaseStatus;
    summary?: string | null;
    verdict?: WorkCaseVerdict | null;
  } | null;

  const nextStatus = body?.status;
  if (!nextStatus || !isWorkCaseStatus(nextStatus)) {
    return apiBadRequest("Estado inválido.");
  }

  const isTerminal = ["resolved", "closed", "archived"].includes(nextStatus);
  const isActive = ["open", "in_progress", "waiting"].includes(nextStatus);

  const hasVerdictKey = body != null && Object.prototype.hasOwnProperty.call(body, "verdict");
  let nextVerdict: WorkCaseVerdict | null | undefined;
  if (hasVerdictKey) {
    if (body?.verdict == null) {
      nextVerdict = null;
    } else if (isWorkCaseVerdict(body.verdict)) {
      nextVerdict = body.verdict;
    } else {
      return apiBadRequest("Veredicto inválido.");
    }
  }

  const client = getInsForgeAdminClient();
  const existingResult = await client.database
    .from("work_cases")
    .select("id, status, project_id, summary, verdict")
    .eq("id", id)
    .eq("organization_id", auth.orgId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  const existing = existingResult.data as
    | {
        id: string;
        status: WorkCaseStatus;
        project_id: string | null;
        summary: string | null;
        verdict: WorkCaseVerdict | null;
      }
    | null;
  if (existingResult.error) return Response.json({ error: "No se pudo leer el expediente" }, { status: 500 });
  if (!existing) return Response.json({ error: "Expediente no encontrado" }, { status: 404 });

  const now = new Date().toISOString();
  const patch: {
    status: WorkCaseStatus;
    updated_at: string;
    closed_at?: string | null;
    closed_by_user_id?: string | null;
    summary?: string | null;
    verdict?: WorkCaseVerdict | null;
  } = {
    status: nextStatus,
    updated_at: now,
  };

  if (isTerminal) {
    patch.closed_at = now;
    patch.closed_by_user_id = auth.userId;
  }
  if (isActive) {
    patch.closed_at = null;
    patch.closed_by_user_id = null;
    if (!hasVerdictKey) {
      patch.verdict = null;
      nextVerdict = null;
    }
  }
  if ("summary" in (body ?? {})) {
    patch.summary = body?.summary?.trim() ? body.summary.trim().slice(0, 2000) : null;
  }
  if (hasVerdictKey) patch.verdict = nextVerdict ?? null;

  const updateResult = await client.database
    .from("work_cases")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", auth.orgId)
    .is("deleted_at", null);

  if (updateResult.error) return Response.json({ error: "No se pudo actualizar el expediente" }, { status: 500 });

  await client.database.from("work_case_events").insert({
    organization_id: auth.orgId,
    work_case_id: id,
    project_id: existing.project_id,
    actor_user_id: auth.userId,
    event_type: "work_case.status_changed",
    summary: `${statusLabel(existing.status)} → ${statusLabel(nextStatus)}`,
    payload: {
      previousStatus: existing.status,
      status: nextStatus,
      previousVerdict: existing.verdict,
      verdict: hasVerdictKey ? nextVerdict ?? null : existing.verdict,
      summary: patch.summary ?? existing.summary ?? null,
      closedByUserId: patch.closed_by_user_id ?? null,
    },
  });

  return GET(req, { params: Promise.resolve({ id }) });
}

function normalizeSessionFileType(value: string | null): "excel" | "pdf" | "dxf" | "docx" | "image" | undefined {
  if (
    value === "excel" ||
    value === "pdf" ||
    value === "dxf" ||
    value === "docx" ||
    value === "image"
  ) {
    return value;
  }
  return undefined;
}

function isWorkCaseStatus(value: string): value is WorkCaseStatus {
  return (
    value === "open" ||
    value === "in_progress" ||
    value === "waiting" ||
    value === "resolved" ||
    value === "closed" ||
    value === "archived"
  );
}

function isWorkCaseVerdict(value: string): value is WorkCaseVerdict {
  return (
    value === "approved" ||
    value === "flagged" ||
    value === "inconclusive" ||
    value === "rejected" ||
    value === "superseded"
  );
}

function statusLabel(status: WorkCaseStatus): string {
  if (status === "open") return "Abierto";
  if (status === "in_progress") return "En curso";
  if (status === "waiting") return "En espera";
  if (status === "resolved") return "Resuelto";
  if (status === "closed") return "Cerrado";
  return "Archivado";
}
