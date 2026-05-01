import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";

export const runtime = "nodejs";

interface SessionRow {
  id: string;
  title: string;
  file_type: string | null;
  started_at: number;
  project_id: string | null;
}

function resolveOrg(req: Request, userId: string) {
  return {
    userId,
    orgId: req.headers.get("x-org-id") ?? null,
  };
}

async function getOrgId(
  client: ReturnType<typeof getInsForgeAdminClient>,
  userId: string,
  requestedOrgId: string | null,
): Promise<string | null> {
  let q = client.database
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (requestedOrgId) q = q.eq("organization_id", requestedOrgId);

  const result = await q.limit(1).single();
  return (result.data as { organization_id: string } | null)?.organization_id ?? null;
}

/** GET /api/sessions — Returns the last 30 sessions for the authenticated user+org */
export async function GET(req: Request): Promise<Response> {
  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  const client = getInsForgeAdminClient();
  const { orgId: requestedOrgId } = resolveOrg(req, userId);
  const orgId = await getOrgId(client, userId, requestedOrgId);
  if (!orgId) return Response.json({ error: "Not a member" }, { status: 403 });

  const result = await client.database
    .from("chat_sessions")
    .select("id, title, file_type, started_at, project_id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(30);

  const rows = (result.data ?? []) as SessionRow[];
  const sessions = rows.map((r) => ({
    id: r.id,
    title: r.title,
    fileType: r.file_type ?? undefined,
    startedAt: r.started_at,
    projectId: r.project_id ?? undefined,
  }));

  return Response.json({ sessions });
}

/** POST /api/sessions — Upsert a session entry */
export async function POST(req: Request): Promise<Response> {
  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  const body = (await req.json()) as {
    id: string;
    title: string;
    fileType?: string;
    startedAt: number;
    projectId?: string;
  };

  const client = getInsForgeAdminClient();
  const { orgId: requestedOrgId } = resolveOrg(req, userId);
  const orgId = await getOrgId(client, userId, requestedOrgId);
  if (!orgId) return Response.json({ error: "Not a member" }, { status: 403 });

  await client.database.from("chat_sessions").upsert(
    {
      id: body.id,
      organization_id: orgId,
      user_id: userId,
      title: body.title,
      file_type: body.fileType ?? null,
      started_at: body.startedAt,
      project_id: body.projectId ?? null,
    },
    { onConflict: "id" },
  );

  return Response.json({ ok: true });
}

/** DELETE /api/sessions?id=xxx  or  ?clearAll=true */
export async function DELETE(req: Request): Promise<Response> {
  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const clearAll = url.searchParams.get("clearAll") === "true";

  const client = getInsForgeAdminClient();
  const { orgId: requestedOrgId } = resolveOrg(req, userId);
  const orgId = await getOrgId(client, userId, requestedOrgId);
  if (!orgId) return Response.json({ error: "Not a member" }, { status: 403 });

  let q = client.database
    .from("chat_sessions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("user_id", userId);

  if (!clearAll && id) {
    q = q.eq("id", id);
  } else if (!clearAll) {
    return Response.json({ error: "id or clearAll required" }, { status: 400 });
  }

  await q;
  return Response.json({ ok: true });
}
