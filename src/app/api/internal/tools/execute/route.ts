import { z } from "zod";
import { createBoundTools } from "@/lib/ai/agent";
import { requireGatewaySecret } from "@/lib/api/gateway-auth";
import { aiLogger, getRequestLogger } from "@/lib/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  toolName: z.string().min(1),
  input: z.record(z.unknown()).default({}),
  context: z.object({
    orgId: z.string().uuid(),
    userId: z.string().uuid(),
    projectId: z.string().uuid().optional(),
    workCaseId: z.string().uuid().optional(),
  }),
});

/**
 * POST /api/internal/tools/execute — ejecuta una tool bound por nombre.
 * Es el "tool gateway": el agente Python razona, las tools TS existentes ejecutan.
 * El org-binding server-side (security A-04) se preserva: organizationId y actor
 * salen del context verificado, nunca del input del modelo.
 */
export async function POST(req: Request) {
  const denied = requireGatewaySecret(req);
  if (denied) return denied;
  const log = getRequestLogger(req, aiLogger);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Body inválido" }, { status: 400 });
  }

  const { toolName, input, context } = parsed.data;
  const tools = createBoundTools(context.orgId, context.userId, {
    projectId: context.projectId,
    workCaseId: context.workCaseId,
  });
  const tool = (tools as Record<string, { execute?: (input: unknown, opts: unknown) => Promise<unknown> }>)[toolName];
  if (!tool?.execute) {
    return Response.json({ ok: false, error: `Tool desconocida: ${toolName}` }, { status: 404 });
  }

  const t0 = Date.now();
  try {
    const output = await tool.execute(input, { toolCallId: `gw_${Date.now()}`, messages: [] });
    log.info({ toolName, orgId: context.orgId, latencyMs: Date.now() - t0 }, "gateway tool executed");
    return Response.json({ ok: true, output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ toolName, orgId: context.orgId, err: message }, "gateway tool failed");
    return Response.json({ ok: false, error: message }, { status: 200 });
  }
}
