import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";

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

  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  try {
    const client = getInsForgeAdminClient();

    const memberResult = await client.database
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    const orgId = (memberResult.data as { organization_id: string } | null)?.organization_id;
    if (!orgId) return Response.json({ error: "No organization" }, { status: 403 });

    const result = await client.database
      .from("uploaded_files")
      .select("id, file_name, file_type, file_size_bytes, created_at")
      .eq("project_id", projectId)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    return Response.json({ files: result.data ?? [] });
  } catch (err) {
    console.error("[GET /api/projects/:id/files]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
