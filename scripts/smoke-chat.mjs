#!/usr/bin/env node
/**
 * Smoke test E2E del agente — corre 3 turnos contra DeepSeek real validando
 * el ciclo reasoning_content que rompió en prod (ver AI_WORKLOG entrada del
 * 2026-05-18 "Hardening de boundaries").
 *
 * Run con DEEPSEEK_API_KEY ya en env, o como:
 *   node --env-file=.env.local scripts/smoke-chat.mjs
 *
 * Exit code 0 si los 3 turnos cierran sin error. Exit 1 con detalle si:
 *   - HTTP 4xx/5xx del provider
 *   - respuesta sin `content`
 *   - error específico de reasoning_content (regresión del bug original)
 *   - shape inesperado de respuesta
 */

const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.AI_MODEL ?? "deepseek-v4-flash";
const TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT = "Sos un asistente breve. Respondé en una frase corta.";
const TURNS = [
  "Dame un saludo cordial en castellano.",
  "Ahora un sinónimo más informal del saludo que acabás de proponer.",
  "Y ahora la versión más formal posible.",
];

function fail(stage, detail) {
  console.error(`\n✗ ${stage}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function ok(stage, detail = "") {
  console.log(`✓ ${stage}${detail ? ` — ${detail}` : ""}`);
}

async function callDeepSeek(messages) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) fail("setup", "DEEPSEEK_API_KEY no está seteada (probá: node --env-file=.env.local scripts/smoke-chat.mjs)");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    fail("network", `Fetch falló: ${err?.message ?? err}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { fail("parse", `Respuesta no JSON (status ${res.status}):\n${text.slice(0, 500)}`); }

  if (!res.ok) {
    const errMsg = body?.error?.message ?? body?.message ?? text;
    if (typeof errMsg === "string" && errMsg.toLowerCase().includes("reasoning_content")) {
      fail(
        "regression",
        `🚨 Regresión del bug 2026-05-18: DeepSeek rechazó la request porque falta reasoning_content.\nMensaje: ${errMsg}`,
      );
    }
    fail("http", `Status ${res.status}: ${errMsg}`);
  }

  const choice = body?.choices?.[0]?.message;
  if (!choice || typeof choice.content !== "string" || choice.content.length === 0) {
    fail("shape", `Respuesta sin choices[0].message.content. Body recibido: ${JSON.stringify(body).slice(0, 500)}`);
  }

  return {
    content: choice.content,
    reasoning_content: choice.reasoning_content ?? null,
  };
}

async function main() {
  console.log(`Smoke test chat E2E — modelo: ${MODEL}\n`);
  const history = [];

  for (let i = 0; i < TURNS.length; i++) {
    const userMsg = TURNS[i];
    console.log(`→ Turno ${i + 1}: ${userMsg.slice(0, 60)}...`);

    history.push({ role: "user", content: userMsg });
    const reply = await callDeepSeek(history);

    const previewContent = reply.content.slice(0, 80).replace(/\s+/g, " ");
    const hadReasoning = reply.reasoning_content != null && reply.reasoning_content.length > 0;
    ok(`turno ${i + 1}`, `content "${previewContent}..."${hadReasoning ? ` · reasoning: ${reply.reasoning_content.length} chars` : ""}`);

    // Reinyectar reasoning_content en el historial — esto es exactamente lo que
    // @ai-sdk/openai-compatible hace internamente. Si DeepSeek se queja en el
    // próximo turno, es porque el provider no lo está mandando.
    const assistantMsg = { role: "assistant", content: reply.content };
    if (hadReasoning) assistantMsg.reasoning_content = reply.reasoning_content;
    history.push(assistantMsg);
  }

  console.log(`\n✓ Smoke OK — ${TURNS.length} turnos completados sin errores.`);
}

main().catch((err) => {
  fail("uncaught", err?.stack ?? String(err));
});
