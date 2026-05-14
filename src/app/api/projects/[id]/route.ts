import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { apiForbidden } from "@/lib/api/errors";

export const runtime = "nodejs";

/** GET /api/projects/[id] — fetch full project details + org storage stats */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const client = getInsForgeAdminClient();

    const [projectResult, storageResult, quotaResult] = await Promise.all([
      client.database
        .from("projects")
        .select("id, name, description, status, code, location, contract_amount, created_at, updated_at")
        .eq("id", id)
        .eq("organization_id", auth.orgId)
        .is("deleted_at", null)
        .single(),

      client.database
        .from("uploaded_files")
        .select("file_size_bytes")
        .eq("organization_id", auth.orgId),

      client.database
        .from("organizations")
        .select("storage_quota_bytes")
        .eq("id", auth.orgId)
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
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  if (auth.role === "viewer") return apiForbidden("Sin permisos.");

  try {
    const client = getInsForgeAdminClient();

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
      .eq("organization_id", auth.orgId)
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
