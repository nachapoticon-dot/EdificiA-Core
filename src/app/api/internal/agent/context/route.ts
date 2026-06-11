import { z } from "zod";
import { resolveAgentRuntimeContext } from "@/lib/agent-core/runtime";
import { requireGatewaySecret } from "@/lib/api/gateway-auth";
import type { AuthResult } from "@/lib/auth/require-auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  projectName: z.string().optional(),
  projectId: z.string().uuid().optional(),
  chatSessionId: z.string().optional(),
});

/**
 * POST /api/internal/agent/context — contexto de runtime para el agente Python.
 * Reusa resolveAgentRuntimeContext (prompt efectivo, scope validado, capabilities)
 * para que el cerebro Python opere con exactamente el mismo contexto que el TS.
 * Las tools no se serializan acá: viven detrás de /api/internal/tools/*.
 */
export async function POST(req: Request) {
  const denied = requireGatewaySecret(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Body inválido" }, { status: 400 });
  }

  const { orgId, userId, projectName, projectId, chatSessionId } = parsed.data;
  const auth: AuthResult = { orgId, userId, role: "engineer", email: null };
  const ctx = await resolveAgentRuntimeContext(auth, projectName, projectId, chatSessionId);

  return Response.json({
    systemPrompt: ctx.systemPrompt,
    auditProjectId: ctx.auditProjectId ?? null,
    agentScope: ctx.agentScope,
    capabilityIds: ctx.capabilityIds,
  });
}
