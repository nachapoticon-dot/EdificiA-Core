export { AGENT_CAPABILITIES, getCapabilitiesForScope } from "./capability-registry";
export { buildAgentCoreScope } from "./context-builder";
export { buildIdentityModule, composePromptModules } from "./prompt-modules";
export { ensureWorkCaseForChatSession } from "./work-case-writer";
export { closeWorkCaseFromAgent } from "./work-case-closer";
export type {
  CloseWorkCaseFromAgentInput,
  CloseWorkCaseFromAgentResult,
  ProposedClosureEvidenceInput,
} from "./work-case-closer";
export type {
  AgentCapability,
  AgentCapabilityId,
  AgentCoreScope,
  AgentScopeLevel,
  PromptModule,
  WorkCaseKind,
  WorkCaseStatus,
  WorkCaseVerdict,
} from "./types";
