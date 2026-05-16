import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { verifyUserId, extractBearerToken, decodeClaims } from "@/lib/auth/jwt";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited, apiUnauthorized } from "@/lib/api/errors";
import { slugify } from "@/lib/utils";
import { httpLogger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "claim-founder"), "auth")) return apiRateLimited("Demasiados intentos. Esperá un minuto.");
  const token = extractBearerToken(req.headers.get("authorization") ?? "");
  if (!token) return apiUnauthorized();
  const userId = await verifyUserId(token);
  if (!userId) return apiUnauthorized("Token inválido o expirado.");

  // Email comes from the verified JWT — not from the request body.
  // This prevents any user from claiming an invitation for a different email.
  const claims = decodeClaims(token);
  const email = claims?.email?.toLowerCase().trim();
  if (!email) return Response.json({ error: "El JWT no contiene email. Volvé a iniciar sesión." }, { status: 400 });

  const admin = getInsForgeAdminClient();

  // Verificar invitación de fundador pendiente
  const { data: founderRows } = await admin.database
    .from("org_founder_invitations")
    .select("id, company_name, organization_id")
    .eq("email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  const founder = (founderRows ?? [])[0] as { id: string; company_name: string; organization_id?: string | null } | undefined;
  if (!founder) return Response.json({ orgCreated: false });

  // Verificar que el usuario no tenga ya una membresía en esta org
  const { data: existing } = await admin.database
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1);

  if ((existing ?? []).length > 0) {
    await admin.database
      .from("org_founder_invitations")
      .update({ status: "accepted" })
      .eq("id", founder.id);
    return Response.json({ orgCreated: false, alreadyHasOrg: true });
  }

  // Reusar la org creada por super-admin, o crearla si no existe (retrocompatibilidad)
  let orgId = founder.organization_id ?? null;
  if (!orgId) {
    const { data: orgData, error: orgErr } = await admin.database
      .from("organizations")
      .insert({ name: founder.company_name, slug: slugify(founder.company_name, userId.slice(0, 8)) })
      .select("id")
      .single();
    if (orgErr || !orgData) {
      httpLogger.error({ err: orgErr, email, userId }, "claim-founder: no se pudo crear la organización");
      return Response.json({ error: "No se pudo crear la organización." }, { status: 500 });
    }
    orgId = (orgData as { id: string }).id;
  }

  // Agregar como admin — verificar que el insert haya funcionado
  const memberInsert = await admin.database
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: userId, role: "admin", email })
    .select("id")
    .single();

  if (memberInsert.error || !memberInsert.data) {
    httpLogger.error(
      { err: memberInsert.error, orgId, userId, email },
      "claim-founder: falló insert en organization_members",
    );
    return Response.json(
      { error: "No se pudo vincular el usuario a la organización.", detail: memberInsert.error?.message },
      { status: 500 },
    );
  }

  // Marcar invitación como aceptada y guardar el orgId (por si vino sin él)
  await admin.database
    .from("org_founder_invitations")
    .update({ status: "accepted", organization_id: orgId })
    .eq("id", founder.id);

  return Response.json({ orgCreated: true, orgName: founder.company_name, orgId });
}
