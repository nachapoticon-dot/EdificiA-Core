import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateEnterpriseProfile,
  computeCoverage,
  detectNamingPrefixes,
} from "../../src/lib/enterprise-context/profile-aggregator.ts";

const baseInputs = () => ({
  projects: [],
  subcontracts: [],
  supplies: [],
  hse: [],
  schedule: [],
  financials: [],
  documents: [],
  reports: [],
  findings: [],
});

test("detecta proveedores y subcontratistas frecuentes con conteo", () => {
  const inputs = baseInputs();
  inputs.projects = [
    { id: "p1", name: "Torre Norte", status: "en_obra", location: "CABA", updatedAt: "2026-05-01T00:00:00Z" },
  ];
  inputs.supplies = [
    { projectId: "p1", itemName: "Cemento", category: "Sanitarios", supplierName: "Loma Negra", currency: "ARS", status: "received", updatedAt: "2026-05-01T00:00:00Z" },
    { projectId: "p1", itemName: "Cemento", category: "Sanitarios", supplierName: "loma negra", currency: "ARS", status: "ordered", updatedAt: "2026-05-02T00:00:00Z" },
    { projectId: "p1", itemName: "Hierro", category: "Estructura", supplierName: "Acindar", currency: "ARS", status: "planned", updatedAt: "2026-05-03T00:00:00Z" },
  ];
  inputs.subcontracts = [
    { projectId: "p1", vendorName: "Electro SRL", trade: "electricidad", contractAmount: 100, currency: "ARS", status: "active", updatedAt: "2026-05-01T00:00:00Z" },
    { projectId: "p1", vendorName: "Electro S.R.L.", trade: "electricidad", contractAmount: 50, currency: "ARS", status: "active", updatedAt: "2026-05-04T00:00:00Z" },
  ];

  const result = aggregateEnterpriseProfile(inputs);

  const suppliers = result.entities.filter((e) => e.entityType === "supplier");
  const lomaNegra = suppliers.find((e) => e.canonicalName === "loma negra");
  assert.ok(lomaNegra, "loma negra debe aparecer canonicalizada");
  assert.equal(lomaNegra.occurrenceCount, 2);

  const subs = result.entities.filter((e) => e.entityType === "subcontractor");
  const electro = subs.find((e) => e.canonicalName.startsWith("electro"));
  assert.ok(electro);
  assert.equal(electro.occurrenceCount, 2);
  assert.ok(electro.aliases.length >= 1, "debe registrar al menos un alias distinto del canonical");

  const trades = result.entities.filter((e) => e.entityType === "trade");
  const electricidad = trades.find((e) => e.canonicalName === "electricidad");
  assert.ok(electricidad);
  assert.equal(electricidad.occurrenceCount, 2);
});

test("detecta naming convention cuando un prefijo aparece en >=40% de las obras", () => {
  const prefixes = detectNamingPrefixes([
    "Torre Norte",
    "Torre Sur",
    "Torre Este",
    "Edificio Centenario",
    "Casa Quinta",
  ]);

  const torre = prefixes.find((p) => p.token === "torre");
  assert.ok(torre, "debe detectar prefijo torre");
  assert.equal(torre.count, 3);
  assert.equal(Math.round(torre.share * 100), 60);
});

test("ignora prefijos que aparecen pocas veces o son stopwords", () => {
  const prefixes = detectNamingPrefixes([
    "Obra El Roble",
    "Obra La Encina",
    "Obra El Quebracho",
  ]);
  // "obra" es stopword, "el" / "la" tampoco se cuentan como tokens válidos por longitud
  assert.equal(prefixes.length, 0);
});

test("genera patron de moneda dominante", () => {
  const inputs = baseInputs();
  inputs.subcontracts = [
    { projectId: "p1", vendorName: "v1", trade: null, contractAmount: 1, currency: "ARS", status: "active", updatedAt: null },
    { projectId: "p1", vendorName: "v2", trade: null, contractAmount: 1, currency: "ars", status: "active", updatedAt: null },
  ];
  inputs.supplies = [
    { projectId: "p1", itemName: "x", category: null, supplierName: "z", currency: "USD", status: "received", updatedAt: null },
  ];

  const result = aggregateEnterpriseProfile(inputs);
  const currencyPattern = result.patterns.find((p) => p.patternKind === "currency");
  assert.ok(currencyPattern);
  assert.equal(currencyPattern.patternKey, "ars");
});

