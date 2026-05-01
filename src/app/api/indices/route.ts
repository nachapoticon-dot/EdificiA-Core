import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";
import { getAllIndicesByCategory, insertPriceIndices } from "@/lib/indices/query";
import type { PriceIndexRow } from "@/lib/indices/query";

export const runtime = "nodejs";

async function resolveOrgId(userId: string): Promise<string | null> {
  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .single();
  return (result.data as { organization_id: string } | null)?.organization_id ?? null;
}

/** GET /api/indices — list all active indices for the caller's org (+ global) */
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  try {
    const orgId = await resolveOrgId(userId);
    if (!orgId) return Response.json({ error: "No organization" }, { status: 403 });

    const indices = await getAllIndicesByCategory(orgId);
    return Response.json({ indices });
  } catch (err) {
    console.error("[GET /api/indices]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST /api/indices — batch insert one or more price index rows */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  const body = (await req.json()) as {
    rows: Omit<PriceIndexRow, "id" | "created_at">[];
  };

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return Response.json({ error: "rows array is required" }, { status: 400 });
  }

  try {
    const orgId = await resolveOrgId(userId);
    if (!orgId) return Response.json({ error: "No organization" }, { status: 403 });

    // Security: force organization_id to the caller's org — prevent cross-org injection
    const sanitized = body.rows.map(r => ({ ...r, organization_id: orgId, uploaded_by: userId }));
    const count = await insertPriceIndices(sanitized);
    return Response.json({ inserted: count }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/indices]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
