import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { dbLogger } from "@/lib/logger";
import { documentsResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

/** Archivos subidos por la organización, con su estado de indexación y cantidad de fragmentos. */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const client = getInsForgeAdminClient();

    const filesResult = await client.database
      .from("uploaded_files")
      .select("id, file_name, file_type, file_size_bytes, processing_status, indexing_status, indexing_error, indexed_at, storage_path, created_at, project_id")
      .eq("organization_id", auth.orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const files = (filesResult.data ?? []) as {
      id: string;
      file_name: string;
      file_type: string;
      file_size_bytes: number;
      processing_status: string;
      indexing_status: string | null;
      indexing_error: string | null;
      indexed_at: string | null;
      storage_path: string;
      created_at: string;
      project_id: string | null;
    }[];

    if (files.length === 0) return Response.json(documentsResponseSchema.parse({ files: [] }));

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

    const body = { files: files.map((f) => ({ ...f, chunkCount: chunkCounts.get(f.id) ?? 0 })) };
    return Response.json(documentsResponseSchema.parse(body));
  } catch (err) {
    dbLogger.error({ err }, "GET /api/documents");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
