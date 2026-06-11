import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_MODES,
  TOOL_GROUPS,
  collectTurnSignals,
  detectTurnModes,
  filterToolsByModes,
  toolNamesForModes,
} from "../../src/lib/ai/turn-modes.ts";
import { createBoundTools } from "../../src/lib/ai/agent-tools-bound.ts";

const allToolNames = Object.keys(createBoundTools("00000000-0000-0000-0000-000000000000", null));

test("la unión de TOOL_GROUPS cubre el catálogo completo de tools (ninguna queda invisible)", () => {
  const union = toolNamesForModes(ALL_MODES);
  const missing = allToolNames.filter((name) => !union.has(name));
  assert.deepEqual(missing, [], `tools sin grupo asignado: ${missing.join(", ")}`);
  const stale = [...union].filter((name) => !allToolNames.includes(name));
  assert.deepEqual(stale, [], `grupos referencian tools inexistentes: ${stale.join(", ")}`);
});

test("operations está siempre activo; saludo simple NO activa documents", () => {
  const modes = detectTurnModes({ recentText: "Hola, ¿cómo arranca el día en la obra?", hasFile: false });
  assert.ok(modes.includes("operations"));
  assert.ok(!modes.includes("documents"));
  assert.ok(!modes.includes("generation"));
});

test("archivo adjunto o intención documental activan documents", () => {
  assert.ok(detectTurnModes({ recentText: "x", hasFile: true }).includes("documents"));
  assert.ok(detectTurnModes({ recentText: "auditá este presupuesto", hasFile: false }).includes("documents"));
  assert.ok(detectTurnModes({ recentText: "¿hay contradicciones entre el plano y el contrato?", hasFile: false }).includes("documents"));
});

test("intención de generación y comunicación activan sus modos", () => {
  assert.ok(detectTurnModes({ recentText: "generá la orden de compra", hasFile: false }).includes("generation"));
  assert.ok(detectTurnModes({ recentText: "avisale por email al subcontratista", hasFile: false }).includes("communications"));
});

test("filterToolsByModes: en modo solo-operations no hay tools de auditoría", () => {
  const tools = createBoundTools("00000000-0000-0000-0000-000000000000", null);
  const filtered = filterToolsByModes(tools, ["operations"]);
  assert.ok(!("detectar_exclusiones_logicas" in filtered));
  assert.ok(!("calcular_totales" in filtered));
  assert.ok(!("generar_orden_compra" in filtered));
  assert.ok("resumen_diario_obra" in filtered);
  assert.ok("evaluar_impacto_clima" in filtered);
  assert.ok("buscar_en_base_documental" in filtered);
});

test("collectTurnSignals junta ventana de mensajes y detecta archivo", () => {
  const messages = [
    { role: "user", parts: [{ type: "text", text: "hola" }] },
    { role: "assistant", parts: [{ type: "text", text: "buenas" }] },
    { role: "user", parts: [{ type: "text", text: "te subo el archivo __file_meta__{...}" }] },
  ];
  const signals = collectTurnSignals(messages);
  assert.ok(signals.hasFile);
  assert.ok(signals.recentText.includes("hola"));
});
