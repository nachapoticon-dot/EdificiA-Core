import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { slugify } from "@/lib/utils";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

interface FounderInvitation {
  id: string;
  email: string;
  company_name: string;
  organization_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  expires_at: string;
  invite_token?: string | null;
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
    .select("id, email, company_name, organization_id, status, notes, created_at, expires_at, invite_token")
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

  const email = body.email.toLowerCase().trim();
  const companyName = body.company_name.trim();
  const inviteToken = randomBytes(16).toString("hex");
  const client = getInsForgeAdminClient();

  // Crear la organización de inmediato para que aparezca en el panel de empresas
  const { data: orgData, error: orgErr } = await client.database
    .from("organizations")
    .insert({ name: companyName, slug: slugify(companyName, randomBytes(4).toString("hex")) })
    .select("id")
    .single();

  if (orgErr || !orgData) {
    return Response.json({ error: "No se pudo crear la organización." }, { status: 500 });
  }
  const orgId = (orgData as { id: string }).id;

  const { data, error } = await client.database
    .from("org_founder_invitations")
    .insert({
      email,
      company_name: companyName,
      notes: body.notes?.trim() ?? null,
      invite_token: inviteToken,
      organization_id: orgId,
    })
    .select("id, email, company_name, organization_id, status, created_at, expires_at, invite_token")
    .single();

  if (error) {
    // Revertir la org si falla la invitación
    await client.database.from("organizations").delete().eq("id", orgId);
    if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
      return Response.json({ error: "Este email ya tiene una invitación activa" }, { status: 409 });
    }
    return Response.json({ error: "No se pudo crear la invitación" }, { status: 500 });
  }

  return Response.json({ invitation: data }, { status: 201 });
}

export async function PATCH(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { id?: string };
  if (!body.id) return Response.json({ error: "id requerido" }, { status: 400 });

  const newToken = randomBytes(16).toString("hex");
  const client = getInsForgeAdminClient();

  const { data, error } = await client.database
    .from("org_founder_invitations")
    .update({
      status: "pending",
      invite_token: newToken,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", body.id)
    .select("id, email, company_name, status, notes, created_at, expires_at, invite_token")
    .single();

  if (error) return Response.json({ error: "No se pudo reactivar la invitación" }, { status: 500 });
  return Response.json({ invitation: data });
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
