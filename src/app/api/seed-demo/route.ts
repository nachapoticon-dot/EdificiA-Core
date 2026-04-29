/**
 * Endpoint de solo uso para crear las credenciales de demo.
 * Llamar una sola vez: POST http://localhost:3000/api/seed-demo
 * Eliminar o proteger antes de producción.
 */
import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

const DEMO_ORG_NAME = "EdificIA Demo";
const DEMO_ORG_SLUG = "edificia-demo";
const DEMO_EMAIL    = "admin@edificia.demo";
const DEMO_PASSWORD = "1234";
const DEMO_NAME     = "Admin Demo";

export async function POST() {
  const admin = getInsForgeAdminClient();
  const log: string[] = [];

  // 1. Crear o recuperar organización
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

  // 2. Crear usuario
  let userId: string;
  const { data: signUpData, error: signUpErr } = await admin.auth.signUp({
    email:       DEMO_EMAIL,
    password:    DEMO_PASSWORD,
    name:        DEMO_NAME,
    autoConfirm: true,
  });

  if (signUpErr) {
    const msg = signUpErr.message ?? "";
    if (msg.includes("already") || msg.includes("exists")) {
      log.push(`[auth] Usuario ya existe, continuando...`);
      // Intentar login para obtener el user ID
      const { data: loginData, error: loginErr } = await admin.auth.signInWithPassword({
        email: DEMO_EMAIL, password: DEMO_PASSWORD,
      });
      if (loginErr || !loginData?.user?.id) {
        return Response.json({ error: "Usuario ya existe pero no se pudo obtener su ID", log }, { status: 500 });
      }
      userId = loginData.user.id;
    } else {
      return Response.json({ error: "Error creando usuario", detail: signUpErr, log }, { status: 500 });
    }
  } else {
    userId = signUpData?.user?.id ?? "";
    if (!userId) return Response.json({ error: "signUp no retornó user ID", log }, { status: 500 });
    log.push(`[auth] Usuario creado: ${DEMO_EMAIL} (${userId})`);
  }

  // 3. Vincular a la organización como admin
  const { data: existingMember } = await admin.database
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .limit(1);

  if (existingMember && existingMember.length > 0) {
    log.push(`[member] Ya es miembro`);
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
    credentials: {
      url:      "http://localhost:3000/login",
      email:    DEMO_EMAIL,
      password: DEMO_PASSWORD,
      role:     "admin",
      org:      DEMO_ORG_NAME,
    },
    log,
  });
}
