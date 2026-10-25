// Valores alineados con los CHECK de `work_cases` (migrations/). El CHECK de
// `kind` admite más valores; la aplicación solo crea estos.
export const WORK_CASE_KINDS = ["budget_audit", "document_audit", "general", "legacy_conversation"] as const;

export const WORK_CASE_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed", "archived"] as const;

export const WORK_CASE_VERDICTS = ["approved", "flagged", "inconclusive", "rejected", "superseded"] as const;

export type WorkCaseKind = (typeof WORK_CASE_KINDS)[number];
export type WorkCaseStatus = (typeof WORK_CASE_STATUSES)[number];
export type WorkCaseVerdict = (typeof WORK_CASE_VERDICTS)[number];

export const TERMINAL_STATUSES: readonly WorkCaseStatus[] = ["resolved", "closed", "archived"];

export const STATUS_LABELS: Record<WorkCaseStatus, string> = {
  open: "Abierto",
  in_progress: "En curso",
  waiting: "En espera",
  resolved: "Resuelto",
  closed: "Cerrado",
  archived: "Archivado",
};

export const VERDICT_LABELS: Record<WorkCaseVerdict, string> = {
  approved: "Aprobado",
  flagged: "Con observaciones",
  inconclusive: "Inconcluso",
  rejected: "Rechazado",
  superseded: "Reemplazado",
};

export const KIND_LABELS: Record<string, string> = {
  budget_audit: "Auditoría de presupuesto",
  document_audit: "Auditoría documental",
  general: "General",
  legacy_conversation: "Conversación previa",
};
