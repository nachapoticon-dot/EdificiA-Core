import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { apiForbidden } from "@/lib/api/errors";

export const runtime = "nodejs";

/** GET /api/documents — returns all uploaded files for the caller's organization. */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const client = getInsForgeAdminClient();

    const filesResult = await client.database
      .from("uploaded_files")
      .select("id, file_name, file_type, file_size_bytes, processing_status, storage_path, created_at, project_id")
      .eq("organization_id", auth.orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const files = (filesResult.data ?? []) as {
      id: string;
      file_name: string;
      file_type: string;
      file_size_bytes: number;
      processing_status: string;
      storage_path: string;
      created_at: string;
      project_id: string | null;
    }[];

    if (files.length === 0) return Response.json({ files: [] });

    const fileIds = files.map((f) => f.id);
    const chunksResult = await client.database
      .from("document_chunks")
      .select("file_id")
      .in("file_id", fileIds)
      .eq("organization_id", auth.orgId);

    const chunkCounts = new Map<string, number>();
    for (const row of (chunksResult.data ?? []) as { file_id: string }[]) {
      chunkCounts.set(row.file_id, (chunkCounts.get(row.file_id) ?? 0) + 1);
    }

    return Response.json({ files: files.map((f) => ({ ...f, chunkCount: chunkCounts.get(f.id) ?? 0 })) });
  } catch (err) {
    console.error("[GET /api/documents]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/** DELETE /api/documents?id=<fileId> — soft-delete only. */
export async function DELETE(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  if (auth.role !== "admin") return apiForbidden("Se requiere rol admin para eliminar archivos.");

  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("id");
  if (!fileId) return Response.json({ error: "id requerido" }, { status: 400 });

  try {
    const client = getInsForgeAdminClient();
    const result = await client.database
      .from("uploaded_files")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", fileId)
      .eq("organization_id", auth.orgId)
      .is("deleted_at", null);

    if (result.error) return Response.json({ error: "No se pudo eliminar el archivo" }, { status: 500 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/documents]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
