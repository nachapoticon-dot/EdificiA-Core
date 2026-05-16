import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { sendInvitationEmail } from "@/lib/email/resend";
import { dbLogger, httpLogger } from "@/lib/logger";

export const runtime = "nodejs";

const SUPER_ADMIN_KEY = process.env.SUPER_ADMIN_KEY ?? "";
// Placeholder UUID for super-admin-created invitations (no real user involved)
const SYSTEM_INVITER_UUID = "00000000-0000-0000-0000-000000000000";

function authorized(req: Request): boolean {
  const key = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!key && key === SUPER_ADMIN_KEY;
}

/** POST /api/super-admin/members — invite a user to an existing org */
export async function POST(req: Request): Promise<Response> {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { orgId?: string; email?: string; role?: string };
  const { orgId, role = "admin" } = body;
  const email = body.email?.trim().toLowerCase();

  if (!orgId || !email) return Response.json({ error: "orgId y email son requeridos" }, { status: 400 });
  if (!["admin", "engineer", "viewer"].includes(role)) {
    return Response.json({ error: "Rol inválido" }, { status: 400 });
  }

  const client = getInsForgeAdminClient();

  const orgResult = await client.database
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .is("deleted_at", null)
    .single();

  if (!orgResult.data) return Response.json({ error: "Empresa no encontrada o deshabilitada" }, { status: 404 });
  const orgName = (orgResult.data as { name: string }).name;

  // Revoke any pending invitation for same email+org
  await client.database
    .from("organization_invitations")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("invited_email", email)
    .eq("status", "pending");

  const insertResult = await client.database
    .from("organization_invitations")
    .insert({
      organization_id: orgId,
      invited_by: SYSTEM_INVITER_UUID,
      invited_email: email,
      role,
    })
    .select("id, token")
    .single();

  if (insertResult.error) {
    dbLogger.error({ err: insertResult.error }, "super-admin/members insert error");
    return Response.json({ error: "Error al crear la invitación" }, { status: 500 });
  }

  const { token } = insertResult.data as { id: string; token: string };

  sendInvitationEmail({ toEmail: email, orgName, role, token }).catch((err: unknown) => {
    httpLogger.error({ err }, "super-admin/members email error");
  });

  return Response.json({ ok: true, token }, { status: 201 });
}
