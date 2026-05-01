import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";

export const runtime = "nodejs";

export interface OrgOption {
  orgId: string;
  orgName: string;
  role: string;
}

export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

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

    const orgs: OrgOption[] = rows.map((r) => {
      const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
      return {
        orgId: r.organization_id,
        orgName: org?.name ?? r.organization_id,
        role: r.role,
      };
    });

    return Response.json({ orgs });
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
