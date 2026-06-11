import { z } from "zod";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { dbLogger, getRequestLogger } from "@/lib/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  rating: z.union([z.literal(1), z.literal(-1)]),
  chatSessionId: z.string().optional(),
  messageId: z.string().optional(),
  agentRunId: z.string().uuid().optional(),
  comment: z.string().max(2000).optional(),
  correction: z.string().max(4000).optional(),
});

/**
 * POST /api/feedback — feedback explícito sobre una respuesta del agente.
 * Señal del loop de aprendizaje: el servicio Python convierte el feedback
 * negativo con corrección en memoria durable (agent_memories).
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(rateLimitKey(req, "feedback"), "auth")) {
    return Response.json({ error: "Demasiados envíos. Esperá un minuto." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request inválido." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const log = getRequestLogger(req, dbLogger);
  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("agent_feedback")
    .insert({
      organization_id: auth.orgId,
      user_id: auth.userId,
      rating: parsed.data.rating,
      chat_session_id: parsed.data.chatSessionId ?? null,
      message_id: parsed.data.messageId ?? null,
      agent_run_id: parsed.data.agentRunId ?? null,
      comment: parsed.data.comment ?? null,
      correction: parsed.data.correction ?? null,
    })
    .select("id")
    .single();

  if (result.error || !result.data) {
    log.warn({ err: result.error }, "feedback insert failed");
    return Response.json({ error: "No se pudo registrar el feedback." }, { status: 500 });
  }
  const feedbackId = (result.data as { id: string }).id;

  // Procesamiento async en el servicio del agente (best-effort; si está caído,
  // la fila queda con processed_at NULL y se procesa después).
  const agentUrl = process.env.AGENT_SERVICE_URL;
  const secret = process.env.AGENT_GATEWAY_SECRET;
  if (agentUrl && secret) {
    void fetch(`${agentUrl}/v1/feedback/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agent-secret": secret },
      body: JSON.stringify({ feedbackId }),
    }).catch(() => null);
  }

  return Response.json({ ok: true, feedbackId });
}
