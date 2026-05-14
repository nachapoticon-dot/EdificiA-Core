import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";

export const runtime = "nodejs";

/** GET /api/projects/[id] — fetch full project details + org storage stats */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

    const [projectResult, storageResult, quotaResult] = await Promise.all([
      client.database
        .from("projects")
        .select("id, name, description, status, code, location, contract_amount, created_at, updated_at")
        .eq("id", id)
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .single(),

      // Total storage used by org (sum of file sizes)
      client.database
        .from("uploaded_files")
        .select("file_size_bytes")
        .eq("organization_id", orgId),

      // Org storage quota
      client.database
        .from("organizations")
        .select("storage_quota_bytes")
        .eq("id", orgId)
        .single(),
    ]);

    if (projectResult.error || !projectResult.data) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const files = (storageResult.data ?? []) as { file_size_bytes: number | null }[];
    const usedBytes = files.reduce((s, f) => s + (f.file_size_bytes ?? 0), 0);
    const quotaBytes = ((quotaResult.data as { storage_quota_bytes?: number } | null)?.storage_quota_bytes) ?? 5_368_709_120;
    const storagePct = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));

    return Response.json({
      project: projectResult.data,
      storage: { usedBytes, quotaBytes, pct: storagePct },
    });
  } catch (err) {
    console.error("[GET /api/projects/:id]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

/** PATCH /api/projects/[id] — touch updated_at or update editable metadata */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

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
    if (member.role === "viewer") return Response.json({ error: "Sin permisos" }, { status: 403 });

    const orgId = member.organization_id;

    // Parse optional metadata fields from body
    let body: { name?: string; status?: string; code?: string; location?: string; contract_amount?: number | null } = {};
    try { body = (await req.json()) as typeof body; } catch { /* activation ping — no body */ }

    type ProjectUpdate = {
      updated_at: string;
      name?: string;
      status?: string;
      code?: string | null;
      location?: string | null;
      contract_amount?: number | null;
    };

    const patch: ProjectUpdate = { updated_at: new Date().toISOString() };
    if (body.name?.trim()) patch.name = body.name.trim().slice(0, 200);
    if (body.status && ["en_obra", "planificacion", "finalizado", "pausado"].includes(body.status)) {
      patch.status = body.status;
    }
    if ("code" in body) patch.code = body.code?.trim().slice(0, 80) ?? null;
    if ("location" in body) patch.location = body.location?.trim().slice(0, 200) ?? null;
    if ("contract_amount" in body) {
      const amt = body.contract_amount;
      patch.contract_amount = amt != null && isFinite(Number(amt)) ? Number(amt) : null;
    }

    const result = await client.database
      .from("projects")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select("id, name, status, code, location, contract_amount, created_at, updated_at")
      .single();

    if (result.error) throw result.error;
    return Response.json({ project: result.data });
  } catch (err) {
    console.error("[PATCH /api/projects/:id]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
