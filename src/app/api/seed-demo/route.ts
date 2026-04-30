/**
 * Endpoint de solo uso para vincular un usuario existente como admin de la org demo.
 *
 * POST /api/seed-demo  { "email": "tu@email.com", "password": "tu-password" }
 *   → Crea la organización "EdificIA Demo" (si no existe).
 *   → Hace signIn con tus credenciales para obtener tu user ID.
 *   → Te agrega como admin de la org.
 *
 * Si no tenés cuenta aún, primero registrate en /register o /login.
 */
import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

const DEMO_ORG_NAME = "EdificIA Demo";
const DEMO_ORG_SLUG = "edificia-demo";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return Response.json({
      error: "Necesito email y password: { \"email\": \"tu@email.com\", \"password\": \"tu-password\" }",
    }, { status: 400 });
  }

  const admin = getInsForgeAdminClient();
  const log: string[] = [];

  // 1. Crear o recuperar organización demo
  let orgId: string;
  const { data: existingOrgs } = await admin.database
    .from("organizations")
    .select("id, name")
    .eq("slug", DEMO_ORG_SLUG)
    .limit(1);

  if (existingOrgs && existingOrgs.length > 0) {
    orgId = (existingOrgs[0] as { id: string }).id;
    log.push(`[org] Ya existe: ${DEMO_ORG_NAME} (${orgId})`);
  } else {
    const { data: newOrg, error: orgErr } = await admin.database
      .from("organizations")
      .insert({ name: DEMO_ORG_NAME, slug: DEMO_ORG_SLUG })
      .select("id")
      .single();

    if (orgErr || !newOrg) {
      return Response.json({ error: "Error creando organización", detail: orgErr }, { status: 500 });
    }
    orgId = (newOrg as { id: string }).id;
    log.push(`[org] Creada: ${DEMO_ORG_NAME} (${orgId})`);
  }

  // 2. Obtener user ID via signIn
  const { data: loginData, error: loginErr } = await admin.auth.signInWithPassword({ email, password });
  if (loginErr || !loginData?.user?.id) {
    return Response.json({
      error: "No se pudo hacer signIn. Verificá tu email y password.",
      detail: loginErr,
      log,
    }, { status: 401 });
  }

  const userId = loginData.user.id;
  log.push(`[auth] SignIn OK: ${email} (${userId})`);

  // 3. Vincular como admin (upsert por si ya es miembro con otro rol)
  const { data: existingMember } = await admin.database
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1);

  if (existingMember && existingMember.length > 0) {
    const member = existingMember[0] as { id: string; role: string };
    if (member.role !== "admin") {
      await admin.database
        .from("organization_members")
        .update({ role: "admin" })
        .eq("id", member.id);
      log.push(`[member] Rol actualizado a admin`);
    } else {
      log.push(`[member] Ya es admin`);
    }
  } else {
    const { error: memberErr } = await admin.database
      .from("organization_members")
      .insert({ organization_id: orgId, user_id: userId, role: "admin" });

    if (memberErr) {
      return Response.json({ error: "Error agregando miembro", detail: memberErr, log }, { status: 500 });
    }
    log.push(`[member] Agregado como admin`);
  }

  return Response.json({
    ok: true,
    message: "Listo. Ahora podés entrar a http://localhost:3000/login con tus credenciales.",
    email,
    role: "admin",
    org: DEMO_ORG_NAME,
    log,
  });
}
