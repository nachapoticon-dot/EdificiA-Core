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

    // Fetch files + chunk count per file
    const filesResult = await client.database
      .from("uploaded_files")
      .select("id, file_name, file_type, file_size_bytes, processing_status, storage_path, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    const files = (filesResult.data ?? []) as {
      id: string;
      file_name: string;
      file_type: string;
      file_size_bytes: number;
      processing_status: string;
      storage_path: string;
      created_at: string;
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
