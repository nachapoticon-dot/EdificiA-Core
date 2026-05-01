import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";

export const runtime = "nodejs";

interface MeResponse {
  userId: string;
  orgId: string;
  role: string;
  orgName: string;
  branding: {
    primaryColor: string;
    logoUrl: string | null;
    agentName: string;
  };
}

/**
 * Returns the authenticated user's org membership + org branding.
 * Used by client hooks to know the user's role without exposing RLS queries to the browser.
 */
export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  try {
    const client = getInsForgeAdminClient();

    const memberResult = await client.database
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    const member = memberResult.data as { organization_id: string; role: string } | null;
    if (!member) return Response.json({ error: "Not a member of any organization" }, { status: 403 });

    const orgResult = await client.database
      .from("organizations")
      .select("name, primary_color, logo_url, agent_name")
      .eq("id", member.organization_id)
      .is("deleted_at", null)
      .single();

    const org = orgResult.data as {
      name: string;
      primary_color: string | null;
      logo_url: string | null;
      agent_name: string | null;
    } | null;

    const body: MeResponse = {
      userId,
      orgId: member.organization_id,
      role: member.role,
      orgName: org?.name ?? "",
      branding: {
        primaryColor: org?.primary_color ?? "#6366f1",
        logoUrl: org?.logo_url ?? null,
        agentName: org?.agent_name ?? "EdificIA",
      },
    };

    return Response.json(body);
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
