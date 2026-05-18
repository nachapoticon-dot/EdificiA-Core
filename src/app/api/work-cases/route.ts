import { requireAuth } from "@/lib/auth/require-auth";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { apiBadRequest, apiRateLimited } from "@/lib/api/errors";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getRequestLogger } from "@/lib/logger";
import { workCasesResponseSchema } from "@/lib/validators/api-responses";
import type { WorkCaseKind, WorkCaseStatus, WorkCaseVerdict } from "@/lib/agent-core";

export const runtime = "nodejs";

interface WorkCaseRow {
  id: string;
  kind: WorkCaseKind;
  status: WorkCaseStatus;
  title: string;
  summary: string | null;
  verdict: WorkCaseVerdict | null;
  closed_by_user_id: string | null;
  closed_at: string | null;
  project_id: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatSessionRow {
  id: string;
  title: string;
  file_type: string | null;
  started_at: number;
  work_case_id: string | null;
}

export async function GET(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "work-cases"), "standard")) return apiRateLimited();
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const log = getRequestLogger(req);
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 50);

  const client = getInsForgeAdminClient();

  if (projectId) {
    const projectCheck = await client.database
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("organization_id", auth.orgId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (projectCheck.error || !projectCheck.data) {
      return apiBadRequest("Obra inválida.");
    }
  }

  let query = client.database
    .from("work_cases")
    .select(
      "id, kind, status, title, summary, verdict, closed_by_user_id, closed_at, project_id, owner_user_id, created_at, updated_at",
    )
    .eq("organization_id", auth.orgId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (projectId) query = query.eq("project_id", projectId);

  const result = await query;
  if (result.error) {
    log.warn({ err: result.error, projectId }, "work cases query failed");
    return Response.json({ error: "No se pudieron leer los expedientes" }, { status: 500 });
  }

  const workCases = (result.data ?? []) as WorkCaseRow[];
  const workCaseIds = workCases.map((workCase) => workCase.id);
  const sessionByWorkCase = new Map<string, ChatSessionRow>();

  if (workCaseIds.length > 0) {
    const sessionsResult = await client.database
      .from("chat_sessions")
      .select("id, title, file_type, started_at, work_case_id")
      .eq("organization_id", auth.orgId)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .in("work_case_id", workCaseIds)
      .order("started_at", { ascending: false })
      .limit(workCaseIds.length);

    if (sessionsResult.error) {
      log.warn({ err: sessionsResult.error, projectId }, "work case sessions query failed");
    } else {
      for (const row of (sessionsResult.data ?? []) as ChatSessionRow[]) {
        if (row.work_case_id && !sessionByWorkCase.has(row.work_case_id)) {
          sessionByWorkCase.set(row.work_case_id, row);
        }
      }
    }
  }

  const response = {
    workCases: workCases.map((workCase) => {
      const session = sessionByWorkCase.get(workCase.id);
      return {
        id: workCase.id,
        kind: workCase.kind,
        status: workCase.status,
        title: workCase.title,
        summary: workCase.summary,
        verdict: workCase.verdict,
        closedByUserId: workCase.closed_by_user_id,
        closedAt: workCase.closed_at,
        projectId: workCase.project_id,
        ownerUserId: workCase.owner_user_id,
        createdAt: workCase.created_at,
        updatedAt: workCase.updated_at,
        chatSessionId: session?.id ?? null,
        chatSessionTitle: session?.title ?? null,
        chatSessionFileType: normalizeSessionFileType(session?.file_type ?? null) ?? null,
        chatSessionStartedAt: session?.started_at ?? null,
      };
    }),
  };

  return Response.json(workCasesResponseSchema.parse(response));
}

function normalizeSessionFileType(value: string | null): "excel" | "pdf" | "dxf" | "docx" | "image" | undefined {
  if (
    value === "excel" ||
    value === "pdf" ||
    value === "dxf" ||
    value === "docx" ||
    value === "image"
  ) {
    return value;
  }
  return undefined;
}
