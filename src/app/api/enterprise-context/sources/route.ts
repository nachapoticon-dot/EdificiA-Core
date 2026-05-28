import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiBadRequest, apiRateLimited } from "@/lib/api/errors";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getRequestLogger } from "@/lib/logger";
import { captureAppError } from "@/lib/observability/error-events";
import { listEnterpriseSources, getEnterpriseSourceSummary } from "@/lib/enterprise-context/sources-service";
import {
  enterpriseSourcesResponseSchema,
  enterpriseSourceMutationResponseSchema,
  enterpriseSourceTypeSchema,
} from "@/lib/validators/api-responses";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "enterprise-context-sources"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const log = getRequestLogger(req);

  try {
    const sources = await listEnterpriseSources(auth.orgId);
    return Response.json(
      enterpriseSourcesResponseSchema.parse({
        meta: {
          organizationId: auth.orgId,
          generatedAt: new Date().toISOString(),
          totalSources: sources.length,
        },
        sources,
      }),
    );
  } catch (err) {
    log.error({ err }, "enterprise sources fetch failed");
    await captureAppError({
      err,
      req,
      organizationId: auth.orgId,
      actorUserId: auth.userId,
      route: "/api/enterprise-context/sources",
      severity: "error",
    });
    return Response.json({ error: "No se pudieron cargar las fuentes de empresa" }, { status: 500 });
  }
}

const createSourceSchema = z.object({
  sourceType: enterpriseSourceTypeSchema,
  name: z.string().trim().min(2).max(120),
  scopes: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  readOnly: z.boolean().optional(),
});

export async function POST(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "enterprise-context-sources-create"), { limit: 20, windowMs: 60_000 })) {
    return apiRateLimited();
  }
  const auth = await requireAuth(req, { role: "engineer" });
  if (auth instanceof Response) return auth;

  const log = getRequestLogger(req);
  const body = await req.json().catch(() => null);
  const parsed = createSourceSchema.safeParse(body);
  if (!parsed.success) return apiBadRequest("Datos de fuente inválidos.");

  if (parsed.data.sourceType === "manual_upload") {
    return apiBadRequest(
      "La fuente de carga manual ya existe por organización; no se declara a mano.",
      "Usá el ingreso de archivos para alimentar la fuente de carga manual.",
    );
  }

  const client = getInsForgeAdminClient();

  try {
    const insertResult = await client.database
      .from("enterprise_sources")
      .insert({
        organization_id: auth.orgId,
        source_type: parsed.data.sourceType,
        name: parsed.data.name,
        status: "discovered",
        read_only: parsed.data.readOnly ?? true,
        scopes: parsed.data.scopes ?? [],
        created_by: auth.userId,
        metadata: { origin: "manual_declaration" },
      })
      .select("id")
      .single();

    if (insertResult.error) throw insertResult.error;
    const sourceId = (insertResult.data as { id: string } | null)?.id;
    if (!sourceId) throw new Error("insert returned no id");

    const source = await getEnterpriseSourceSummary(auth.orgId, sourceId);
    if (!source) throw new Error("created source not found");

    log.info({ organizationId: auth.orgId, sourceId, sourceType: parsed.data.sourceType }, "enterprise source declared");
    return Response.json(enterpriseSourceMutationResponseSchema.parse({ ok: true, source }), { status: 201 });
  } catch (err) {
    log.error({ err }, "enterprise source create failed");
    await captureAppError({
      err,
      req,
      organizationId: auth.orgId,
      actorUserId: auth.userId,
      route: "/api/enterprise-context/sources",
      severity: "error",
    });
    return Response.json({ error: "No se pudo declarar la fuente" }, { status: 500 });
  }
}
