import test from "node:test";
import assert from "node:assert/strict";
import { summarizeToolUsage, toTelemetryRows } from "../../src/lib/ai/observability/tool-telemetry.ts";

test("summarizeToolUsage", async (t) => {
  await t.test("devuelve objeto vacío si no hay steps", () => {
    assert.deepEqual(summarizeToolUsage([]), {});
    assert.deepEqual(summarizeToolUsage(undefined), {});
    assert.deepEqual(summarizeToolUsage(null), {});
  });

  await t.test("cuenta calls por tool", () => {
    const steps = [
      {
        toolCalls: [
          { toolName: "calcular_totales", toolCallId: "a1" },
          { toolName: "validar_cierre_de_total", toolCallId: "a2" },
        ],
        toolResults: [
          { toolName: "calcular_totales", toolCallId: "a1", result: { ok: true, total: 100 } },
          { toolName: "validar_cierre_de_total", toolCallId: "a2", result: { ok: true } },
        ],
      },
    ];
    const stats = summarizeToolUsage(steps);
    assert.equal(stats.calcular_totales.calls, 1);
    assert.equal(stats.calcular_totales.errors, 0);
    assert.equal(stats.validar_cierre_de_total.calls, 1);
  });

  await t.test("detecta errores por ok:false y error:true", () => {
    const steps = [
      {
        toolCalls: [
          { toolName: "registrar_acopio", toolCallId: "r1" },
          { toolName: "enviar_email_stakeholder", toolCallId: "r2" },
        ],
        toolResults: [
          { toolName: "registrar_acopio", toolCallId: "r1", result: { ok: false, reason: "missing_data" } },
          { toolName: "enviar_email_stakeholder", toolCallId: "r2", result: { error: true, message: "bad email" } },
        ],
      },
    ];
    const stats = summarizeToolUsage(steps);
    assert.equal(stats.registrar_acopio.errors, 1);
    assert.equal(stats.enviar_email_stakeholder.errors, 1);
  });

  await t.test("detecta retries cuando la misma tool se llama más de una vez con errores previos", () => {
    const steps = [
      {
        toolCalls: [{ toolName: "registrar_subcontrato", toolCallId: "s1" }],
        toolResults: [
          { toolName: "registrar_subcontrato", toolCallId: "s1", result: { ok: false, reason: "invalid_date" } },
        ],
      },
      {
        toolCalls: [{ toolName: "registrar_subcontrato", toolCallId: "s2" }],
        toolResults: [{ toolName: "registrar_subcontrato", toolCallId: "s2", result: { ok: true, subcontractId: "uuid" } }],
      },
    ];
    const stats = summarizeToolUsage(steps);
    assert.equal(stats.registrar_subcontrato.calls, 2);
    assert.equal(stats.registrar_subcontrato.errors, 1);
    assert.equal(stats.registrar_subcontrato.retries, 1);
  });

  await t.test("no marca retries si no hubo errores aunque se llame varias veces", () => {
    const steps = [
      {
        toolCalls: [
          { toolName: "calcular_totales", toolCallId: "c1" },
          { toolName: "calcular_totales", toolCallId: "c2" },
        ],
        toolResults: [
          { toolName: "calcular_totales", toolCallId: "c1", result: { ok: true } },
          { toolName: "calcular_totales", toolCallId: "c2", result: { ok: true } },
        ],
      },
    ];
    const stats = summarizeToolUsage(steps);
    assert.equal(stats.calcular_totales.calls, 2);
    assert.equal(stats.calcular_totales.errors, 0);
    assert.equal(stats.calcular_totales.retries, 0);
  });

  await t.test("toTelemetryRows ordena por calls desc", () => {
    const stats = {
      tool_a: { calls: 1, errors: 0, retries: 0 },
      tool_b: { calls: 5, errors: 1, retries: 1 },
      tool_c: { calls: 3, errors: 0, retries: 0 },
    };
    const rows = toTelemetryRows(stats);
    assert.deepEqual(
      rows.map((r) => r.tool),
      ["tool_b", "tool_c", "tool_a"],
    );
  });
});
