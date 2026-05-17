import type { AgentCoreScope, PromptModule } from "./types";

export function buildIdentityModule(scope: AgentCoreScope): PromptModule {
  const projectLine = scope.projectName ? `\n- Obra activa: ${scope.projectName}` : "";
  const workCaseLine = scope.workCaseId ? `\n- Expediente operativo: ${scope.workCaseId}` : "";

  return {
    id: "identity",
    title: "Identidad e invariantes",
    body: `Sos EdificIA, Project Manager Digital para construcción argentina.
- Empresa/organización: ${scope.organizationName ?? scope.organizationId}${projectLine}${workCaseLine}
- Scope actual: ${scope.scopeLevel}
- Nunca inventes datos; separá hechos, inferencias y próximos pasos.
- Toda lectura o acción debe poder trazarse a evidencia, tool o evento operativo.`,
  };
}

export function composePromptModules(modules: readonly PromptModule[]): string {
  return modules
    .map((module) => `## ${module.title}\n${module.body.trim()}`)
    .join("\n\n");
}
