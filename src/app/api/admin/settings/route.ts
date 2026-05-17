import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { orgSettingsResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAuth(req, { role: "admin" });
  if (auth instanceof Response) return auth;

  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("organizations")
    .select("id, name, slug, primary_color, logo_url, agent_name")
    .eq("id", auth.orgId)
    .is("deleted_at", null)
    .single();

  if (!result.data) return Response.json({ error: "Organization not found" }, { status: 404 });
  return Response.json(orgSettingsResponseSchema.parse(result.data));
}

export async function PATCH(req: Request): Promise<Response> {
  const auth = await requireAuth(req, { role: "admin" });
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
  return Response.json(orgSettingsResponseSchema.parse(result.data));
}
