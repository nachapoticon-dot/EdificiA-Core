import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { verifyUserId, extractBearerToken, decodeClaims } from "@/lib/auth/jwt";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiRateLimited, apiUnauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

/**
 * POST /api/auth/claim-invitation
 *
 * Called after login to check if the authenticated user has a pending
 * member invitation (organization_invitations). If so, it adds the user
 * to the organization as a member and marks the invitation as accepted.
 *
 * This is the counterpart of claim-founder — it handles the case where
 * a super-admin or admin invited a user by email but the user already
 * had an InsForge account (so register returns 409).
 */
export async function POST(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "claim-invitation"), "auth")) {
    return apiRateLimited("Demasiados intentos. Esperá un minuto.");
  }

  const token = extractBearerToken(req.headers.get("authorization") ?? "");
  if (!token) return apiUnauthorized();

  const userId = await verifyUserId(token);
  if (!userId) return apiUnauthorized("Token inválido o expirado.");

  // Email comes from the verified JWT — prevents spoofing.
  const claims = decodeClaims(token);
  const email = claims?.email?.toLowerCase().trim();
  if (!email) {
    return Response.json({ error: "El JWT no contiene email. Volvé a iniciar sesión." }, { status: 400 });
  }

  const admin = getInsForgeAdminClient();

  // Find pending member invitations for this email
  const { data: invitations } = await admin.database
    .from("organization_invitations")
    .select("id, organization_id, role")
    .eq("invited_email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());

  if (!invitations || invitations.length === 0) {
    return Response.json({ claimed: false });
  }

  let claimed = 0;

  for (const rawInv of invitations) {
    const inv = rawInv as { id: string; organization_id: string; role: string };

    // Check if user is already a member of this org
    const { data: existingMember } = await admin.database
      .from("organization_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", inv.organization_id)
      .is("deleted_at", null)
      .limit(1);

    if ((existingMember ?? []).length > 0) {
      // Already a member — just mark invitation as accepted
      await admin.database
        .from("organization_invitations")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", inv.id);
      continue;
    }

    // Verify org is not disabled
    const { data: org } = await admin.database
      .from("organizations")
      .select("id")
      .eq("id", inv.organization_id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!org) continue; // org disabled — skip

    // Add user to org
    await admin.database.from("organization_members").insert({
      organization_id: inv.organization_id,
      user_id: userId,
      role: inv.role,
      email,
    });

    // Mark invitation as accepted
    await admin.database
      .from("organization_invitations")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", inv.id);

    claimed++;
  }

  return Response.json({ claimed, total: invitations.length });
}
