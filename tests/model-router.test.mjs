import test from "node:test";
import assert from "node:assert/strict";
import { routeModel } from "../src/lib/ai/model-router.ts";

function msg(text) {
  return { id: "u1", role: "user", parts: [{ type: "text", text }] };
}

test("model router", async (t) => {
  await t.test("routea a fast cuando no hay señales", () => {
    const r = routeModel([msg("Hola, ¿cómo va?")]);
    assert.equal(r.tier, "fast");
    assert.match(r.reason, /baseline/);
  });

  await t.test("routea a deep ante comparativa A vs B", () => {
    const r = routeModel([msg("Auditá la comparativa A vs B entre estos dos presupuestos")]);
    assert.equal(r.tier, "deep");
    assert.ok(r.signals.hasAvsBCompare);
  });

  await t.test("routea a deep si el usuario menciona contradicciones y cross-doc", () => {
    const r = routeModel([msg("Quiero detectar contradicciones cruzando varios documentos de la obra")]);
    assert.equal(r.tier, "deep");
    assert.ok(r.signals.hasContradictionIntent);
    assert.ok(r.signals.hasCrossDocIntent);
  });

  await t.test("archivo adjunto + turno largo no alcanzan solos para deep", () => {
    const longText = "a".repeat(9000);
    const r = routeModel([msg(`__file_meta__:{"fileName":"x.xlsx"}\n${longText}`)]);
    // file (1) + long (1) = 2 → fast (umbral 3)
    assert.equal(r.tier, "fast");
    assert.ok(r.signals.hasFileAttachment);
    assert.ok(r.signals.longTurn);
  });

  await t.test("hint explícito de profundidad fuerza deep junto con archivo", () => {
    const r = routeModel([msg("__file_meta__:{} auditá esto a fondo y razonamiento profundo")]);
    assert.equal(r.tier, "deep");
    assert.ok(r.signals.deepHinted);
  });
});