test("coverage calcula score y riesgo segun docs, ops y findings", () => {
  const inputs = baseInputs();
  inputs.projects = [
    { id: "p_ok", name: "Obra OK", status: "en_obra", location: null, updatedAt: "2026-05-01T00:00:00Z" },
    { id: "p_risk", name: "Obra Riesgo", status: "en_obra", location: null, updatedAt: "2026-05-01T00:00:00Z" },
    { id: "p_empty", name: "Obra Sin Datos", status: "planificacion", location: null, updatedAt: "2026-05-01T00:00:00Z" },
  ];
  inputs.documents = [
    { projectId: "p_ok", documentType: "presupuesto", readinessStatus: "indexada", sensitivity: "internal", sourceType: "manual_upload", updatedAt: "2026-05-01T00:00:00Z" },
    { projectId: "p_ok", documentType: "plano", readinessStatus: "indexada", sensitivity: "internal", sourceType: "manual_upload", updatedAt: "2026-05-01T00:00:00Z" },
    { projectId: "p_ok", documentType: "contrato", readinessStatus: "indexada", sensitivity: "internal", sourceType: "manual_upload", updatedAt: "2026-05-01T00:00:00Z" },
    { projectId: "p_risk", documentType: "presupuesto", readinessStatus: "observada", sensitivity: "internal", sourceType: "manual_upload", updatedAt: "2026-05-01T00:00:00Z" },
    { projectId: "p_risk", documentType: "plano", readinessStatus: "observada", sensitivity: "internal", sourceType: "manual_upload", updatedAt: "2026-05-01T00:00:00Z" },
  ];
  inputs.subcontracts = [
    { projectId: "p_ok", vendorName: "v", trade: null, contractAmount: 1, currency: "ARS", status: "active", updatedAt: null },
  ];
  inputs.findings = [
    { projectId: "p_risk", severity: "warning", status: "open" },
    { projectId: "p_risk", severity: "critical", status: "open" },
    { projectId: "p_risk", severity: "info", status: "open" },
  ];

  const coverage = computeCoverage(inputs);
  const ok = coverage.find((c) => c.projectId === "p_ok");
  const risk = coverage.find((c) => c.projectId === "p_risk");
  const empty = coverage.find((c) => c.projectId === "p_empty");

  assert.ok(ok && ok.coverageScore >= 0.5, "obra con docs y ops debe tener score sano");
  assert.equal(ok.riskLevel, "bajo");

  assert.ok(risk);
  assert.equal(risk.findingsOpen, 3);
  assert.ok(risk.riskLevel === "alto" || risk.riskLevel === "critico", "obra con observados y findings escala riesgo");

  assert.ok(empty);
  assert.equal(empty.documentsTotal, 0);
  assert.equal(empty.riskLevel, "medio", "obra sin docs no es bajo riesgo");
});

test("summary describe proyectos, monedas, subcontratistas y obras riesgosas", () => {
  const inputs = baseInputs();
  inputs.projects = [
    { id: "p1", name: "Torre Norte", status: "en_obra", location: null, updatedAt: null },
    { id: "p2", name: "Torre Sur", status: "en_obra", location: null, updatedAt: null },
  ];
  inputs.subcontracts = [
    { projectId: "p1", vendorName: "Acme", trade: "pintura", contractAmount: 1, currency: "ARS", status: "active", updatedAt: null },
    { projectId: "p2", vendorName: "Acme", trade: "pintura", contractAmount: 1, currency: "ARS", status: "active", updatedAt: null },
  ];
  inputs.findings = [
    { projectId: "p1", severity: "critical", status: "open" },
    { projectId: "p1", severity: "critical", status: "open" },
  ];

  const result = aggregateEnterpriseProfile(inputs);
  assert.equal(result.summary.projectsCount, 2);
  assert.equal(result.summary.dominantCurrency, "ARS");
  assert.ok(result.summary.topSubcontractors.includes("Acme"));
  assert.ok(result.summary.text.includes("Torre"));
});
