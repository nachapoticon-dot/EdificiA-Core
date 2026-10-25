import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { routeModel } from "@/lib/ai/model-router";
import { resolveAgentTurnContext } from "@/lib/ai/runtime";
import { writeAgentRun } from "@/lib/ai/agent-runs";
import { summarizeToolUsage, toTelemetryRows, type StepLike } from "@/lib/ai/tool-telemetry";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";
import { aiLogger, dbLogger, getRequestLogger, REQUEST_ID_HEADER } from "@/lib/logger";
import { writeAuditLogEvent } from "@/lib/audit/audit-log";
import { captureAppError } from "@/lib/observability/error-events";

export const runtime = "nodejs";

const MAX_MESSAGES = 60;
const MAX_LAST_MSG_CHARS = 200_000;

// openai-compatible (y no createOpenAI) porque conserva `reasoning_content` de
// DeepSeek y lo reenvía en el turno siguiente; sin eso la API rechaza el
// historial en modo thinking.
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

  const chatSessionId = req.headers.get("x-chat-session-id")?.trim() || undefined;
  const { systemPrompt, tools, projectId, workCaseId } = await resolveAgentTurnContext(auth, {
    projectId: req.headers.get("x-project-id") ?? undefined,
    projectName: req.headers.get("x-project-name") ?? undefined,
    chatSessionId,
  });

  const route = routeModel(messages);
  const stepBudget = route.tier === "deep" ? 35 : 20;
  log.info({ orgId: auth.orgId, tier: route.tier, model: route.model, reason: route.reason, stepBudget }, "model routed");

  const startedAt = new Date();
  try {
    const result = streamText({
      model: deepseek.chatModel(route.model),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(stepBudget),
      onFinish: async ({ steps, usage }) => {
        const toolTelemetry = toTelemetryRows(summarizeToolUsage(steps as unknown as StepLike[]));
        const sum = (key: "calls" | "errors" | "retries") => toolTelemetry.reduce((acc, t) => acc + t[key], 0);
        const finishedAt = new Date();
        const run = {
          model: route.model,
          tier: route.tier,
          routeReason: route.reason,
          stepBudget,
          steps: steps.length,
          usage,
          toolTelemetry,
          toolCallsTotal: sum("calls"),
          toolErrorsTotal: sum("errors"),
          toolRetriesTotal: sum("retries"),
          latencyMs: finishedAt.getTime() - startedAt.getTime(),
        };
        const requestId = req.headers.get(REQUEST_ID_HEADER);
        log.info({ orgId: auth.orgId, ...run, toolTelemetry: undefined }, "chat finished");

        const agentRunId = await writeAgentRun({
          ...run,
          organizationId: auth.orgId,
          projectId,
          workCaseId,
          chatSessionId: chatSessionId ?? null,
          actorUserId: auth.userId,
          requestId,
          startedAt,
          finishedAt,
        });

        if (workCaseId) {
          void writeWorkCaseEvent(auth.orgId, workCaseId, projectId, auth.userId, { ...run, agentRunId });
        }
        void writeAuditLogEvent({
          organizationId: auth.orgId,
          projectId: projectId ?? undefined,
          actorUserId: auth.userId,
          eventType: "chat.completed",
          entityType: "chat_turn",
          entityId: agentRunId,
          severity: run.toolErrorsTotal > 0 ? "warning" : "info",
          requestId,
          payload: { ...run, agentRunId, workCaseId },
        });
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, "chat error");
    await captureAppError({
      err,
      req,
      organizationId: auth.orgId,
      projectId,
      actorUserId: auth.userId,
      route: "/api/chat",
      severity: "critical",
      context: { model: route.model, tier: route.tier, chatSessionId: chatSessionId ?? null },
    });
    if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
      return Response.json({ error: "Cuota del proveedor de IA (DeepSeek) agotada. Intentá en unos minutos." }, { status: 429 });
    }
    if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
      return Response.json({ error: "API key de DeepSeek inválida." }, { status: 500 });
    }
    throw err;
  }
}

async function writeWorkCaseEvent(
  organizationId: string,
  workCaseId: string,
  projectId: string | null,
  actorUserId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const result = await getInsForgeAdminClient().database.from("work_case_events").insert({
    organization_id: organizationId,
    work_case_id: workCaseId,
    project_id: projectId,
    actor_user_id: actorUserId,
    event_type: "chat.turn_completed",
    summary: null,
    payload,
  });
  if (result.error) dbLogger.warn({ err: result.error, workCaseId }, "work_case_event insert failed");
}
