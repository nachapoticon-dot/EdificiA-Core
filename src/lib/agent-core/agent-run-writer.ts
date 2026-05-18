import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";

export interface WriteAgentRunInput {
  organizationId: string;
  projectId?: string | null;
  workCaseId?: string | null;
  chatSessionId?: string | null;
  actorUserId: string;
  model: string;
  tier: "fast" | "deep";
  routeReason: string;
  capabilityIds: string[];
  stepBudget: number;
  steps: number;
  usage: unknown;
  toolTelemetry: unknown;
  toolCallsTotal: number;
  toolErrorsTotal: number;
  toolRetriesTotal: number;
  latencyMs: number;
  requestId?: string | null;
  startedAt: Date;
  finishedAt: Date;
}

export async function writeAgentRun(input: WriteAgentRunInput): Promise<string | null> {
  try {
    const client = getInsForgeAdminClient();
    const result = await client.database
      .from("agent_runs")
      .insert({
        organization_id: input.organizationId,
        project_id: input.projectId ?? null,
        work_case_id: input.workCaseId ?? null,
        chat_session_id: input.chatSessionId ?? null,
        actor_user_id: input.actorUserId,
        status: "completed",
        model_provider: "deepseek",
        model: input.model,
        tier: input.tier,
        route_reason: input.routeReason,
        capability_ids: input.capabilityIds,
        step_budget: input.stepBudget,
        steps: input.steps,
        usage: input.usage ?? {},
        tool_telemetry: input.toolTelemetry ?? [],
        tool_calls_total: input.toolCallsTotal,
        tool_errors_total: input.toolErrorsTotal,
        tool_retries_total: input.toolRetriesTotal,
        latency_ms: input.latencyMs,
        request_id: input.requestId ?? null,
        started_at: input.startedAt.toISOString(),
        finished_at: input.finishedAt.toISOString(),
      })
      .select("id")
      .single();

    if (result.error) {
      dbLogger.warn({ err: result.error, workCaseId: input.workCaseId }, "agent run insert failed");
      return null;
    }

    return (result.data as { id: string } | null)?.id ?? null;
  } catch (err) {
    dbLogger.warn({ err, workCaseId: input.workCaseId }, "agent run insert failed");
    return null;
  }
}
