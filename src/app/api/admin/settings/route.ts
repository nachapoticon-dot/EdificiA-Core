import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";

export const runtime = "nodejs";

async function requireAdmin(req: Request): Promise<{ userId: string; orgId: string } | Response> {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .is("deleted_at", null)
    .limit(1)
    .single();

  const member = result.data as { organization_id: string } | null;
  if (!member) return Response.json({ error: "Admin role required" }, { status: 403 });
  return { userId, orgId: member.organization_id };
}

// ── GET /api/admin/settings ───────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("organizations")
    .select("id, name, slug, primary_color, logo_url, agent_name")
    .eq("id", auth.orgId)
    .is("deleted_at", null)
    .single();

  if (!result.data) return Response.json({ error: "Organization not found" }, { status: 404 });
  return Response.json(result.data);
}

// ── PATCH /api/admin/settings ─────────────────────────────────────────────────

export async function PATCH(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = (await req.json()) as {
    name?: string;
    primaryColor?: string;
    logoUrl?: string | null;
    agentName?: string;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name?.trim()) patch.name = body.name.trim();
  if (body.primaryColor) patch.primary_color = body.primaryColor;
  if ("logoUrl" in body) patch.logo_url = body.logoUrl ?? null;
  if (body.agentName?.trim()) patch.agent_name = body.agentName.trim();

  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("organizations")
    .update(patch)
    .eq("id", auth.orgId)
    .select("id, name, slug, primary_color, logo_url, agent_name")
    .single();

  if (result.error) return Response.json({ error: "Update failed" }, { status: 500 });
  return Response.json(result.data);
}
