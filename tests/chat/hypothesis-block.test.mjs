import test from "node:test";
import assert from "node:assert/strict";
import { extractHypothesis } from "../../src/lib/ai/output/hypothesis-parser.ts";

test("extractHypothesis", async (t) => {
  await t.test("extrae bloque completo con chosen y rationale", () => {
    const text =
      `Voy a evaluar.\n\n<hypothesis>{"branches":[{"name":"Error aritmético","confidence":0.7,"evidence":"diferencia exacta es 9000"},{"name":"Ítem omitido","confidence":0.3,"evidence":"no hay rubro de instalaciones eléctricas"}],"chosen":"Error aritmético","rationale":"el monto coincide con un error de suma"}</hypothesis>\n\nDescarto la segunda rama.`;
    const result = extractHypothesis(text);
    assert.ok(result.hypothesis, "debe devolver spec");
    assert.equal(result.hypothesis.branches.length, 2);
    assert.equal(result.hypothesis.chosen, "Error aritmético");
    assert.equal(result.hypothesis.rationale, "el monto coincide con un error de suma");
    assert.equal(result.pending, false);
    assert.ok(result.cleanText.startsWith("Voy a evaluar"));
    assert.ok(!result.cleanText.includes("<hypothesis>"));
  });

  await t.test("detecta pending mientras la etiqueta de cierre no llegó", () => {
    const partial = `Texto previo.\n<hypothesis>{"branches":[{"name":"opc A","confidence":0.5`;
    const result = extractHypothesis(partial);
    assert.equal(result.hypothesis, null);
    assert.equal(result.pending, true);
    assert.equal(result.cleanText, "Texto previo.");
  });

  await t.test("devuelve texto intacto cuando no hay bloque", () => {
    const text = "Sin hipótesis acá.";
    const result = extractHypothesis(text);
    assert.equal(result.hypothesis, null);
    assert.equal(result.pending, false);
    assert.equal(result.cleanText, text);
  });

  await t.test("rechaza JSON malformado y trata como texto plano", () => {
    const text = `pre <hypothesis>{branches: not-json}</hypothesis> post`;
    const result = extractHypothesis(text);
    assert.equal(result.hypothesis, null);
    assert.equal(result.pending, false);
  });

  await t.test("rechaza spec sin branches válidas", () => {
    const text = `<hypothesis>{"branches":[]}</hypothesis>`;
    const result = extractHypothesis(text);
    assert.equal(result.hypothesis, null);
  });

  await t.test("rechaza spec con branches sin campos requeridos", () => {
    const text = `<hypothesis>{"branches":[{"name":"sin evidencia","confidence":0.5}]}</hypothesis>`;
    const result = extractHypothesis(text);
    assert.equal(result.hypothesis, null);
  });

  await t.test("omitir chosen y rationale es válido (modo pedir clarificación)", () => {
    const text = `<hypothesis>{"branches":[{"name":"A","confidence":0.5,"evidence":"e1"},{"name":"B","confidence":0.5,"evidence":"e2"}]}</hypothesis>`;
    const result = extractHypothesis(text);
    assert.ok(result.hypothesis);
    assert.equal(result.hypothesis.branches.length, 2);
    assert.equal(result.hypothesis.chosen, undefined);
  });
});
