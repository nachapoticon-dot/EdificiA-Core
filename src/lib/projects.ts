import { getInsForgeAdminClient } from "@/lib/insforge/server";

/** Devuelve `projectId` si la obra existe y pertenece a la organización; si no, `null`. */
export async function resolveOrgProjectId(orgId: string, projectId: string | null | undefined): Promise<string | null> {
  if (!projectId) return null;
  const result = await getInsForgeAdminClient()
    .database.from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  return result.data ? projectId : null;
}
