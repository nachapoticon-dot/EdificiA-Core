import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { dbLogger } from "@/lib/logger";
import { projectFilesResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

export interface ProjectFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number | null;
  created_at: string;
}

/** GET /api/projects/[id]/files — list uploaded files for a project */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const client = getInsForgeAdminClient();
    const result = await client.database
      .from("uploaded_files")
      .select("id, file_name, file_type, file_size_bytes, created_at")
      .eq("project_id", projectId)
      .eq("organization_id", auth.orgId)
      .order("created_at", { ascending: false });

    return Response.json(projectFilesResponseSchema.parse({ files: result.data ?? [] }));
  } catch (err) {
    dbLogger.error({ err }, "GET /api/projects/:id/files");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
