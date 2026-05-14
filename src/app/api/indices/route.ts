import { requireAuth } from "@/lib/auth/require-auth";
import { getAllIndicesByCategory, insertPriceIndices } from "@/lib/indices/query";
import type { PriceIndexRow } from "@/lib/indices/query";

export const runtime = "nodejs";

/** GET /api/indices — list all active indices for the caller's org (+ global) */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const indices = await getAllIndicesByCategory(auth.orgId);
    return Response.json({ indices });
  } catch (err) {
    console.error("[GET /api/indices]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST /api/indices — batch insert one or more price index rows */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = (await req.json()) as { rows: Omit<PriceIndexRow, "id" | "created_at">[] };
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return Response.json({ error: "rows array is required" }, { status: 400 });
  }

  try {
    const sanitized = body.rows.map((r) => ({
      ...r,
      organization_id: auth.orgId,
      uploaded_by: auth.userId,
    }));
    const count = await insertPriceIndices(sanitized);
    return Response.json({ inserted: count }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/indices]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
