import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";

export const runtime = "nodejs";

/** GET /api/documents — returns all uploaded files for the caller's organization. */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  try {
    const client = getInsForgeAdminClient();

    // Resolve organization
    const memberResult = await client.database
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    const orgId = (memberResult.data as { organization_id: string } | null)?.organization_id;
    if (!orgId) return Response.json({ error: "No organization" }, { status: 403 });

    // Fetch files + chunk count per file (exclude soft-deleted)
    const filesResult = await client.database
      .from("uploaded_files")
      .select("id, file_name, file_type, file_size_bytes, processing_status, storage_path, created_at, project_id")
      .eq("organization_id", orgId)
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

    if (files.length === 0) {
      return Response.json({ files: [] });
    }

    // Get chunk counts in one query
    const fileIds = files.map((f) => f.id);
    const chunksResult = await client.database
      .from("document_chunks")
      .select("file_id")
      .in("file_id", fileIds)
      .eq("organization_id", orgId);

    const chunkCounts = new Map<string, number>();
    for (const row of (chunksResult.data ?? []) as { file_id: string }[]) {
      chunkCounts.set(row.file_id, (chunkCounts.get(row.file_id) ?? 0) + 1);
    }

    const enriched = files.map((f) => ({
      ...f,
      chunkCount: chunkCounts.get(f.id) ?? 0,
    }));

    return Response.json({ files: enriched });
  } catch (err) {
    console.error("[GET /api/documents]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/** DELETE /api/documents?id=<fileId> — soft-delete only. Files are never permanently removed. */
export async function DELETE(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("id");
  if (!fileId) return Response.json({ error: "id requerido" }, { status: 400 });

  try {
    const client = getInsForgeAdminClient();

    const memberResult = await client.database
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    const member = memberResult.data as { organization_id: string; role: string } | null;
    if (!member) return Response.json({ error: "No organization" }, { status: 403 });

    // Only admins can delete files
    if (member.role !== "admin") {
      return Response.json({ error: "Se requiere rol admin para eliminar archivos" }, { status: 403 });
    }

    const result = await client.database
      .from("uploaded_files")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", fileId)
      .eq("organization_id", member.organization_id)
      .is("deleted_at", null);

    if (result.error) return Response.json({ error: "No se pudo eliminar el archivo" }, { status: 500 });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/documents]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
