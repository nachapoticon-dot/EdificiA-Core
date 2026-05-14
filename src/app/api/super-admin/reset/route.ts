import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getQdrantClient, COLLECTION_NAME, EMBEDDING_DIM } from "@/lib/qdrant/client";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";

export const runtime = "nodejs";

function isAuthorized(req: Request): boolean {
  const secret = process.env.SUPER_ADMIN_KEY;
  if (!secret) return false;
  const auth = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  return auth === secret;
}

export async function POST(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "super-admin-reset"), { limit: 3, windowMs: 3_600_000 })) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!isAuthorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getInsForgeAdminClient().database;
  const log: string[] = [];

  // Borrar en orden: primero tablas hoja, luego raíz
  const tables = [
    "audit_results",
    "chat_messages",
    "chat_snapshots",
    "document_chunks",
    "project_phase_docs",
    "company_learned_patterns",
    "price_indices",
    "industry_benchmarks",
    "audit_sessions",
    "chat_sessions",
    "uploaded_files",
    "projects",
    "organization_invitations",
    "org_founder_invitations",
    "organization_members",
    "organizations",
  ];

  for (const table of tables) {
    try {
      // neq con UUID cero coincide con todas las filas reales
      await (db.from(table) as unknown as { delete: () => { neq: (col: string, val: string) => Promise<unknown> } })
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      log.push(`✓ ${table}`);
    } catch (err) {
      log.push(`✗ ${table}: ${String(err)}`);
    }
  }

  // Resetear colección Qdrant
  try {
    const qdrant = getQdrantClient();
    const { exists } = await qdrant.collectionExists(COLLECTION_NAME);
    if (exists) {
      await qdrant.deleteCollection(COLLECTION_NAME);
      log.push(`✓ qdrant: colección eliminada`);
    }
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
    });
    log.push(`✓ qdrant: colección recreada`);
  } catch (err) {
    log.push(`✗ qdrant: ${String(err)}`);
  }

  return Response.json({ ok: true, log });
}
