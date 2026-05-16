import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";
import { dbLogger } from "@/lib/logger";

export const runtime = "nodejs";

/** GET /api/projects — list all non-deleted projects for the caller's org */
export async function GET(req: Request) {
  if (!checkRateLimit(rateLimitKey(req, "projects"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const client = getInsForgeAdminClient();
    const result = await client.database
      .from("projects")
      .select("id, name, created_at, updated_at")
      .eq("organization_id", auth.orgId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    return Response.json({ projects: result.data ?? [] });
  } catch (err) {
    dbLogger.error({ err }, "GET /api/projects");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST /api/projects — create a project */
export async function POST(req: Request) {
  if (!checkRateLimit(rateLimitKey(req, "projects"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role === "viewer") return Response.json({ error: "Los visualizadores no pueden crear obras." }, { status: 403 });

  const body = (await req.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });

  try {
    const client = getInsForgeAdminClient();
    const result = await client.database
      .from("projects")
      .insert({ id: crypto.randomUUID(), organization_id: auth.orgId, name, created_by: auth.userId })
      .select("id, name, created_at, updated_at")
      .single();

    if (result.error) {
      const dbErr = result.error as { message?: string; code?: string; details?: string };
      dbLogger.error({ code: dbErr.code, message: dbErr.message, details: dbErr.details }, "POST /api/projects DB error");
      return Response.json({ error: dbErr.message ?? "Error al crear el proyecto", code: dbErr.code }, { status: 500 });
    }
    return Response.json({ project: result.data }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dbLogger.error({ err: msg }, "POST /api/projects unexpected error");
    return Response.json({ error: msg }, { status: 500 });
  }
}
