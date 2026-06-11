import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { dbLogger } from "@/lib/logger";

export const runtime = "nodejs";

/** DELETE /api/documents/[id] — removes a file from storage and PostgreSQL (chunks + vectores). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: fileId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.role === "viewer") return Response.json({ error: "Los visualizadores no pueden eliminar documentos." }, { status: 403 });

  try {
    const client = getInsForgeAdminClient();

    const fileResult = await client.database
      .from("uploaded_files")
      .select("id, storage_path")
      .eq("id", fileId)
      .eq("organization_id", auth.orgId)
      .limit(1)
      .single();

    const fileRow = fileResult.data as { id: string; storage_path: string } | null;
    if (!fileRow) return Response.json({ error: "File not found" }, { status: 404 });

    // El DELETE de document_chunks elimina también los embeddings (misma fila)
    await client.database
      .from("document_chunks")
      .delete()
      .eq("file_id", fileId)
      .eq("organization_id", auth.orgId);

    await client.database
      .from("uploaded_files")
      .delete()
      .eq("id", fileId)
      .eq("organization_id", auth.orgId);

    if (fileRow.storage_path) {
      await (client.storage.from("presupuestos").remove as unknown as (paths: string[]) => Promise<unknown>)([fileRow.storage_path]).catch(() => null);
    }

    return Response.json({ success: true });
  } catch (err) {
    dbLogger.error({ err }, "DELETE /api/documents/[id]");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
