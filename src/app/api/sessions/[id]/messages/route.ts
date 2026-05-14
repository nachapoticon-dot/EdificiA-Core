import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import type { UIMessage } from "ai";

export const runtime = "nodejs";

async function verifySessionAccess(
  client: ReturnType<typeof getInsForgeAdminClient>,
  sessionId: string,
  userId: string,
): Promise<{ orgId: string } | null> {
  const result = await client.database
    .from("chat_sessions")
    .select("organization_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .single();

  const row = result.data as { organization_id: string } | null;
  if (!row) return null;
  return { orgId: row.organization_id };
}

/** GET /api/sessions/[id]/messages — Returns messages for a session */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { id: sessionId } = await params;
  const client = getInsForgeAdminClient();

  const access = await verifySessionAccess(client, sessionId, auth.userId);
  if (!access) return Response.json({ messages: [] });

  const result = await client.database
    .from("chat_snapshots")
    .select("messages")
    .eq("session_id", sessionId)
    .limit(1)
    .single();

  const row = result.data as { messages: UIMessage[] } | null;
  return Response.json({ messages: row?.messages ?? [] });
}

/** PUT /api/sessions/[id]/messages — Upsert all messages for a session */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { id: sessionId } = await params;
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const client = getInsForgeAdminClient();

  const access = await verifySessionAccess(client, sessionId, auth.userId);
  if (!access) return Response.json({ error: "Not found" }, { status: 404 });

  await client.database.from("chat_snapshots").upsert(
    {
      session_id: sessionId,
      organization_id: access.orgId,
      messages: messages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id" },
  );

  await client.database
    .from("chat_sessions")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", sessionId);

  return Response.json({ ok: true });
}
