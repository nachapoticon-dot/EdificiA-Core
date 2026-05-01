import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getQdrantClient, COLLECTION_NAME, isQdrantConfigured } from "@/lib/qdrant/client";
import { decodeUserId } from "@/lib/auth/jwt";

export const runtime = "nodejs";

/** DELETE /api/documents/[id] — removes a file from storage, Qdrant, and PostgreSQL. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: fileId } = await params;

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  try {
    const client = getInsForgeAdminClient();

    // Resolve org and verify ownership
    const memberResult = await client.database
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    const orgId = (memberResult.data as { organization_id: string } | null)?.organization_id;
    if (!orgId) return Response.json({ error: "No organization" }, { status: 403 });

    // Confirm the file belongs to this org
    const fileResult = await client.database
      .from("uploaded_files")
      .select("id, storage_path")
      .eq("id", fileId)
      .eq("organization_id", orgId)
      .limit(1)
      .single();

    const fileRow = fileResult.data as { id: string; storage_path: string } | null;
    if (!fileRow) return Response.json({ error: "File not found" }, { status: 404 });

    // Collect Qdrant IDs before deleting chunks
    const chunksResult = await client.database
      .from("document_chunks")
      .select("qdrant_id")
      .eq("file_id", fileId)
      .eq("organization_id", orgId)
      .not("qdrant_id", "is", null);

    const qdrantIds = ((chunksResult.data ?? []) as { qdrant_id: string | null }[])
      .map((r) => r.qdrant_id)
      .filter((id): id is string => id !== null);

    // Delete from Qdrant
    if (qdrantIds.length > 0 && isQdrantConfigured()) {
      await getQdrantClient().delete(COLLECTION_NAME, { points: qdrantIds }).catch(() => null);
    }

    // Delete chunks from PostgreSQL
    await client.database
      .from("document_chunks")
      .delete()
      .eq("file_id", fileId)
      .eq("organization_id", orgId);

    // Delete file record
    await client.database
      .from("uploaded_files")
      .delete()
      .eq("id", fileId)
      .eq("organization_id", orgId);

    // Delete from storage (best-effort)
    if (fileRow.storage_path) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client.storage.from("presupuestos").remove as unknown as (paths: string[]) => Promise<unknown>)([fileRow.storage_path]).catch(() => null);
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/documents/[id]]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
