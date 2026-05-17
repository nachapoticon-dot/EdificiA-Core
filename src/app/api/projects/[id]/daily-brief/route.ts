import { requireAuth } from "@/lib/auth/require-auth";
import { apiBadRequest, apiInternal, apiNotFound, apiRateLimited } from "@/lib/api/errors";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { dbLogger } from "@/lib/logger";
import { buildDailyBrief } from "@/lib/project-operations/brief/daily-brief";
import { dailyBriefResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  if (!checkRateLimit(rateLimitKey(req, "daily-brief"), "standard")) return apiRateLimited();

  try {
    const url = new URL(req.url);
    const includeWeather = url.searchParams.get("weather") === "1";
    const latitude = parseOptionalNumber(url.searchParams.get("lat"));
    const longitude = parseOptionalNumber(url.searchParams.get("lng"));

    if ((latitude == null) !== (longitude == null)) {
      return apiBadRequest("Para usar coordenadas, enviá lat y lng juntos.");
    }

    const brief = await buildDailyBrief({
      organizationId: auth.orgId,
      projectId,
      includeWeather: includeWeather
        ? {
            location: url.searchParams.get("location")?.trim() || undefined,
            latitude: latitude ?? undefined,
            longitude: longitude ?? undefined,
          }
        : undefined,
    });

    if (!brief.found) return apiNotFound("Obra");
    return Response.json(dailyBriefResponseSchema.parse(brief));
  } catch (err) {
    dbLogger.error({ err }, "GET /api/projects/:id/daily-brief failed");
    return apiInternal("daily brief");
  }
}

function parseOptionalNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
