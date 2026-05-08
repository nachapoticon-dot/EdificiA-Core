import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { signUpSchema } from "@/lib/validators";

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

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request inválido." }, { status: 400 });
  }

  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const { email, password, name } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const admin = getInsForgeAdminClient();

  // 1a. Verificar si es un fundador pre-autorizado (crea org nueva)
  const { data: founderRows } = await admin.database
    .from("org_founder_invitations")
    .select("id, company_name")
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  const founderInvitation = (founderRows ?? [])[0] as { id: string; company_name: string } | undefined;

  if (founderInvitation) {
    // Crear usuario
    const { data: authData, error: authErr } = await admin.auth.signUp({ email, password, name, autoConfirm: true });
    if (authErr) {
      const msg = authErr.message ?? "";
      if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("already been registered")) {
        return Response.json({ error: "Este email ya está registrado. Intentá iniciar sesión." }, { status: 409 });
      }
      return Response.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
    }
    const userId = authData?.user?.id;
    if (!userId) return Response.json({ error: "No se pudo crear la cuenta." }, { status: 500 });

    // Crear organización
    const { data: orgData, error: orgErr } = await admin.database
      .from("organizations")
      .insert({ name: founderInvitation.company_name, slug: slugify(founderInvitation.company_name, userId.slice(0, 8)) })
      .select("id")
      .single();

    if (orgErr || !orgData) return Response.json({ error: "No se pudo crear la organización." }, { status: 500 });
    const orgId = (orgData as { id: string }).id;

    // Agregar como admin
    await admin.database.from("organization_members").insert({ organization_id: orgId, user_id: userId, role: "admin", email: normalizedEmail });

    // Marcar invitación como aceptada
    await admin.database
      .from("org_founder_invitations")
      .update({ status: "accepted" })
      .eq("id", founderInvitation.id);

    return Response.json({ ok: true });
  }

  // 1b. Verificar invitación de miembro (flujo existente)
  const { data: invitations, error: invErr } = await admin.database
    .from("organization_invitations")
    .select("id, organization_id, role")
    .eq("invited_email", normalizedEmail)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  if (invErr || !invitations || invitations.length === 0) {
    return Response.json(
      { error: "Tu email no está autorizado. Solicitá una invitación al administrador de tu empresa." },
      { status: 403 },
    );
  }

  const invitation = invitations[0] as { id: string; organization_id: string; role: string };

  // 2. Crear usuario en InsForge Auth
  const { data: authData, error: authErr } = await admin.auth.signUp({ email, password, name, autoConfirm: true });

  if (authErr) {
    const msg = authErr.message ?? "";
    if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("already been registered")) {
      return Response.json({ error: "Este email ya está registrado. Intentá iniciar sesión." }, { status: 409 });
    }
    return Response.json({ error: "No se pudo crear la cuenta. Intentá de nuevo más tarde." }, { status: 500 });
  }

  const userId = authData?.user?.id;
  if (!userId) return Response.json({ error: "No se pudo crear la cuenta." }, { status: 500 });

  // 3. Agregar a la organización
  await admin.database.from("organization_members").insert({
    organization_id: invitation.organization_id,
    user_id: userId,
    role: invitation.role,
    email: normalizedEmail,
  });

  // 4. Marcar invitación como aceptada
  await admin.database
    .from("organization_invitations")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return Response.json({ ok: true });
}

// Paso previo: verificar si el email tiene una invitación pendiente
// Devuelve el nombre de la organización para mostrar al usuario antes de completar el registro
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim() ?? "";

  if (!email) {
    return Response.json({ error: "Email requerido." }, { status: 400 });
  }

  const admin = getInsForgeAdminClient();

  // Primero verificar si es un fundador pre-autorizado
  const { data: founderRows } = await admin.database
    .from("org_founder_invitations")
    .select("id, company_name")
    .eq("email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  const founder = (founderRows ?? [])[0] as { id: string; company_name: string } | undefined;
  if (founder) {
    return Response.json({
      authorized: true,
      organizationName: founder.company_name,
      role: "admin",
      isFounder: true,
    });
  }

  // Luego verificar invitación de miembro existente
  const { data, error } = await admin.database
    .from("organization_invitations")
    .select("id, role, organizations(name)")
    .eq("invited_email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  if (error || !data || data.length === 0) {
    return Response.json({ authorized: false }, { status: 200 });
  }

  const inv = data[0] as unknown as { id: string; role: string; organizations: { name: string } | { name: string }[] | null };
  return Response.json({
    authorized: true,
    organizationName: Array.isArray(inv.organizations) ? (inv.organizations[0]?.name ?? "tu empresa") : (inv.organizations?.name ?? "tu empresa"),
    role: inv.role,
  });
}
