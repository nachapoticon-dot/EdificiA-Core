export type AgentScopeLevel = "company" | "project" | "work_case";

export type WorkCaseKind =
  | "document_audit"
  | "operational_risk"
  | "daily_brief"
  | "document_generation"
  | "communication"
  | "legacy_conversation";

export type WorkCaseStatus = "open" | "waiting_user" | "resolved" | "archived";

export type AgentCapabilityId =
  | "context.search"
  | "document.audit"
  | "budget.audit"
  | "project.brief"
  | "operations.update"
  | "documents.generate"
  | "communications.prepare"
  | "communications.send";

export interface AgentCoreScope {
  organizationId: string;
  organizationName?: string;
  actorUserId: string;
  projectId?: string;
  projectName?: string;
  workCaseId?: string;
  workCaseKind?: WorkCaseKind;
  scopeLevel: AgentScopeLevel;
}

export interface AgentCapability {
  id: AgentCapabilityId;
  label: string;
  description: string;
  requiresProject: boolean;
  writesData: boolean;
}

export interface PromptModule {
  id: string;
  title: string;
  body: string;
}
