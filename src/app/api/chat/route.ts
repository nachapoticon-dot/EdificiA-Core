import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { AI_MODEL, buildSystemPrompt, agentTools, createBoundTools } from "@/lib/ai/agent";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { verifyUserId } from "@/lib/auth/jwt";
import { learnFromSession } from "@/lib/ai/session-learner";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";
import { aiLogger } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_MESSAGES = 60;
const MAX_LAST_MSG_CHARS = 200_000;

const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
});

export async function POST(req: Request) {
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

  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const projectName    = req.headers.get("x-project-name") ?? undefined;
  const projectId      = req.headers.get("x-project-id")   ?? undefined;
  const requestedOrgId = req.headers.get("x-org-id")       ?? undefined;

  if (!checkRateLimit(rateLimitKey(req, "chat"), "chat")) {
    return apiRateLimited("Límite diario alcanzado. Intentá mañana.");
  }

  const { systemPrompt, tools, orgId } = await resolveContext(accessToken, projectName, projectId, requestedOrgId);

  const t0 = Date.now();
  try {
    const result = streamText({
      model: deepseek.chat(AI_MODEL),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(20),
      onFinish: async ({ steps, usage }) => {
        aiLogger.info({
          orgId,
          steps: steps.length,
          tokens: usage,
          latencyMs: Date.now() - t0,
        }, "chat finished");
        if (orgId) {
          void learnFromSession(steps as unknown as Parameters<typeof learnFromSession>[0], orgId);
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    aiLogger.error({ err: msg, latencyMs: Date.now() - t0 }, "chat error");
    if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
      return Response.json({ error: "Cuota NVIDIA agotada. Intentá en unos minutos." }, { status: 429 });
    }
    if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
      return Response.json({ error: "API key NVIDIA inválida." }, { status: 500 });
    }
    throw err;
  }
}

type ResolvedContext = {
  systemPrompt: string;
  tools: ReturnType<typeof createBoundTools> | typeof agentTools;
  orgId?: string;
};

interface RecentSession {
  title: string;
  file_type: string | null;
  started_at: number;
  project_id: string | null;
}

async function resolveContext(
  accessToken: string | null,
  projectName?: string,
  projectId?: string,
  requestedOrgId?: string,
): Promise<ResolvedContext> {
  const fallback = { systemPrompt: buildSystemPrompt({ projectName, projectId }), tools: agentTools };

  if (!accessToken) return fallback;

  const userId = await verifyUserId(accessToken);
  if (!userId) return { systemPrompt: buildSystemPrompt(), tools: agentTools };

  try {
    const client = getInsForgeAdminClient();

    let memberQuery = client.database
      .from("organization_members")
      .select("organization_id, organizations(name, agent_name, primary_color)")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (requestedOrgId) {
      memberQuery = memberQuery.eq("organization_id", requestedOrgId);
    }

    const memberResult = await memberQuery.limit(1).single();

    const member = memberResult.data as {
      organization_id: string;
      organizations: { name: string; agent_name: string; primary_color: string } | null;
    } | null;

    if (!member) return { systemPrompt: buildSystemPrompt(), tools: agentTools };

    const orgId = member.organization_id;
    const org   = member.organizations;

    // Run patterns + recent sessions + project validation in parallel
    const [patternsResult, recentSessionsResult, projectCheckResult] = await Promise.all([
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

      projectId && orgId
        ? client.database
            .from("projects")
            .select("id")
            .eq("id", projectId)
            .eq("organization_id", orgId)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

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

    // A-04: use bound tools — organizationId is server-verified, not LLM-controlled
    return { systemPrompt, tools: createBoundTools(orgId), orgId };
  } catch {
    return { systemPrompt: buildSystemPrompt(), tools: agentTools };
  }
}
