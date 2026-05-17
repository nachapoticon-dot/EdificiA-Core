import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { okResponseSchema, superAdminCompaniesResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

const SUPER_ADMIN_KEY = process.env.SUPER_ADMIN_KEY ?? "";

function authorized(req: Request): boolean {
  const key = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!key && key === SUPER_ADMIN_KEY;
}

interface OrgRow {
  id: string;
  name: string;
  created_at: string;
  deleted_at: string | null;
  storage_quota_bytes: number | null;
  subscription_status: string | null;
}

/** GET /api/super-admin/companies — list all orgs with stats */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const client = getInsForgeAdminClient();

  try {
    const { data: orgs, error } = await client.database
      .from("organizations")
      .select("id, name, created_at, deleted_at, storage_quota_bytes, subscription_status")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const orgList = (orgs ?? []) as OrgRow[];

    // Fetch member counts, project counts, and storage used per org in parallel
    const stats = await Promise.all(
      orgList.map(async (org) => {
        const [membersRes, projectsRes, storageRes] = await Promise.all([
          client.database
            .from("organization_members")
            .select("user_id")
            .eq("organization_id", org.id)
            .is("deleted_at", null),
          client.database
            .from("projects")
            .select("id")
            .eq("organization_id", org.id)
            .is("deleted_at", null),
          client.database
            .from("uploaded_files")
            .select("file_size_bytes")
            .eq("organization_id", org.id),
        ]);

        const files = (storageRes.data ?? []) as { file_size_bytes: number | null }[];
        const usedBytes = files.reduce((s, f) => s + (f.file_size_bytes ?? 0), 0);
        const quotaBytes = org.storage_quota_bytes ?? 5_368_709_120;

        return {
          id: org.id,
          name: org.name,
          createdAt: org.created_at,
          disabled: !!org.deleted_at,
          subscriptionStatus: org.subscription_status ?? "active",
          members: (membersRes.data ?? []).length,
          projects: (projectsRes.data ?? []).length,
          storage: {
            usedBytes,
            quotaBytes,
            pct: Math.min(100, Math.round((usedBytes / quotaBytes) * 100)),
          },
        };
      }),
    );

    return Response.json(superAdminCompaniesResponseSchema.parse({ companies: stats }));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

/** PATCH /api/super-admin/companies — toggle org disabled state or update subscription */
export async function PATCH(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { id: string; disabled?: boolean; subscriptionStatus?: string };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });

  const client = getInsForgeAdminClient();
  const updates: Record<string, unknown> = {};

  if (typeof body.disabled === "boolean") {
    updates.deleted_at = body.disabled ? new Date().toISOString() : null;
  }
  if (body.subscriptionStatus) {
    updates.subscription_status = body.subscriptionStatus;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await client.database
    .from("organizations")
    .update(updates)
    .eq("id", body.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(okResponseSchema.parse({ ok: true }));
}
