import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { buildSystemPrompt, createBoundTools } from "@/lib/ai/agent";
import { routeModel } from "@/lib/ai/model-router";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth, type AuthResult } from "@/lib/auth/require-auth";
import { learnFromSession } from "@/lib/ai/session-learner";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";
import { aiLogger, getRequestLogger, REQUEST_ID_HEADER } from "@/lib/logger";
import { writeAuditLogEvent } from "@/lib/audit/audit-log";

export const runtime = "nodejs";

const MAX_MESSAGES = 60;
const MAX_LAST_MSG_CHARS = 200_000;

const deepseek = createOpenAI({
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

  const { systemPrompt, tools, auditProjectId } = await resolveContext(auth, projectName, projectId);

  const route = routeModel(messages);
  log.info({
    orgId: auth.orgId,
    tier: route.tier,
    model: route.model,
    reason: route.reason,
    signals: route.signals,
  }, "model routed");

  const t0 = Date.now();
  try {
    const result = streamText({
      model: deepseek.chat(route.model),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(20),
      onFinish: async ({ steps, usage }) => {
        log.info({
          orgId: auth.orgId,
          model: route.model,
          tier: route.tier,
          steps: steps.length,
          tokens: usage,
          latencyMs: Date.now() - t0,
        }, "chat finished");
        void writeAuditLogEvent({
          organizationId: auth.orgId,
          projectId: auditProjectId,
          actorUserId: auth.userId,
          eventType: "chat.completed",
          entityType: "chat_turn",
          severity: "info",
          requestId: req.headers.get(REQUEST_ID_HEADER),
          payload: {
            model: route.model,
            tier: route.tier,
            routeReason: route.reason,
            steps: steps.length,
            usage,
            latencyMs: Date.now() - t0,
          },
        });
        void learnFromSession(steps as unknown as Parameters<typeof learnFromSession>[0], auth.orgId);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg, latencyMs: Date.now() - t0 }, "chat error");
    if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
      return Response.json({ error: "Cuota NVIDIA agotada. Intentá en unos minutos." }, { status: 429 });
    }
    if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
      return Response.json({ error: "API key NVIDIA inválida." }, { status: 500 });
    }
    throw err;
  }
}

interface RecentSession {
  title: string;
  file_type: string | null;
  started_at: number;
  project_id: string | null;
}

async function resolveContext(
  auth: AuthResult,
  projectName?: string,
  projectId?: string,
): Promise<{ systemPrompt: string; tools: ReturnType<typeof createBoundTools>; auditProjectId?: string }> {
  const { userId, orgId } = auth;
  const fallback = {
    systemPrompt: buildSystemPrompt({ organizationId: orgId, projectName, projectId }),
    tools: createBoundTools(orgId),
    auditProjectId: undefined,
  };

  try {
    const client = getInsForgeAdminClient();

    const [patternsResult, recentSessionsResult, projectCheckResult, orgResult] = await Promise.all([
      client.database
        .from("company_learned_patterns")
        .select("document_type, pattern_key, pattern_value")
        .eq("organization_id", orgId)
        .limit(50),

      client.database
        .from("chat_sessions")
        .select("title, file_type, started_at, project_id")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("started_at", { ascending: false })
        .limit(4),

      projectId
        ? client.database
            .from("projects")
            .select("id")
            .eq("id", projectId)
            .eq("organization_id", orgId)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),

      client.database
        .from("organizations")
        .select("name, agent_name, primary_color")
        .eq("id", orgId)
        .single(),
    ]);

    const org = orgResult.data as {
      name: string;
      agent_name: string | null;
      primary_color: string | null;
    } | null;

    const rawPatterns = (patternsResult.data ?? []) as {
      document_type: string;
      pattern_key: string;
      pattern_value: unknown;
    }[];

    const learnedPatterns: Record<string, Record<string, unknown>> = {};
    for (const row of rawPatterns) {
      learnedPatterns[row.document_type] ??= {};
      learnedPatterns[row.document_type]![row.pattern_key] = row.pattern_value;
    }

    const validatedProjectId = projectId && projectCheckResult.data ? projectId : undefined;
    const recentSessions = (recentSessionsResult.data ?? []) as RecentSession[];

    const systemPrompt = buildSystemPrompt({
      companyName: org?.name,
      agentName: org?.agent_name ?? "EdificIA",
      organizationId: orgId,
      learnedPatterns: Object.keys(learnedPatterns).length > 0 ? learnedPatterns : undefined,
      projectName,
      projectId: validatedProjectId,
      recentSessions: recentSessions.length > 0 ? recentSessions : undefined,
    });

    return { systemPrompt, tools: createBoundTools(orgId), auditProjectId: validatedProjectId };
  } catch {
    return fallback;
  }
}
