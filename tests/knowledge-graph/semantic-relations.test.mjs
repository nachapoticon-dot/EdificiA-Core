import test from "node:test";
import assert from "node:assert/strict";
import { detectSemanticRelationCandidates } from "../../src/lib/knowledge-graph/relations.ts";

test("detecta supersedes por version numerica en filename", () => {
  const relations = detectSemanticRelationCandidates({
    currentFileId: "new-file",
    currentFileName: "Presupuesto Torre Norte V2.xlsx",
    currentText: "",
    targets: [{
      fileId: "old-file",
      fileName: "Presupuesto Torre Norte V1.xlsx",
      chunks: [],
    }],
  });

  assert.equal(relations.length, 1);
  assert.equal(relations[0].relationType, "supersedes");
  assert.equal(relations[0].sourceFileId, "new-file");
  assert.equal(relations[0].targetFileId, "old-file");
  assert.equal(relations[0].confidence, 0.9);
});

test("orienta supersedes desde la version mas alta aunque se suba una version vieja", () => {
  const relations = detectSemanticRelationCandidates({
    currentFileId: "old-file",
    currentFileName: "Planos estructura V1.pdf",
    currentText: "",
    targets: [{
      fileId: "new-file",
      fileName: "Planos estructura V3.pdf",
      chunks: [],
    }],
  });

  assert.equal(relations.length, 1);
  assert.equal(relations[0].relationType, "supersedes");
  assert.equal(relations[0].sourceFileId, "new-file");
  assert.equal(relations[0].targetFileId, "old-file");
  assert.equal(relations[0].confidence, 0.78);
});

test("detecta derives_from cuando el documento cita codigos de tareas previas", () => {
  const relations = detectSemanticRelationCandidates({
    currentFileId: "current",
    currentFileName: "Certificado avance mayo.pdf",
    currentText: "Se certifican avances de las tareas SC-120 y SC-121 segun presupuesto base.",
    targets: [{
      fileId: "budget",
      fileName: "Presupuesto base.xlsx",
      chunks: ["SC-120 | Hormigon H21 | 10 m3 | PU: 1 | total: 10\nSC-121 | Encofrado | 5 m2 | PU: 2 | total: 10"],
    }],
  });

  const relation = relations.find((r) => r.relationType === "derives_from");
  assert.ok(relation);
  assert.equal(relation.sourceFileId, "current");
  assert.equal(relation.targetFileId, "budget");
  assert.deepEqual(relation.evidence.matchedTaskCodes, ["sc-120", "sc-121"]);
});

test("evita falsos positivos por codigos numericos demasiado cortos", () => {
  const relations = detectSemanticRelationCandidates({
    currentFileId: "current",
    currentFileName: "Acta obra.pdf",
    currentText: "El punto 1 fue revisado.",
    targets: [{
      fileId: "budget",
      fileName: "Presupuesto base.xlsx",
      chunks: ["1 | General | 1 gl | PU: 1 | total: 1"],
    }],
  });

  assert.equal(relations.length, 0);
});
