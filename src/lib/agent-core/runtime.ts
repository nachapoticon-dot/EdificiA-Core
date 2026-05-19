import { buildSystemPrompt, createBoundTools } from "@/lib/ai/agent";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { loadEnterpriseProfileForAgent } from "@/lib/enterprise-context/profile-reader";
import type { AuthResult } from "@/lib/auth/require-auth";
import { buildAgentCoreScope } from "./context-builder";
import { getCapabilitiesForScope } from "./capability-registry";
import type { AgentCapabilityId, AgentCoreScope } from "./types";

interface RecentSession {
  title: string;
  file_type: string | null;
  started_at: number;
  project_id: string | null;
}

export interface AgentRuntimeContext {
  systemPrompt: string;
  tools: ReturnType<typeof createBoundTools>;
  auditProjectId?: string;
  agentScope: AgentCoreScope;
  capabilityIds: AgentCapabilityId[];
}

export async function resolveAgentRuntimeContext(
  auth: AuthResult,
  projectName?: string,
  projectId?: string,
  chatSessionId?: string,
): Promise<AgentRuntimeContext> {
  const { userId, orgId } = auth;
  const fallbackScope = buildAgentCoreScope({
    organizationId: orgId,
    actorUserId: userId,
    projectId,
    projectName,
  });
  const fallback = {
    systemPrompt: buildSystemPrompt({ organizationId: orgId, projectName, projectId }),
    tools: createBoundTools(orgId, userId),
    auditProjectId: undefined,
    agentScope: fallbackScope,
    capabilityIds: getCapabilitiesForScope(Boolean(fallbackScope.projectId)).map((capability) => capability.id),
  };

  try {
    const client = getInsForgeAdminClient();

    const [patternsResult, recentSessionsResult, projectCheckResult, orgResult, chatSessionResult, enterpriseProfile] = await Promise.all([
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

      chatSessionId
        ? client.database
            .from("chat_sessions")
            .select("work_case_id, project_id")
            .eq("organization_id", orgId)
            .eq("user_id", userId)
            .eq("id", chatSessionId)
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),

      loadEnterpriseProfileForAgent(orgId),
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

    const chatSession = chatSessionResult.data as {
      work_case_id: string | null;
      project_id: string | null;
    } | null;
    const workCaseId = chatSession?.work_case_id ?? undefined;
    const validatedProjectId = projectId && projectCheckResult.data
      ? projectId
      : (!projectId && chatSession?.project_id ? chatSession.project_id : undefined);
    const recentSessions = (recentSessionsResult.data ?? []) as RecentSession[];
    const agentScope = buildAgentCoreScope({
      organizationId: orgId,
      organizationName: org?.name,
      actorUserId: userId,
      projectId: validatedProjectId,
      projectName,
      workCaseId,
    });
    const capabilityIds = getCapabilitiesForScope(Boolean(validatedProjectId)).map((capability) => capability.id);

    const systemPrompt = buildSystemPrompt({
      companyName: org?.name,
      agentName: org?.agent_name ?? "EdificIA",
      organizationId: orgId,
      learnedPatterns: Object.keys(learnedPatterns).length > 0 ? learnedPatterns : undefined,
      projectName,
      projectId: validatedProjectId,
      workCaseId,
      recentSessions: recentSessions.length > 0 ? recentSessions : undefined,
      enterpriseProfile: enterpriseProfile ?? undefined,
    });

    return {
      systemPrompt,
      tools: createBoundTools(orgId, userId, { projectId: validatedProjectId, workCaseId }),
      auditProjectId: validatedProjectId,
      agentScope,
      capabilityIds,
    };
  } catch {
    return fallback;
  }
}
