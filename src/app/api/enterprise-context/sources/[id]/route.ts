import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiBadRequest, apiNotFound, apiRateLimited } from "@/lib/api/errors";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getRequestLogger } from "@/lib/logger";
import { captureAppError } from "@/lib/observability/error-events";
import { getEnterpriseSourceSummary } from "@/lib/enterprise-context/sources-service";
import {
  enterpriseSourceMutationResponseSchema,
  enterpriseSourceStatusSchema,
} from "@/lib/validators/api-responses";

export const runtime = "nodejs";

const updateSourceSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    status: enterpriseSourceStatusSchema.optional(),
    errorMessage: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.status !== undefined || v.errorMessage !== undefined, {
    message: "Sin cambios.",
  });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "enterprise-context-source-update"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req, { role: "engineer" });
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const log = getRequestLogger(req);
  const parsed = updateSourceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");

  const client = getInsForgeAdminClient();

  try {
    const existing = await client.database
      .from("enterprise_sources")
      .select("id")
      .eq("id", id)
      .eq("organization_id", auth.orgId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (!existing.data) return apiNotFound("Fuente");

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.errorMessage !== undefined) patch.error_message = parsed.data.errorMessage;

    const updateResult = await client.database
      .from("enterprise_sources")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", auth.orgId)
      .is("deleted_at", null);

    if (updateResult.error) throw updateResult.error;

    const source = await getEnterpriseSourceSummary(auth.orgId, id);
    if (!source) return apiNotFound("Fuente");

    log.info({ organizationId: auth.orgId, sourceId: id, status: parsed.data.status }, "enterprise source updated");
    return Response.json(enterpriseSourceMutationResponseSchema.parse({ ok: true, source }));
  } catch (err) {
    log.error({ err }, "enterprise source update failed");
    await captureAppError({
      err,
      req,
      organizationId: auth.orgId,
      actorUserId: auth.userId,
      route: "/api/enterprise-context/sources/[id]",
      severity: "error",
    });
    return Response.json({ error: "No se pudo actualizar la fuente" }, { status: 500 });
  }
}
