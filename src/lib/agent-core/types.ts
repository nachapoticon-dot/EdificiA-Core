export type AgentScopeLevel = "company" | "project" | "work_case";

// Mantener alineado con el CHECK de `work_cases.kind` en
// `migrations/20260517210141_work-cases.sql`.
export type WorkCaseKind =
  | "budget_audit"
  | "document_audit"
  | "schedule_review"
  | "financial_review"
  | "hse_review"
  | "supplies_review"
  | "subcontract_review"
  | "daily_brief"
  | "operations_update"
  | "communication"
  | "general"
  | "legacy_conversation";

// Mantener alineado con el CHECK de `work_cases.status`.
export type WorkCaseStatus =
  | "open"
  | "in_progress"
  | "waiting"
  | "resolved"
  | "closed"
  | "archived";

// Mantener alineado con el CHECK de `work_cases.verdict`
// (`migrations/20260518190721_work-case-verdict-closure.sql`).
export type WorkCaseVerdict =
  | "approved"
  | "flagged"
  | "inconclusive"
  | "rejected"
  | "superseded";

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
