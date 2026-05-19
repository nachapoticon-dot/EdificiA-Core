import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { routeModel } from "@/lib/ai/model-router";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { learnFromSession } from "@/lib/ai/session-learner";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";
import { aiLogger, dbLogger, getRequestLogger, REQUEST_ID_HEADER } from "@/lib/logger";
import { writeAuditLogEvent } from "@/lib/audit/audit-log";
import { summarizeToolUsage, toTelemetryRows, type StepLike } from "@/lib/ai/observability/tool-telemetry";
import { resolveAgentRuntimeContext } from "@/lib/agent-core/runtime";
import { writeAgentRun } from "@/lib/agent-core/agent-run-writer";
import { captureAppError } from "@/lib/observability/error-events";

export const runtime = "nodejs";

const MAX_MESSAGES = 60;
const MAX_LAST_MSG_CHARS = 200_000;

// Uso openai-compatible (no createOpenAI) porque extrae el campo
// `reasoning_content` de DeepSeek tanto en respuestas como en deltas streaming,
// y lo reinyecta en el body de la siguiente request cuando el mensaje del
// assistant en el historial trae una ReasoningUIPart. Sin esto, DeepSeek tira
// "The `reasoning_content` in the thinking mode must be passed back to the API."
const deepseek = createOpenAICompatible({
  name: "deepseek",
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
});

