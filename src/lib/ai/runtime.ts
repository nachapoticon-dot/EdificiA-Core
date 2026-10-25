import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { resolveOrgProjectId } from "@/lib/projects";
import type { AuthResult } from "@/lib/auth/require-auth";
import { buildSystemPrompt, type RecentSession } from "./prompt";
import { createAgentTools, type AgentTools } from "./tools";

export interface AgentTurnContext {
  systemPrompt: string;
  tools: AgentTools;
  projectId: string | null;
  workCaseId: string | null;
}

interface TurnRequest {
  projectId?: string;
  projectName?: string;
  chatSessionId?: string;
}

/**
 * Resuelve el contexto de un turno de chat: valida que la obra y la sesión
 * pertenezcan a la organización del usuario y arma prompt y tools.
 */
export async function resolveAgentTurnContext(auth: AuthResult, request: TurnRequest): Promise<AgentTurnContext> {
  const { userId, orgId } = auth;
  const client = getInsForgeAdminClient();

  const [validProjectId, orgResult, sessionResult, recentResult] = await Promise.all([
    resolveOrgProjectId(orgId, request.projectId),
    client.database.from("organizations").select("name, agent_name").eq("id", orgId).maybeSingle(),
    request.chatSessionId
      ? client.database
          .from("chat_sessions")
          .select("work_case_id, project_id")
          .eq("id", request.chatSessionId)
          .eq("organization_id", orgId)
          .eq("user_id", userId)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client.database
      .from("chat_sessions")
      .select("title, file_type, started_at, project_id")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(4),
  ]);

  const org = orgResult.data as { name: string; agent_name: string | null } | null;
  const session = sessionResult.data as { work_case_id: string | null; project_id: string | null } | null;
  const projectId = validProjectId ?? (request.projectId ? null : session?.project_id ?? null);
  const workCaseId = session?.work_case_id ?? null;

  const systemPrompt = buildSystemPrompt({
    agentName: org?.agent_name ?? "EdificIA",
    companyName: org?.name,
    projectName: projectId ? request.projectName : undefined,
    projectId: projectId ?? undefined,
    workCaseId: workCaseId ?? undefined,
    recentSessions: (recentResult.data ?? []) as RecentSession[],
  });

  return { systemPrompt, tools: createAgentTools(orgId, userId), projectId, workCaseId };
}
