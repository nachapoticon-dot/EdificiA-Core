import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiNotFound, apiRateLimited } from "@/lib/api/errors";
import { getRequestLogger } from "@/lib/logger";
import { captureAppError } from "@/lib/observability/error-events";
import { getEnterpriseSourceCatalog } from "@/lib/enterprise-context/sources-service";
import { enterpriseSourceDocumentsResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "enterprise-context-source-catalog"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const log = getRequestLogger(req);

  try {
    const catalog = await getEnterpriseSourceCatalog(auth.orgId, id);
    if (!catalog) return apiNotFound("Fuente");
    return Response.json(enterpriseSourceDocumentsResponseSchema.parse(catalog));
  } catch (err) {
    log.error({ err }, "enterprise source catalog fetch failed");
    await captureAppError({
      err,
      req,
      organizationId: auth.orgId,
      actorUserId: auth.userId,
      route: "/api/enterprise-context/sources/[id]/documents",
      severity: "error",
    });
    return Response.json({ error: "No se pudo cargar el catálogo de la fuente" }, { status: 500 });
  }
}
