import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createBoundTools } from "@/lib/ai/agent";
import { requireGatewaySecret } from "@/lib/api/gateway-auth";

export const runtime = "nodejs";

/**
 * GET /api/internal/tools/manifest — catálogo de tools para el agente Python.
 * Devuelve nombre, descripción y JSON Schema de input de cada tool bound.
 * Los schemas son estáticos por scope, así que se construyen con ids dummy.
 */
export async function GET(req: Request) {
  const denied = requireGatewaySecret(req);
  if (denied) return denied;

  const tools = createBoundTools("00000000-0000-0000-0000-000000000000", null);
  const manifest = Object.entries(tools).map(([name, t]) => {
    const def = t as { description?: string; inputSchema?: z.ZodTypeAny };
    return {
      name,
      description: def.description ?? "",
      // jsonSchema7: exclusiveMinimum numérico (DeepSeek rechaza el estilo openApi3
      // `exclusiveMinimum: true`); refs inline porque los providers no resuelven $ref.
      inputSchema: def.inputSchema
        ? zodToJsonSchema(def.inputSchema, { target: "jsonSchema7", $refStrategy: "none" })
        : { type: "object" },
    };
  });

  return Response.json({ tools: manifest, count: manifest.length });
}
