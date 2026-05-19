import { requireAuth } from "@/lib/auth/require-auth";
import { fetchKnowledgeGraph } from "@/lib/knowledge-graph/relations";
import { knowledgeGraphResponseSchema } from "@/lib/validators/api-responses";
import { dbLogger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * GET /api/knowledge-graph
 *
 * Devuelve el grafo de archivos + relaciones de la organización autenticada,
 * pensado para alimentar herramientas externas de visualización (react-flow,
 * Cytoscape, Gephi, etc.).
 *
 * Query params:
 *   ?projectId=<uuid>   Acota a una obra específica. Si se omite, devuelve la
 *                       org completa.
 *
 * Response shape (estable):
 *   {
 *     meta: { organizationId, projectId, generatedAt, nodeCount, edgeCount },
 *     nodes: [{ id, label, fileType, projectId, projectName, indexingStatus,
 *               processingStatus, createdAt }],
 *     edges: [{ id, source, target, relationType, confidence, detectedBy,
 *               evidence, metadata, createdAt, updatedAt }]
 *   }
 *
 * Multi-tenant: filtrado server-side por `auth.orgId`. El cliente no puede
 * pedir grafos de otra organización aunque mande un `projectId` ajeno.
 */
export async function GET(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  const projectIdParam = searchParams.get("projectId");
  const projectId = projectIdParam && projectIdParam.length > 0 ? projectIdParam : null;

  try {
    const dump = await fetchKnowledgeGraph({
      organizationId: auth.orgId,
      projectId,
    });

    return Response.json(knowledgeGraphResponseSchema.parse(dump));
  } catch (err) {
    dbLogger.error({ err, orgId: auth.orgId, projectId }, "GET /api/knowledge-graph");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
