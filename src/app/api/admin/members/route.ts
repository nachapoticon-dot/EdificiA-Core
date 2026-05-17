import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { sendInvitationEmail } from "@/lib/email/resend";
import { httpLogger } from "@/lib/logger";
import { adminInvitationCreatedResponseSchema, adminMembersResponseSchema, okResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAuth(req, { role: "admin" });
  if (auth instanceof Response) return auth;

  const client = getInsForgeAdminClient();

  const [membersResult, invitesResult] = await Promise.all([
    client.database
      .from("organization_members")
      .select("id, user_id, email, role, created_at")
      .eq("organization_id", auth.orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    client.database
      .from("organization_invitations")
      .select("id, invited_email, role, status, expires_at, created_at, token")
      .eq("organization_id", auth.orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  return Response.json(adminMembersResponseSchema.parse({
    members: membersResult.data ?? [],
    invitations: invitesResult.data ?? [],
  }));
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAuth(req, { role: "admin" });
  if (auth instanceof Response) return auth;

  const body = (await req.json()) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? "engineer";

  if (!email || !["admin", "engineer", "viewer"].includes(role)) {
    return Response.json({ error: "email and valid role required" }, { status: 400 });
  }

  const client = getInsForgeAdminClient();

  const orgResult = await client.database
    .from("organizations")
    .select("name")
    .eq("id", auth.orgId)
    .single();
  const orgName = (orgResult.data as { name?: string } | null)?.name ?? "tu empresa";

  await client.database
    .from("organization_invitations")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("organization_id", auth.orgId)
    .eq("invited_email", email)
    .eq("status", "pending");

  const insertResult = await client.database
    .from("organization_invitations")
    .insert({
      organization_id: auth.orgId,
      invited_by: auth.userId,
      invited_email: email,
      role,
    })
    .select("id, token")
    .single();

  if (insertResult.error) {
    return Response.json({ error: "Failed to create invitation" }, { status: 500 });
  }

  const { token } = insertResult.data as { id: string; token: string };

  sendInvitationEmail({ toEmail: email, orgName, role, token }).catch((err: unknown) => {
    httpLogger.error({ err }, "invite: failed to send invitation email");
  });

  return Response.json(adminInvitationCreatedResponseSchema.parse({ invitation: insertResult.data, emailSent: true }), { status: 201 });
}

export async function PATCH(req: Request): Promise<Response> {
  const auth = await requireAuth(req, { role: "admin" });
  if (auth instanceof Response) return auth;

  const body = (await req.json()) as { memberId?: string; newRole?: string };
  const { memberId, newRole } = body;

  if (!memberId || !newRole || !["admin", "engineer", "viewer"].includes(newRole)) {
    return Response.json({ error: "memberId and valid newRole required" }, { status: 400 });
  }

  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("organization_members")
    .update({ role: newRole })
    .eq("id", memberId)
    .eq("organization_id", auth.orgId)
    .is("deleted_at", null);

  if (result.error) return Response.json({ error: "Update failed" }, { status: 500 });
  return Response.json(okResponseSchema.parse({ ok: true }));
}

export async function DELETE(req: Request): Promise<Response> {
  const auth = await requireAuth(req, { role: "admin" });
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const memberId = url.searchParams.get("memberId");
  const invitationId = url.searchParams.get("invitationId");
  const client = getInsForgeAdminClient();

  if (memberId) {
    await client.database
      .from("organization_members")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", memberId)
      .eq("organization_id", auth.orgId)
      .neq("user_id", auth.userId); // can't revoke self
    return Response.json(okResponseSchema.parse({ ok: true }));
  }

  if (invitationId) {
    await client.database
      .from("organization_invitations")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("organization_id", auth.orgId);
    return Response.json(okResponseSchema.parse({ ok: true }));
  }

  return Response.json({ error: "memberId or invitationId required" }, { status: 400 });
}
