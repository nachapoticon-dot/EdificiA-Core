import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";

export const runtime = "nodejs";

async function resolveOrgId(userId: string): Promise<string | null> {
  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .single();
  return (result.data as { organization_id: string } | null)?.organization_id ?? null;
}

/** GET /api/projects — list all non-deleted projects for the caller's org */
export async function GET(req: Request) {
  if (!checkRateLimit(rateLimitKey(req, "projects"), "standard")) return apiRateLimited();
  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  try {
    const orgId = await resolveOrgId(userId);
    if (!orgId) return Response.json({ error: "No organization" }, { status: 403 });

    const client = getInsForgeAdminClient();
    const result = await client.database
      .from("projects")
      .select("id, name, created_at, updated_at")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    return Response.json({ projects: result.data ?? [] });
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST /api/projects — create a project */
export async function POST(req: Request) {
  if (!checkRateLimit(rateLimitKey(req, "projects"), "standard")) return apiRateLimited();
  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  const body = (await req.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });

  try {
    const orgId = await resolveOrgId(userId);
    if (!orgId) return Response.json({ error: "No organization" }, { status: 403 });

    const client = getInsForgeAdminClient();
    const result = await client.database
      .from("projects")
      .insert({ id: crypto.randomUUID(), organization_id: orgId, name, created_by: userId })
      .select("id, name, created_at, updated_at")
      .single();

    if (result.error) throw result.error;
    return Response.json({ project: result.data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
