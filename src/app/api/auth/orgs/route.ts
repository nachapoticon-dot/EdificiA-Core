import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { verifyUserId, extractBearerToken } from "@/lib/auth/jwt";
import { apiUnauthorized } from "@/lib/api/errors";
import { orgsResponseSchema, type OrgOptionResponse } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

export type OrgOption = OrgOptionResponse;

/** GET /api/auth/orgs — returns all organizations the caller belongs to (for org switcher). */
export async function GET(req: Request): Promise<Response> {
  const token = extractBearerToken(req.headers.get("authorization") ?? "");
  if (!token) return apiUnauthorized();

  const userId = await verifyUserId(token);
  if (!userId) return apiUnauthorized("Token inválido o expirado.");

  try {
    const client = getInsForgeAdminClient();

    const result = await client.database
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    const rows = (result.data ?? []) as unknown as {
      organization_id: string;
      role: string;
      organizations: { name: string } | { name: string }[] | null;
    }[];

    const orgs = rows.map((r) => {
      const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
      return { orgId: r.organization_id, orgName: org?.name ?? r.organization_id, role: r.role };
    });

    return Response.json(orgsResponseSchema.parse({ orgs }));
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
