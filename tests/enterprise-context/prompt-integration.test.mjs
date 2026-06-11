import test from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "../../src/lib/ai/agent-prompt.ts";
import { extractSummary } from "../../src/lib/enterprise-context/profile-reader.ts";

test("buildSystemPrompt renderiza sección de perfil empresarial cuando hay snapshot", () => {
  const prompt = buildSystemPrompt({
    companyName: "Constructora Andes",
    organizationId: "org-123",
    enterpriseProfile: {
      hasSnapshot: true,
      snapshotVersion: 3,
      builtAt: "2026-05-19T05:00:00Z",
      summaryText: "5 obras · subcontratistas: Electro, Pintura · moneda ARS",
      topSuppliers: ["Loma Negra", "Acindar", "Plavicon"],
      topSubcontractors: ["Electro SRL", "Pinturería Norte"],
      topTrades: ["electricidad", "pintura"],
      dominantCurrency: "ARS",
      namingHints: ["Torre", "Edificio"],
      riskyProjects: [
        { projectName: "Torre Norte", riskLevel: "alto", findingsOpen: 3 },
      ],
    },
  });

  assert.ok(prompt.includes("Perfil de empresa (snapshot 3)"));
  assert.ok(prompt.includes("Moneda dominante: ARS"));
  assert.ok(prompt.includes("Loma Negra"));
  assert.ok(prompt.includes("Electro SRL"));
  assert.ok(prompt.includes("electricidad"));
  assert.ok(prompt.includes("Torre Norte"));
  assert.ok(prompt.includes("consultar_perfil_empresa"));
});

test("buildSystemPrompt omite sección de perfil cuando no hay snapshot", () => {
  const prompt = buildSystemPrompt({
    companyName: "Constructora Andes",
    organizationId: "org-123",
    enterpriseProfile: {
      hasSnapshot: false,
      snapshotVersion: null,
      builtAt: null,
      summaryText: null,
      topSuppliers: [],
      topSubcontractors: [],
      topTrades: [],
      dominantCurrency: null,
      namingHints: [],
      riskyProjects: [],
    },
  });

  assert.equal(prompt.includes("Perfil de empresa"), false);
  // La referencia de drill-down del perfil no debe estar; la mención de la tool
  // en el playbook operativo (apertura sin obra activa) es legítima.
  assert.equal(prompt.includes("Para drill-down"), false);
});

test("buildSystemPrompt funciona sin perfil empresarial (backward-compatible)", () => {
  const prompt = buildSystemPrompt({
    companyName: "Constructora Andes",
    organizationId: "org-123",
  });
  assert.equal(prompt.includes("Perfil de empresa"), false);
  assert.ok(prompt.includes("Constructora Andes"));
});

test("extractSummary parsea payload válido", () => {
  const summary = extractSummary({
    summary: {
      projectsCount: 4,
      dominantCurrency: "ARS",
      riskyProjects: 1,
      namingHints: ["Torre", "Edificio"],
      topSuppliers: ["Loma Negra"],
      topSubcontractors: ["Electro SRL"],
      topTrades: ["pintura"],
    },
  });

  assert.equal(summary.projectsCount, 4);
  assert.equal(summary.dominantCurrency, "ARS");
  assert.deepEqual(summary.namingHints, ["Torre", "Edificio"]);
  assert.deepEqual(summary.topSuppliers, ["Loma Negra"]);
});

test("extractSummary tolera payload null o malformado sin tirar", () => {
  assert.equal(extractSummary(null).projectsCount, 0);
  assert.equal(extractSummary({}).projectsCount, 0);
  assert.equal(extractSummary({ summary: "no es objeto" }).projectsCount, 0);
  // arrays con elementos no-string deben filtrarse
  const partial = extractSummary({
    summary: {
      topSuppliers: ["A", 123, null, "B"],
      projectsCount: "no es number",
    },
  });
  assert.deepEqual(partial.topSuppliers, ["A", "B"]);
  assert.equal(partial.projectsCount, 0);
});
