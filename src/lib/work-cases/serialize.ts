import type { WorkCaseStatus, WorkCaseVerdict } from "./types";

export const WORK_CASE_COLUMNS =
  "id, kind, status, title, summary, verdict, closed_by_user_id, closed_at, project_id, owner_user_id, created_at, updated_at";

export const LINKED_SESSION_COLUMNS = "id, title, file_type, started_at, work_case_id";

export interface WorkCaseRow {
  id: string;
  kind: string;
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

export interface LinkedSessionRow {
  id: string;
  title: string;
  file_type: string | null;
  started_at: number;
  work_case_id: string | null;
}

const FILE_TYPES = ["excel", "pdf", "dxf", "docx", "image"] as const;

export function toWorkCaseEntry(row: WorkCaseRow, session?: LinkedSessionRow | null) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    summary: row.summary,
    verdict: row.verdict,
    closedByUserId: row.closed_by_user_id,
    closedAt: row.closed_at,
    projectId: row.project_id,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    chatSessionId: session?.id ?? null,
    chatSessionTitle: session?.title ?? null,
    chatSessionFileType: FILE_TYPES.find((t) => t === session?.file_type) ?? null,
    chatSessionStartedAt: session?.started_at ?? null,
  };
}
