import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeActiveMemoryValue,
  normalizeActiveMemoryEvidence,
  normalizeActiveMemoryKey,
} from "../../src/lib/ai/active-memory.ts";

test("normalizeActiveMemoryKey genera claves estables", () => {
  assert.equal(
    normalizeActiveMemoryKey(" Proveedor Hormigon / Preferido "),
    "proveedor_hormigon_preferido",
  );
  assert.equal(
    normalizeActiveMemoryKey("Presupuestos.Criterio-Redondeo"),
    "presupuestos.criterio-redondeo",
  );
});

test("normalizeActiveMemoryEvidence deduplica, recorta y elimina vacios", () => {
  const evidence = normalizeActiveMemoryEvidence([
    "  usuario confirmo usar Hormigonera Norte  ",
    "usuario   confirmo   usar Hormigonera Norte",
    "",
    "segunda evidencia",
  ]);

  assert.deepEqual(evidence, [
    "usuario confirmo usar Hormigonera Norte",
    "segunda evidencia",
  ]);
});

test("mergeActiveMemoryValue conserva evidencia previa y actualiza summary", () => {
  const merged = mergeActiveMemoryValue({
    key: "proveedores.hormigon.preferido",
    summary: "Proveedor preferido para hormigon H21: Hormigonera Norte.",
    evidence: ["El usuario dijo: guardalo para futuras auditorias."],
    tags: ["Proveedor", "Hormigon"],
    existingValue: {
      key: "proveedores.hormigon.preferido",
      summary: "Proveedor anterior.",
      evidence: ["Evidencia vieja"],
      tags: ["obra"],
      source: {
        actorUserId: "user-old",
        projectId: "project-old",
        workCaseId: null,
      },
      updatedBy: "agent_confirmed",
      updatedAt: "2026-05-18T00:00:00.000Z",
    },
    actorUserId: "user-new",
    projectId: "project-new",
    workCaseId: "case-new",
    nowIso: "2026-05-19T17:10:00.000Z",
  });

  assert.equal(merged.summary, "Proveedor preferido para hormigon H21: Hormigonera Norte.");
  assert.deepEqual(merged.evidence, [
    "El usuario dijo: guardalo para futuras auditorias.",
    "Evidencia vieja",
  ]);
  assert.deepEqual(merged.tags, ["proveedor", "hormigon", "obra"]);
  assert.deepEqual(merged.source, {
    actorUserId: "user-new",
    projectId: "project-new",
    workCaseId: "case-new",
  });
});
