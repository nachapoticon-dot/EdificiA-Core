import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited } from "@/lib/api/errors";

export const runtime = "nodejs";

interface SessionRow {
  id: string;
  title: string;
  file_type: string | null;
  started_at: number;
  project_id: string | null;
}

/** GET /api/sessions — Returns the last 30 sessions for the authenticated user+org */
export async function GET(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "sessions"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("chat_sessions")
    .select("id, title, file_type, started_at, project_id")
    .eq("organization_id", auth.orgId)
    .eq("user_id", auth.userId)
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
  if (!checkRateLimit(rateLimitKey(req, "sessions"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = (await req.json()) as {
    id: string;
    title: string;
    fileType?: string;
    startedAt: number;
    projectId?: string;
  };

  const client = getInsForgeAdminClient();
  await client.database.from("chat_sessions").upsert(
    {
      id: body.id,
      organization_id: auth.orgId,
      user_id: auth.userId,
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
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const clearAll = url.searchParams.get("clearAll") === "true";

  if (!clearAll && !id) return Response.json({ error: "id or clearAll required" }, { status: 400 });

  const client = getInsForgeAdminClient();
  let q = client.database
    .from("chat_sessions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", auth.orgId)
    .eq("user_id", auth.userId);

  if (!clearAll && id) q = q.eq("id", id);

  await q;
  return Response.json({ ok: true });
}
