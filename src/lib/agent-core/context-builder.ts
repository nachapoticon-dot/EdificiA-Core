import type { AgentCoreScope, AgentScopeLevel, WorkCaseKind } from "./types";

interface BuildAgentScopeInput {
  organizationId: string;
  organizationName?: string;
  actorUserId: string;
  projectId?: string;
  projectName?: string;
  workCaseId?: string;
  workCaseKind?: WorkCaseKind;
}

export function buildAgentCoreScope(input: BuildAgentScopeInput): AgentCoreScope {
  const scopeLevel: AgentScopeLevel = input.workCaseId
    ? "work_case"
    : input.projectId
      ? "project"
      : "company";

  return {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    actorUserId: input.actorUserId,
    projectId: input.projectId,
    projectName: input.projectName,
    workCaseId: input.workCaseId,
    workCaseKind: input.workCaseKind,
    scopeLevel,
  };
}
