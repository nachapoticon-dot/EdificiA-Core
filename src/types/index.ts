/** Shared domain types used across both server and client code. */

// ─── Organizations ───────────────────────────────────────────────────────────

export interface OrgMember {
  userId: string;
  email: string | null;
  displayName: string | null;
  orgId: string;
  role: string;
  orgName: string;
  branding: {
    primaryColor: string;
    logoUrl: string | null;
    agentName: string;
  };
  stats: {
    activeProjects: number;
    memberCount: number;
  };
}

// ─── Projects ────────────────────────────────────────────────────────────────

export type ProjectStatus = "en_obra" | "planificacion" | "finalizado" | "pausado";

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface ProjectDetails {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  code: string | null;
  location: string | null;
  contract_amount: number | null;
  created_at: string;
  updated_at: string;
}

// ─── Project Operations ──────────────────────────────────────────────────────

export interface ProjectOperationRecord {
  id: string;
  organization_id: string;
  project_id: string;
  source_file_id?: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ProjectScheduleTaskStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled";

export interface ProjectScheduleTask extends ProjectOperationRecord {
  task_code: string | null;
  name: string;
  description: string | null;
  status: ProjectScheduleTaskStatus;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  progress_pct: number;
  predecessor_task_id: string | null;
}

export type ProjectFinancialSnapshotSource = "manual" | "import" | "agent" | "integration";

export interface ProjectFinancialSnapshot extends ProjectOperationRecord {
  snapshot_date: string;
  planned_amount: number | null;
  actual_amount: number | null;
  committed_amount: number | null;
  invoiced_amount: number | null;
  paid_amount: number | null;
  currency: string;
  source: ProjectFinancialSnapshotSource;
}

export type ProjectSubcontractStatus = "draft" | "active" | "paused" | "completed" | "terminated";

export interface ProjectSubcontract extends ProjectOperationRecord {
  vendor_name: string;
  trade: string | null;
  contract_amount: number | null;
  currency: string;
  status: ProjectSubcontractStatus;
  start_date: string | null;
  end_date: string | null;
  retention_pct: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

export type ProjectHseRecordType = "art" | "epp" | "training" | "medical" | "incident" | "access";
export type ProjectHseRecordStatus = "valid" | "expiring" | "expired" | "missing" | "incident";

export interface ProjectHseRecord extends Omit<ProjectOperationRecord, "source_file_id"> {
  subject_name: string | null;
  worker_identifier: string | null;
  subcontractor_name: string | null;
  record_type: ProjectHseRecordType;
  status: ProjectHseRecordStatus;
  issued_at: string | null;
  expires_at: string | null;
  document_file_id: string | null;
}

export type ProjectSupplyItemStatus =
  | "planned"
  | "quoted"
  | "ordered"
  | "partial"
  | "received"
  | "delayed"
  | "cancelled";

export interface ProjectSupplyItem extends ProjectOperationRecord {
  item_name: string;
  category: string | null;
  unit: string | null;
  required_quantity: number | null;
  ordered_quantity: number | null;
  received_quantity: number | null;
  unit_cost: number | null;
  currency: string;
  supplier_name: string | null;
  required_by: string | null;
  status: ProjectSupplyItemStatus;
}

// ─── Documents / Files ───────────────────────────────────────────────────────

export interface ProjectFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number | null;
  created_at: string;
}

export interface DocumentFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  processing_status: string;
  created_at: string;
  chunkCount: number;
  project_id?: string | null;
}

// ─── Audit / Sessions ────────────────────────────────────────────────────────

export interface AuditSession {
  id: string;
  label: string;
  fileType?: string;
  createdAt: number;
  projectId?: string | null;
}
