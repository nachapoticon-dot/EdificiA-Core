/** Tipos compartidos de dominio — reflejan el schema de la DB. */

// ── Branded IDs ────────────────────────────────────────────────────────────
export type TenantId      = string & { readonly __brand: "TenantId" };
export type UserId        = string & { readonly __brand: "UserId" };
export type ProjectId     = string & { readonly __brand: "ProjectId" };
export type FileId        = string & { readonly __brand: "FileId" };
export type SessionId     = string & { readonly __brand: "SessionId" };
export type MessageId     = string & { readonly __brand: "MessageId" };
export type InvitationId  = string & { readonly __brand: "InvitationId" };
export type AuditResultId = string & { readonly __brand: "AuditResultId" };

// ── Organización (tenant) ───────────────────────────────────────────────────
export interface Organization {
  id:         TenantId;
  name:       string;
  slug:       string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type MemberRole = "admin" | "engineer" | "viewer";

export interface OrganizationMember {
  id:              string;
  organization_id: TenantId;
  user_id:         UserId;
  role:            MemberRole;
  created_at:      string;
  deleted_at:      string | null;
}

// ── Proyecto de obra ────────────────────────────────────────────────────────
export type ProjectStatus = "active" | "archived" | "deleted";

export interface Project {
  id:              ProjectId;
  organization_id: TenantId;
  name:            string;
  description:     string | null;
  status:          ProjectStatus;
  created_by:      UserId;
  created_at:      string;
  updated_at:      string;
  deleted_at:      string | null;
}

// ── Archivos subidos ────────────────────────────────────────────────────────
export type FileType = "excel" | "pdf" | "word" | "image" | "other";

export type FileProcessingStatus = "pending" | "processing" | "ready" | "error";

export interface UploadedFile {
  id:                FileId;
  organization_id:   TenantId;
  project_id:        ProjectId | null;
  uploaded_by:       UserId;
  file_name:         string;
  file_type:         FileType;
  storage_path:      string;
  file_size_bytes:   number | null;
  processing_status: FileProcessingStatus;
  created_at:        string;
  deleted_at:        string | null;
}

// ── Sesión de auditoría ─────────────────────────────────────────────────────
export type SessionStatus = "active" | "completed" | "error";

export interface AuditSession {
  id:              SessionId;
  organization_id: TenantId;
  project_id:      ProjectId | null;
  file_id:         FileId | null;
  created_by:      UserId;
  title:           string | null;
  status:          SessionStatus;
  created_at:      string;
  updated_at:      string;
  deleted_at:      string | null;
}

// ── Mensajes del chat ───────────────────────────────────────────────────────
export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id:              MessageId;
  session_id:      SessionId;
  organization_id: TenantId;
  role:            MessageRole;
  content:         string;
  created_at:      string;
}

// ── Invitaciones a organización ─────────────────────────────────────────────
export type InvitationStatus = "pending" | "accepted" | "revoked";

export interface OrganizationInvitation {
  id:              InvitationId;
  organization_id: TenantId;
  invited_by:      UserId;
  invited_email:   string;
  role:            MemberRole;
  token:           string;
  status:          InvitationStatus;
  expires_at:      string;
  created_at:      string;
  updated_at:      string;
}

// ── Resultados de auditoría IA ────────────────────────────────────────────────
export type AuditResultType =
  | "quantity_check"
  | "budget_analysis"
  | "conformance_check"
  | "summary";

export interface AuditResult {
  id:              AuditResultId;
  session_id:      SessionId;
  organization_id: TenantId;
  file_id:         FileId | null;
  project_id:      ProjectId | null;
  result_type:     AuditResultType;
  payload:         Record<string, unknown>;
  created_by:      UserId;
  created_at:      string;
  updated_at:      string;
  deleted_at:      string | null;
}

// ── Auth user (InsForge) ────────────────────────────────────────────────────
export interface AuthUser {
  id:    UserId;
  email: string;
  name?: string;
}
