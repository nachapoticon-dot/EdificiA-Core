import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";

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

    return Response.json({ files: result.data ?? [] });
  } catch (err) {
    console.error("[GET /api/projects/:id/files]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
