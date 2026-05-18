import type { getInsForgeAdminClient } from "@/lib/insforge/server";
import { linkLatestDocumentReportToWorkCase } from "@/lib/document-intelligence/report-linker";
import { dbLogger } from "@/lib/logger";
import type { WorkCaseKind } from "./types";

type AdminClient = ReturnType<typeof getInsForgeAdminClient>;

type ChatSessionFileType = "excel" | "pdf" | "dxf" | "docx" | "image";

const FILE_TYPE_TO_KIND: Record<ChatSessionFileType, WorkCaseKind> = {
  excel: "budget_audit",
  pdf: "document_audit",
  docx: "document_audit",
  dxf: "document_audit",
  image: "document_audit",
};

interface EnsureWorkCaseForChatSessionInput {
  client: AdminClient;
  organizationId: string;
  actorUserId: string;
  projectId: string;
  sessionId: string;
  title: string;
  fileType?: string | null;
}

/**
 * Crea (o retorna existente) un `work_case` asociado a una nueva chat_session.
 *
 * - Es backward-compatible: si la inserción falla por cualquier motivo, devuelve
 *   `null` y el caller debe seguir guardando la sesión sin expediente.
 * - Idempotencia: la responsabilidad de no llamar dos veces para la misma
 *   sesión vive en el caller (chequea `chat_sessions.work_case_id` antes).
 * - El expediente se crea con `metadata.chatSessionId` y un evento inicial
 *   `chat_session.linked` para trazabilidad.
 */
export async function ensureWorkCaseForChatSession(
  input: EnsureWorkCaseForChatSessionInput,
): Promise<string | null> {
  const kind = pickKindFromFileType(input.fileType);

  try {
    const insertResult = await input.client.database
      .from("work_cases")
      .insert({
        organization_id: input.organizationId,
        project_id: input.projectId,
        kind,
        status: "open",
        title: input.title,
        owner_user_id: input.actorUserId,
        created_by: input.actorUserId,
        metadata: {
          source: "chat_session",
          chatSessionId: input.sessionId,
          fileType: input.fileType ?? null,
        },
      })
      .select("id")
      .single();

    if (insertResult.error) {
      const err = insertResult.error as { message?: string; code?: string };
      dbLogger.warn(
        { code: err.code, message: err.message, sessionId: input.sessionId },
        "work_case insert failed",
      );
      return null;
    }

    const workCaseId = (insertResult.data as { id: string } | null)?.id ?? null;
    if (!workCaseId) return null;

    await input.client.database.from("work_case_events").insert({
      organization_id: input.organizationId,
      work_case_id: workCaseId,
      project_id: input.projectId,
      actor_user_id: input.actorUserId,
      event_type: "chat_session.linked",
      summary: input.title,
      payload: {
        chatSessionId: input.sessionId,
        fileType: input.fileType ?? null,
      },
    });

    await linkLatestDocumentReportToWorkCase({
      client: input.client,
      organizationId: input.organizationId,
      projectId: input.projectId,
      workCaseId,
      fileName: input.title,
    });

    return workCaseId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dbLogger.warn(
      { err: message, sessionId: input.sessionId },
      "work_case insert threw",
    );
    return null;
  }
}

function pickKindFromFileType(fileType?: string | null): WorkCaseKind {
  if (!fileType) return "general";
  return (FILE_TYPE_TO_KIND[fileType as ChatSessionFileType] ?? "general");
}
