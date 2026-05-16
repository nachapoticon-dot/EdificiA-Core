import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { verifyUserId, extractBearerToken } from "@/lib/auth/jwt";
import { apiUnauthorized, apiForbidden } from "@/lib/api/errors";

export interface AuthResult {
  userId: string;
  orgId: string;
  role: string;
  email: string | null;
}

export type AuthRole = "viewer" | "engineer" | "admin";

const ROLE_RANK: Record<AuthRole, number> = {
  viewer: 0,
  engineer: 1,
  admin: 2,
};

export function isAtLeast(role: string, minRole: AuthRole): boolean {
  const rank = ROLE_RANK[role as AuthRole];
  return rank !== undefined && rank >= ROLE_RANK[minRole];
}

/**
 * Validates the Bearer token and resolves the caller's org membership.
 * Returns AuthResult on success, or a 401/403 Response on failure.
 *
 * Honors the x-org-id header for multi-org users (org switcher).
 * Pass opts.role to enforce a required membership role.
 */
export async function requireAuth(
  req: Request,
  opts?: { role?: AuthRole },
): Promise<AuthResult | Response> {
  const token = extractBearerToken(req.headers.get("authorization") ?? "");
  if (!token) return apiUnauthorized();

  const userId = await verifyUserId(token);
  if (!userId) return apiUnauthorized("Token inválido o expirado.");

  try {
    const client = getInsForgeAdminClient();

    let q = client.database
      .from("organization_members")
      .select("organization_id, role, email")
      .eq("user_id", userId)
      .is("deleted_at", null);

    const requestedOrgId = req.headers.get("x-org-id");
    if (requestedOrgId) q = q.eq("organization_id", requestedOrgId);

    const result = await q.limit(1).single();
    const member = result.data as {
      organization_id: string;
      role: string;
      email: string | null;
    } | null;

    if (!member) return apiForbidden("No pertenecés a ninguna organización.");

    // Verify the organization is not disabled (BUG-3 fix)
    const orgResult = await client.database
      .from("organizations")
      .select("id")
      .eq("id", member.organization_id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!orgResult.data) return apiForbidden("La organización está deshabilitada.");

    if (opts?.role && !isAtLeast(member.role, opts.role)) {
      return apiForbidden(`Se requiere rol mínimo "${opts.role}".`);
    }

    return {
      userId,
      orgId: member.organization_id,
      role: member.role,
      email: member.email,
    };
  } catch {
    return apiUnauthorized();
  }
}
