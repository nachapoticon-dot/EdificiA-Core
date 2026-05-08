import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

interface FounderInvitation {
  id: string;
  email: string;
  company_name: string;
  status: string;
  notes: string | null;
  created_at: string;
  expires_at: string;
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.SUPER_ADMIN_KEY;
  if (!secret) return false;
  const auth = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  return auth === secret;
}

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const client = getInsForgeAdminClient();
  const { data, error } = await client.database
    .from("org_founder_invitations")
    .select("id, email, company_name, status, notes, created_at, expires_at")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: "DB error" }, { status: 500 });
  return Response.json({ invitations: (data ?? []) as FounderInvitation[] });
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { email?: string; company_name?: string; notes?: string };
  if (!body.email || !body.company_name) {
    return Response.json({ error: "email y company_name son requeridos" }, { status: 400 });
  }

  const client = getInsForgeAdminClient();
  const { data, error } = await client.database
    .from("org_founder_invitations")
    .insert({
      email: body.email.toLowerCase().trim(),
      company_name: body.company_name.trim(),
      notes: body.notes?.trim() ?? null,
    })
    .select("id, email, company_name, status, created_at, expires_at")
    .single();

  if (error) {
    if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
      return Response.json({ error: "Este email ya tiene una invitación activa" }, { status: 409 });
    }
    return Response.json({ error: "No se pudo crear la invitación" }, { status: 500 });
  }

  return Response.json({ invitation: data }, { status: 201 });
}

export async function DELETE(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id requerido" }, { status: 400 });

  const client = getInsForgeAdminClient();
  await client.database
    .from("org_founder_invitations")
    .update({ status: "revoked" })
    .eq("id", id);

  return Response.json({ ok: true });
}
