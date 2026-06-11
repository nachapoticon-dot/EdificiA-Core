import { timingSafeEqual } from "node:crypto";

/**
 * Auth de las rutas internas /api/internal/* (tool gateway del agente Python).
 * Shared secret por header x-agent-secret; nunca exponer estas rutas sin él.
 */
export function requireGatewaySecret(req: Request): Response | null {
  const expected = process.env.AGENT_GATEWAY_SECRET;
  if (!expected) {
    return Response.json({ error: "AGENT_GATEWAY_SECRET no configurado." }, { status: 503 });
  }
  const provided = req.headers.get("x-agent-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
