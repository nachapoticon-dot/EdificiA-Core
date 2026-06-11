#!/usr/bin/env node
/**
 * Evals de conducta del agente — corre conversaciones doradas contra /api/chat
 * y verifica QUÉ hizo el agente (tools llamadas, texto), no solo que respondió.
 *
 * Uso:
 *   node --env-file=.env.local evals/run.mjs                 # backend según el server levantado (default ts)
 *   node --env-file=.env.local evals/run.mjs --backend python
 *   node --env-file=.env.local evals/run.mjs --only apertura-saludo-obra,hse-ingreso
 *
 * Requiere: Postgres + `npm run dev` levantados (y uvicorn si --backend python).
 * Credenciales: EVAL_EMAIL / EVAL_PASSWORD (env) o las del usuario dev local.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const APP_URL = process.env.EVAL_APP_URL ?? "http://localhost:3000";
const EMAIL = process.env.EVAL_EMAIL ?? "pedroluisfuentesprieto@gmail.com";
const PASSWORD = process.env.EVAL_PASSWORD ?? "EdificiaDev2026!";
const PROJECT_NAME = "Obra Eval";

const args = process.argv.slice(2);
const backend = args.includes("--backend") ? args[args.indexOf("--backend") + 1] : "ts";
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;

const { cases } = JSON.parse(await readFile(path.join(import.meta.dirname, "cases.json"), "utf8"));

// ── Auth + obra de eval ──────────────────────────────────────────────────────
const loginRes = await fetch(`${APP_URL}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!loginRes.ok) {
  console.error(`Login falló (${loginRes.status}). ¿Está levantado el server y existe el usuario?`);
  process.exit(1);
}
const { accessToken } = await loginRes.json();
const authHeaders = { Authorization: `Bearer ${accessToken}` };

async function ensureProject() {
  const res = await fetch(`${APP_URL}/api/projects`, { headers: authHeaders });
  const body = await res.json();
  const existing = (body.projects ?? body ?? []).find?.((p) => p.name === PROJECT_NAME);
  if (existing) return existing.id;
  const created = await fetch(`${APP_URL}/api/projects`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ name: PROJECT_NAME }),
  });
  const createdBody = await created.json();
  return createdBody.project?.id ?? createdBody.id;
}
const projectId = await ensureProject();
console.log(`Backend: ${backend} · Obra eval: ${projectId}\n`);

// ── Ejecutar un turno y recolectar conducta ──────────────────────────────────
async function runTurn(userText, withProject) {
  const headers = { ...authHeaders, "Content-Type": "application/json" };
  if (withProject) {
    headers["x-project-id"] = projectId;
    headers["x-project-name"] = PROJECT_NAME;
  }
  const res = await fetch(`${APP_URL}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: `eval-${Date.now()}`,
      messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: userText }] }],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok || !res.body) return { error: `HTTP ${res.status}`, tools: [], text: "" };

  const tools = [];
  let text = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if ((ev.type === "tool-input-available" || ev.type === "tool-input-start") && ev.toolName) {
          if (!tools.includes(ev.toolName)) tools.push(ev.toolName);
        }
        if (ev.type === "text-delta") text += ev.delta ?? "";
      } catch { /* delta partido entre chunks: ignorar */ }
    }
  }
  return { tools, text };
}

// ── Asserts ──────────────────────────────────────────────────────────────────
function evaluate(c, result) {
  const failures = [];
  if (result.error) failures.push(`request: ${result.error}`);
  if (c.expectAnyTool && !c.expectAnyTool.some((t) => result.tools.includes(t))) {
    failures.push(`esperaba alguna de [${c.expectAnyTool}], llamó [${result.tools.join(", ") || "ninguna"}]`);
  }
  if (c.forbidTools) {
    const hit = c.forbidTools.filter((t) => result.tools.includes(t));
    if (hit.length) failures.push(`llamó tools prohibidas: ${hit.join(", ")}`);
  }
  if (c.expectTextRegex && !new RegExp(c.expectTextRegex, "i").test(result.text)) {
    failures.push(`texto no matchea /${c.expectTextRegex}/i`);
  }
  if (c.forbidTextRegex && new RegExp(c.forbidTextRegex, "i").test(result.text)) {
    failures.push(`texto matchea regex prohibida /${c.forbidTextRegex}/i`);
  }
  return failures;
}

// ── Loop principal ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const selected = cases.filter((c) => c.backends.includes(backend) && (!only || only.includes(c.id)));

for (const c of selected) {
  process.stdout.write(`→ ${c.id} ... `);
  const result = await runTurn(c.userText, c.withProject);
  const failures = evaluate(c, result);
  if (failures.length === 0) {
    passed++;
    console.log(`✓ (tools: ${result.tools.join(", ") || "ninguna"})`);
  } else {
    failed++;
    console.log("✗");
    for (const f of failures) console.log(`    - ${f}`);
    console.log(`    texto: "${result.text.slice(0, 160)}..."`);
  }
}

console.log(`\n${passed}/${selected.length} casos OK${failed ? ` · ${failed} FALLARON` : ""}`);
process.exit(failed > 0 ? 1 : 0);