export async function POST(req: Request) {
  const log = getRequestLogger(req, aiLogger);
  const { messages }: { messages: UIMessage[] } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "No messages." }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) {
    return Response.json({ error: "Conversación demasiado larga. Iniciá una nueva sesión." }, { status: 429 });
  }
  const lastText = messages[messages.length - 1]?.parts
    ?.map((p: { type?: string; text?: string }) => (p.type === "text" ? (p.text ?? "") : ""))
    .join("") ?? "";
  if (lastText.length > MAX_LAST_MSG_CHARS) {
    return Response.json({ error: "Mensaje demasiado largo." }, { status: 413 });
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  if (!checkRateLimit(rateLimitKey(req, "chat"), "chat")) {
    return apiRateLimited("Límite diario alcanzado. Intentá mañana.");
  }

  const projectName = req.headers.get("x-project-name") ?? undefined;
  const projectId   = req.headers.get("x-project-id")   ?? undefined;
  const chatSessionId = req.headers.get("x-chat-session-id")?.trim() || undefined;

  const { systemPrompt, tools, auditProjectId, agentScope, capabilityIds } = await resolveAgentRuntimeContext(auth, projectName, projectId, chatSessionId);

  const route = routeModel(messages);
  const stepBudget = route.tier === "deep" ? 35 : 20;
  log.info({
    orgId: auth.orgId,
    agentScopeLevel: agentScope.scopeLevel,
    capabilityIds,
    tier: route.tier,
    model: route.model,
    reason: route.reason,
    signals: route.signals,
    stepBudget,
  }, "model routed");

  const t0 = Date.now();
  const startedAt = new Date(t0);
  try {
    const result = streamText({
      model: deepseek.chatModel(route.model),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(stepBudget),
      onFinish: async ({ steps, usage }) => {
        const telemetry = summarizeToolUsage(steps as unknown as StepLike[]);
        const telemetryRows = toTelemetryRows(telemetry);
        const toolCallsTotal = telemetryRows.reduce((sum, t) => sum + t.calls, 0);
        const totalErrors = telemetryRows.reduce((sum, t) => sum + t.errors, 0);
        const totalRetries = telemetryRows.reduce((sum, t) => sum + t.retries, 0);
        const finishedAt = new Date();
        const latencyMs = finishedAt.getTime() - t0;
        const requestId = req.headers.get(REQUEST_ID_HEADER);
        log.info({
          orgId: auth.orgId,
          agentScopeLevel: agentScope.scopeLevel,
          model: route.model,
          tier: route.tier,
          steps: steps.length,
          toolCalls: toolCallsTotal,
          toolErrors: totalErrors,
          toolRetries: totalRetries,
          tokens: usage,
          latencyMs,
        }, "chat finished");
        const agentRunId = await writeAgentRun({
          organizationId: auth.orgId,
          projectId: auditProjectId ?? null,
          workCaseId: agentScope.workCaseId ?? null,
          chatSessionId: chatSessionId ?? null,
          actorUserId: auth.userId,
          model: route.model,
          tier: route.tier,
          routeReason: route.reason,
          capabilityIds,
          stepBudget,
          steps: steps.length,
          usage,
          toolTelemetry: telemetryRows,
          toolCallsTotal,
          toolErrorsTotal: totalErrors,
          toolRetriesTotal: totalRetries,
          latencyMs,
          requestId,
          startedAt,
          finishedAt,
        });
        if (agentScope.workCaseId) {
          void writeWorkCaseTurnCompletedEvent({
            organizationId: auth.orgId,
            workCaseId: agentScope.workCaseId,
            projectId: auditProjectId ?? null,
            actorUserId: auth.userId,
            payload: {
              tier: route.tier,
              model: route.model,
              stepBudget,
              steps: steps.length,
              toolCallsTotal,
              toolErrorsTotal: totalErrors,
              toolRetriesTotal: totalRetries,
              latencyMs,
              agentRunId,
            },
          });
        }
        void writeAuditLogEvent({
          organizationId: auth.orgId,
          projectId: auditProjectId,
          actorUserId: auth.userId,
          eventType: "chat.completed",
          entityType: "chat_turn",
          entityId: agentRunId,
          severity: totalErrors > 0 ? "warning" : "info",
          requestId,
          payload: {
            agentRunId,
            model: route.model,
            tier: route.tier,
            routeReason: route.reason,
            agentCore: {
              scope: {
                level: agentScope.scopeLevel,
                organizationId: agentScope.organizationId,
                projectId: agentScope.projectId ?? null,
                workCaseId: agentScope.workCaseId ?? null,
                workCaseKind: agentScope.workCaseKind ?? null,
              },
              capabilityIds,
            },
            stepBudget,
            steps: steps.length,
            usage,
            latencyMs,
            toolTelemetry: telemetryRows,
            toolCallsTotal,
            toolErrorsTotal: totalErrors,
            toolRetriesTotal: totalRetries,
          },
        });
        void learnFromSession(steps as unknown as Parameters<typeof learnFromSession>[0], auth.orgId);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - t0;
    log.error({ err: msg, latencyMs }, "chat error");
    await captureAppError({
      err,
      req,
      organizationId: auth.orgId,
      projectId: auditProjectId ?? null,
      actorUserId: auth.userId,
      route: "/api/chat",
      severity: "critical",
      context: { latencyMs, model: route.model, tier: route.tier, chatSessionId: chatSessionId ?? null },
    });
    if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
      return Response.json({ error: "Cuota NVIDIA agotada. Intentá en unos minutos." }, { status: 429 });
    }
    if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
      return Response.json({ error: "API key NVIDIA inválida." }, { status: 500 });
    }
    throw err;
  }
}

interface WorkCaseTurnCompletedEventInput {
  organizationId: string;
  workCaseId: string;
  projectId?: string | null;
  actorUserId: string;
  payload: Record<string, unknown>;
}

async function writeWorkCaseTurnCompletedEvent(input: WorkCaseTurnCompletedEventInput): Promise<void> {
  try {
    const client = getInsForgeAdminClient();
    const result = await client.database.from("work_case_events").insert({
      organization_id: input.organizationId,
      work_case_id: input.workCaseId,
      project_id: input.projectId ?? null,
      actor_user_id: input.actorUserId,
      event_type: "chat.turn_completed",
      summary: null,
      payload: input.payload,
    });

    if (result.error) {
      dbLogger.warn({ err: result.error, workCaseId: input.workCaseId }, "work_case_event insert failed");
    }
  } catch (err) {
    dbLogger.warn({ err, workCaseId: input.workCaseId }, "work_case_event insert failed");
  }
}
