import test from "node:test";
import assert from "node:assert/strict";
import { parseScheduleCsv, tokenizeCsv } from "../src/lib/schedule/csv-importer.ts";

test("schedule csv-importer", async (t) => {
  await t.test("tokeniza comillas dobles, comas embebidas y newlines", () => {
    const text = `code,name,description
"A-1","Estructura, planta baja","Línea 1
línea 2 con ""comillas"""
A-2,Estructura PB,sin comillas`;
    const records = tokenizeCsv(text);
    assert.equal(records.length, 3);
    assert.deepEqual(records[0], ["code", "name", "description"]);
    assert.deepEqual(records[1], ["A-1", "Estructura, planta baja", `Línea 1\nlínea 2 con "comillas"`]);
    assert.deepEqual(records[2], ["A-2", "Estructura PB", "sin comillas"]);
  });

  await t.test("parsea filas mínimas con header en español", () => {
    const text = `nombre,estado,fecha_inicio,fecha_fin,avance
"Replanteo y excavación","En curso","2026-04-01","15/06/2026","45%"
"Hormigonado","No iniciada",,,0
`;
    const result = parseScheduleCsv(text);
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows.length, 2);
    const [a, b] = result.rows;
    assert.equal(a.name, "Replanteo y excavación");
    assert.equal(a.status, "in_progress");
    assert.equal(a.start_date, "2026-04-01");
    assert.equal(a.due_date, "2026-06-15");
    assert.equal(a.progress_pct, 45);
    assert.equal(b.status, "not_started");
    assert.equal(b.progress_pct, 0);
  });

  await t.test("falla si falta columna 'name'", () => {
    const text = "code,start_date,due_date\nA-1,2026-01-01,2026-02-01";
    const result = parseScheduleCsv(text);
    assert.equal(result.rows.length, 0);
    assert.ok(result.errors[0]?.includes("name"));
  });

  await t.test("fuerza progreso 100% cuando status es done", () => {
    const text = "name,status,progress_pct\nEntrega final,done,50";
    const result = parseScheduleCsv(text);
    assert.equal(result.rows[0]?.progress_pct, 100);
  });

  await t.test("detecta códigos duplicados y emite warning", () => {
    const text = `task_code,name
EST-01,Tarea A
EST-01,Tarea B
EST-02,Tarea C`;
    const result = parseScheduleCsv(text);
    assert.equal(result.rows.length, 3);
    assert.ok(result.warnings.some((w) => w.includes("EST-01") && w.includes("duplicado")));
  });

  await t.test("avisa formato de fecha inválido sin abortar", () => {
    const text = "name,due_date\nTarea X,no-es-fecha";
    const result = parseScheduleCsv(text);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0]?.due_date, null);
    assert.ok(result.warnings.some((w) => w.includes("YYYY-MM-DD")));
  });
});
