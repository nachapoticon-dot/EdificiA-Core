import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";

export const runtime = "nodejs";

function slugify(name: string, suffix: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40)
    .concat("-", suffix);
}

export async function POST(req: Request): Promise<Response> {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { email?: string };
  if (!body.email) return Response.json({ error: "email requerido" }, { status: 400 });

  const email = body.email.toLowerCase().trim();
  const admin = getInsForgeAdminClient();

  // Verificar invitación de fundador pendiente
  const { data: founderRows } = await admin.database
    .from("org_founder_invitations")
    .select("id, company_name")
    .eq("email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  const founder = (founderRows ?? [])[0] as { id: string; company_name: string } | undefined;
  if (!founder) return Response.json({ orgCreated: false });

  // Verificar que el usuario no tenga ya una organización
  const { data: existing } = await admin.database
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1);

  if ((existing ?? []).length > 0) {
    // Ya tiene org — solo marcar la invitación como aceptada
    await admin.database
      .from("org_founder_invitations")
      .update({ status: "accepted" })
      .eq("id", founder.id);
    return Response.json({ orgCreated: false, alreadyHasOrg: true });
  }

  // Crear organización
  const { data: orgData, error: orgErr } = await admin.database
    .from("organizations")
    .insert({ name: founder.company_name, slug: slugify(founder.company_name, userId.slice(0, 8)) })
    .select("id")
    .single();

  if (orgErr || !orgData) return Response.json({ error: "No se pudo crear la organización." }, { status: 500 });
  const orgId = (orgData as { id: string }).id;

  // Agregar como admin
  await admin.database
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: userId, role: "admin", email });

  // Marcar invitación como aceptada
  await admin.database
    .from("org_founder_invitations")
    .update({ status: "accepted" })
    .eq("id", founder.id);

  return Response.json({ orgCreated: true, orgName: founder.company_name });
}
