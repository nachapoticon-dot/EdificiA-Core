import type { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";
import type { WorkCaseKind } from "./types";

type AdminClient = ReturnType<typeof getInsForgeAdminClient>;

interface CreateWorkCaseInput {
  client: AdminClient;
  organizationId: string;
  actorUserId: string;
  projectId: string;
  sessionId: string;
  title: string;
  fileType?: string | null;
}

function kindForFileType(fileType?: string | null): WorkCaseKind {
  if (fileType === "excel") return "budget_audit";
  if (fileType) return "document_audit";
  return "general";
}

/**
 * Abre un expediente para una sesión de chat nueva dentro de una obra.
 * Devuelve `null` si falla: la sesión se guarda igual, sin expediente.
 */
export async function createWorkCaseForChatSession(input: CreateWorkCaseInput): Promise<string | null> {
  const inserted = await input.client.database
    .from("work_cases")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      kind: kindForFileType(input.fileType),
      status: "open",
      title: input.title,
      owner_user_id: input.actorUserId,
      created_by: input.actorUserId,
      metadata: { source: "chat_session", chatSessionId: input.sessionId, fileType: input.fileType ?? null },
    })
    .select("id")
    .single();

  const workCaseId = (inserted.data as { id: string } | null)?.id ?? null;
  if (inserted.error || !workCaseId) {
    dbLogger.warn({ err: inserted.error, sessionId: input.sessionId }, "work_case insert failed");
    return null;
  }

  await input.client.database.from("work_case_events").insert({
    organization_id: input.organizationId,
    work_case_id: workCaseId,
    project_id: input.projectId,
    actor_user_id: input.actorUserId,
    event_type: "chat_session.linked",
    summary: input.title,
    payload: { chatSessionId: input.sessionId, fileType: input.fileType ?? null },
  });

  return workCaseId;
}
