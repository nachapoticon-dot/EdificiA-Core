import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiBadRequest, apiRateLimited } from "@/lib/api/errors";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getRequestLogger } from "@/lib/logger";
import { resolveOrgProjectId } from "@/lib/projects";
import {
  LINKED_SESSION_COLUMNS,
  WORK_CASE_COLUMNS,
  toWorkCaseEntry,
  type LinkedSessionRow,
  type WorkCaseRow,
} from "@/lib/work-cases/serialize";
import { workCasesResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

/** Expedientes de la organización, opcionalmente filtrados por obra (`?projectId=`). */
export async function GET(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "work-cases"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 50);

  if (projectId && !(await resolveOrgProjectId(auth.orgId, projectId))) {
    return apiBadRequest("Obra inválida.");
  }

  const client = getInsForgeAdminClient();
  let query = client.database
    .from("work_cases")
    .select(WORK_CASE_COLUMNS)
    .eq("organization_id", auth.orgId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (projectId) query = query.eq("project_id", projectId);

  const result = await query;
  if (result.error) {
    getRequestLogger(req).warn({ err: result.error, projectId }, "work cases query failed");
    return Response.json({ error: "No se pudieron leer los expedientes" }, { status: 500 });
  }

  const workCases = (result.data ?? []) as WorkCaseRow[];
  const sessionByWorkCase = new Map<string, LinkedSessionRow>();
  if (workCases.length > 0) {
    const sessions = await client.database
      .from("chat_sessions")
      .select(LINKED_SESSION_COLUMNS)
      .eq("organization_id", auth.orgId)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .in("work_case_id", workCases.map((w) => w.id))
      .order("started_at", { ascending: false });
    for (const row of (sessions.data ?? []) as LinkedSessionRow[]) {
      if (row.work_case_id && !sessionByWorkCase.has(row.work_case_id)) sessionByWorkCase.set(row.work_case_id, row);
    }
  }

  return Response.json(workCasesResponseSchema.parse({
    workCases: workCases.map((w) => toWorkCaseEntry(w, sessionByWorkCase.get(w.id))),
  }));
}
