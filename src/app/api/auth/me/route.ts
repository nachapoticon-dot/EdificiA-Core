import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { verifyUserId, decodeClaims } from "@/lib/auth/jwt";

export const runtime = "nodejs";

interface MeResponse {
  userId: string;
  email: string | null;
  orgId: string;
  role: string;
  orgName: string;
  branding: {
    primaryColor: string;
    logoUrl: string | null;
    agentName: string;
  };
  stats: {
    activeProjects: number;
    memberCount: number;
  };
}

/**
 * Returns the authenticated user's org membership + org branding.
 * Accepts an optional x-org-id header to select a specific org when the user
 * belongs to multiple organizations (consultant use case).
 */
export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Use async verifyUserId so InsForge validates the JWT signature server-side
  const claims = decodeClaims(token);
  if (!claims) return Response.json({ error: "Invalid token" }, { status: 401 });
  const userId = await verifyUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });
  const { email } = claims;

  // Respect the active org selection from the client (org switcher stores this)
  const requestedOrgId = req.headers.get("x-org-id") ?? null;

  try {
    const client = getInsForgeAdminClient();

    // Build query — if a specific org is requested, filter by it (still scoped to userId for security)
    let memberQuery = client.database
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (requestedOrgId) {
      memberQuery = memberQuery.eq("organization_id", requestedOrgId);
    }

    const memberResult = await memberQuery.limit(1).single();
    const member = memberResult.data as { organization_id: string; role: string } | null;

    // If the requested org isn't found (user not a member), fall back to their first org
    const resolvedMember = member ?? await (async () => {
      const fallback = await client.database
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .limit(1)
        .single();
      return fallback.data as { organization_id: string; role: string } | null;
    })();

    if (!resolvedMember) {
      return Response.json({ error: "Not a member of any organization" }, { status: 403 });
    }

    const orgId = resolvedMember.organization_id;

    const [orgResult, projectsResult, membersResult] = await Promise.all([
      client.database
        .from("organizations")
        .select("name, primary_color, logo_url, agent_name")
        .eq("id", orgId)
        .is("deleted_at", null)
        .single(),
      client.database
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .is("deleted_at", null),
      client.database
        .from("organization_members")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .is("deleted_at", null),
    ]);

    const org = orgResult.data as {
      name: string;
      primary_color: string | null;
      logo_url: string | null;
      agent_name: string | null;
    } | null;

    const body: MeResponse = {
      userId,
      email,
      orgId,
      role: resolvedMember.role,
      orgName: org?.name ?? "",
      branding: {
        primaryColor: org?.primary_color ?? "#6366f1",
        logoUrl: org?.logo_url ?? null,
        agentName: org?.agent_name ?? "EdificIA",
      },
      stats: {
        activeProjects: projectsResult.count ?? 0,
        memberCount:    membersResult.count   ?? 0,
      },
    };

    return Response.json(body);
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
