import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAgentCoreScope,
  buildIdentityModule,
  composePromptModules,
  getCapabilitiesForScope,
} from "../../src/lib/agent-core/index.ts";

test("agent-core scope", async (t) => {
  await t.test("usa scope company cuando no hay obra ni expediente", () => {
    const scope = buildAgentCoreScope({
      organizationId: "org-1",
      actorUserId: "user-1",
    });

    assert.equal(scope.scopeLevel, "company");
    assert.equal(scope.organizationId, "org-1");
    assert.equal(scope.projectId, undefined);
  });

  await t.test("usa scope project cuando hay obra", () => {
    const scope = buildAgentCoreScope({
      organizationId: "org-1",
      actorUserId: "user-1",
      projectId: "project-1",
      projectName: "Torre Norte",
    });

    assert.equal(scope.scopeLevel, "project");
    assert.equal(scope.projectId, "project-1");
    assert.equal(scope.projectName, "Torre Norte");
  });

  await t.test("work_case tiene prioridad sobre project", () => {
    const scope = buildAgentCoreScope({
      organizationId: "org-1",
      actorUserId: "user-1",
      projectId: "project-1",
      workCaseId: "case-1",
      workCaseKind: "document_audit",
    });

    assert.equal(scope.scopeLevel, "work_case");
    assert.equal(scope.workCaseKind, "document_audit");
  });
});

test("agent-core capabilities", async (t) => {
  await t.test("sin obra oculta capacidades que requieren project", () => {
    const capabilities = getCapabilitiesForScope(false);
    const ids = capabilities.map((capability) => capability.id);

    assert.ok(ids.includes("context.search"));
    assert.ok(ids.includes("document.audit"));
    assert.ok(!ids.includes("project.brief"));
    assert.ok(!ids.includes("operations.update"));
  });

  await t.test("con obra habilita capacidades operativas", () => {
    const capabilities = getCapabilitiesForScope(true);
    const ids = capabilities.map((capability) => capability.id);

    assert.ok(ids.includes("project.brief"));
    assert.ok(ids.includes("operations.update"));
    assert.ok(ids.includes("communications.send"));
  });
});

test("agent-core prompt modules", () => {
  const scope = buildAgentCoreScope({
    organizationId: "org-1",
    organizationName: "Constructora Norte",
    actorUserId: "user-1",
    projectId: "project-1",
    projectName: "Torre Norte",
  });

  const identity = buildIdentityModule(scope);
  const prompt = composePromptModules([identity]);

  assert.equal(identity.id, "identity");
  assert.match(prompt, /Constructora Norte/);
  assert.match(prompt, /Torre Norte/);
  assert.match(prompt, /Scope actual: project/);
});
