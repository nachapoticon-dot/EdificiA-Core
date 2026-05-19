import { requireAuth } from "@/lib/auth/require-auth";
import { apiForbidden, apiRateLimited } from "@/lib/api/errors";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import {
  adminErrorEventPatchRequestSchema,
  adminErrorEventsResponseSchema,
} from "@/lib/validators/api-responses";

export const runtime = "nodejs";

type ErrorEventRow = {
  id: string;
  organization_id: string | null;
  project_id: string | null;
  actor_user_id: string | null;
  request_id: string | null;
  route: string;
  method: string | null;
  severity: "warning" | "error" | "critical";
  fingerprint: string;
  message: string;
  context: Record<string, unknown> | null;
  resolved_at: string | null;
  created_at: string;
};

export async function GET(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "admin-error-events"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role !== "admin") return apiForbidden("Se requiere rol admin.");

  try {
    const { searchParams } = new URL(req.url);
    const includeResolved = searchParams.get("includeResolved") === "1";
    const client = getInsForgeAdminClient();

    let query = client.database
      .from("app_error_events")
      .select("id, organization_id, project_id, actor_user_id, request_id, route, method, severity, fingerprint, message, context, resolved_at, created_at")
      .eq("organization_id", auth.orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!includeResolved) query = query.is("resolved_at", null);

    const result = await query;
    if (result.error) throw result.error;

    const rows = (result.data ?? []) as ErrorEventRow[];
    return Response.json(adminErrorEventsResponseSchema.parse({
      events: rows.map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        projectId: row.project_id,
        actorUserId: row.actor_user_id,
        requestId: row.request_id,
        route: row.route,
        method: row.method,
        severity: row.severity,
        fingerprint: row.fingerprint,
        message: row.message,
        context: row.context ?? {},
        resolvedAt: row.resolved_at,
        createdAt: row.created_at,
      })),
    }));
  } catch (err) {
    dbLogger.error({ err }, "GET /api/admin/error-events");
    return Response.json({ error: "No se pudieron cargar los eventos de error" }, { status: 500 });
  }
}

export async function PATCH(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "admin-error-events-patch"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role !== "admin") return apiForbidden("Se requiere rol admin.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = adminErrorEventPatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const client = getInsForgeAdminClient();
    const result = await client.database
      .from("app_error_events")
      .update({ resolved_at: parsed.data.resolved ? new Date().toISOString() : null })
      .eq("id", parsed.data.id)
      .eq("organization_id", auth.orgId)
      .select("id")
      .limit(1)
      .maybeSingle();

    if (result.error) throw result.error;
    if (!result.data) return Response.json({ error: "Evento no encontrado" }, { status: 404 });

    return Response.json({ ok: true });
  } catch (err) {
    dbLogger.error({ err }, "PATCH /api/admin/error-events");
    return Response.json({ error: "No se pudo actualizar el evento de error" }, { status: 500 });
  }
}
