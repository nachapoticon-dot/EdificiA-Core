import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { sendInvitationEmail } from "@/lib/email/resend";
import { decodeUserId } from "@/lib/auth/jwt";

export const runtime = "nodejs";

// ── Shared auth helper ────────────────────────────────────────────────────────

async function requireAdmin(req: Request): Promise<{ userId: string; orgId: string } | Response> {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .is("deleted_at", null)
    .limit(1)
    .single();

  const member = result.data as { organization_id: string; role: string } | null;
  if (!member) return Response.json({ error: "Admin role required" }, { status: 403 });

  return { userId, orgId: member.organization_id };
}

// ── GET /api/admin/members — list members + pending invitations ───────────────

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
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

  return Response.json({
    members: membersResult.data ?? [],
    invitations: invitesResult.data ?? [],
  });
}

// ── POST /api/admin/members — create invitation ───────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const body = (await req.json()) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? "engineer";

  if (!email || !["admin", "engineer", "viewer"].includes(role)) {
    return Response.json({ error: "email and valid role required" }, { status: 400 });
  }

  const client = getInsForgeAdminClient();

  // Fetch org name for the email template
  const orgResult = await client.database
    .from("organizations")
    .select("name")
    .eq("id", auth.orgId)
    .single();
  const orgName = (orgResult.data as { name?: string } | null)?.name ?? "tu empresa";

  // Revoke any existing pending invite for this email in this org
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

  // Send invitation email — non-blocking: don't fail the request if email fails
  sendInvitationEmail({ toEmail: email, orgName, role, token }).catch((err: unknown) => {
    console.error("[invite] Failed to send invitation email:", err);
  });

  return Response.json({ invitation: insertResult.data, emailSent: true }, { status: 201 });
}

// ── PATCH /api/admin/members — change member role ─────────────────────────────

export async function PATCH(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
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
  return Response.json({ ok: true });
}

// ── DELETE /api/admin/members — revoke member or invitation ──────────────────

export async function DELETE(req: Request): Promise<Response> {
  const auth = await requireAdmin(req);
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
    return Response.json({ ok: true });
  }

  if (invitationId) {
    await client.database
      .from("organization_invitations")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("organization_id", auth.orgId);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "memberId or invitationId required" }, { status: 400 });
}
