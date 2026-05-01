import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { AI_MODEL, buildSystemPrompt, agentTools } from "@/lib/ai/agent";
import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Extract Bearer token forwarded by the browser InsForge SDK
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Active project sent by the client (selected in the UI, stored in localStorage)
  const projectName = req.headers.get("x-project-name") ?? undefined;

  const systemPrompt = await resolveSystemPrompt(accessToken, projectName);

  const result = streamText({
    model: anthropic(AI_MODEL),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: agentTools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}

/**
 * Decodes the JWT access token (no signature verification — we trust the server DB for auth).
 * Returns the user's `sub` claim (= user_id in InsForge).
 */
function decodeUserId(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as { sub?: string };
    return parsed.sub ?? null;
  } catch {
    return null;
  }
}

async function resolveSystemPrompt(accessToken: string | null, projectName?: string): Promise<string> {
  if (!accessToken) return buildSystemPrompt({ projectName });

  const userId = decodeUserId(accessToken);
  if (!userId) return buildSystemPrompt();

  try {
    const client = getInsForgeAdminClient();

    const memberResult = await client.database
      .from("organization_members")
      .select("organization_id, organizations(name, agent_name, primary_color)")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    const member = memberResult.data as {
      organization_id: string;
      organizations: { name: string; agent_name: string; primary_color: string } | null;
    } | null;

    if (!member) return buildSystemPrompt();

    const orgId = member.organization_id;
    const org = member.organizations;

    // Load learned patterns for this org
    const patternsResult = await client.database
      .from("company_learned_patterns")
      .select("document_type, pattern_key, pattern_value")
      .eq("organization_id", orgId)
      .limit(50);

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

    return buildSystemPrompt({
      companyName: org?.name,
      agentName: org?.agent_name ?? "EdificIA",
      organizationId: orgId,
      learnedPatterns: Object.keys(learnedPatterns).length > 0 ? learnedPatterns : undefined,
      projectName,
    });
  } catch {
    return buildSystemPrompt();
  }
}
