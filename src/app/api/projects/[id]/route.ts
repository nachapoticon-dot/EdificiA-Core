import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

function decodeUserId(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    return (JSON.parse(decoded) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

/** PATCH /api/projects/[id] — touch updated_at to record last activation */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  try {
    const client = getInsForgeAdminClient();

    const memberResult = await client.database
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    const orgId = (memberResult.data as { organization_id: string } | null)?.organization_id;
    if (!orgId) return Response.json({ error: "No organization" }, { status: 403 });

    const result = await client.database
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select("id, name, created_at, updated_at")
      .single();

    if (result.error) throw result.error;
    return Response.json({ project: result.data });
  } catch (err) {
    console.error("[PATCH /api/projects/:id]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
