import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";
import { rebuildEnterpriseProfile } from "@/lib/enterprise-context/profile-builder";
import { getRequestLogger } from "@/lib/logger";
import { captureAppError } from "@/lib/observability/error-events";
import { enterpriseProfileRefreshResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "enterprise-context-profile-refresh"), { limit: 10, windowMs: 60_000 })) {
    return apiRateLimited();
  }
  const auth = await requireAuth(req, { role: "engineer" });
  if (auth instanceof Response) return auth;

  const log = getRequestLogger(req);

  try {
    const result = await rebuildEnterpriseProfile({
      organizationId: auth.orgId,
      triggerSource: "manual",
      builtByUserId: auth.userId,
    });

    log.info(
      {
        organizationId: auth.orgId,
        snapshotVersion: result.version,
        entityCount: result.entityCount,
        patternCount: result.patternCount,
        coverageCount: result.coverageCount,
      },
      "enterprise profile rebuilt",
    );

    return Response.json(
      enterpriseProfileRefreshResponseSchema.parse({
        ok: true,
        snapshotId: result.snapshotId,
        version: result.version,
        entityCount: result.entityCount,
        patternCount: result.patternCount,
        coverageCount: result.coverageCount,
        summary: result.summary,
      }),
    );
  } catch (err) {
    log.error({ err }, "enterprise profile rebuild failed");
    await captureAppError({
      err,
      req,
      organizationId: auth.orgId,
      actorUserId: auth.userId,
      route: "/api/enterprise-context/profile/refresh",
      severity: "error",
    });
    return Response.json({ error: "No se pudo recalcular el perfil de empresa" }, { status: 500 });
  }
}
