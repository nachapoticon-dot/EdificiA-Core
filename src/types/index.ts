/** Tipos compartidos de dominio — reflejan el schema de la DB. */

// ── Branded IDs ────────────────────────────────────────────────────────────
export type TenantId   = string & { readonly __brand: "TenantId" };
export type UserId     = string & { readonly __brand: "UserId" };
export type ProjectId  = string & { readonly __brand: "ProjectId" };
export type FileId     = string & { readonly __brand: "FileId" };
export type SessionId  = string & { readonly __brand: "SessionId" };
export type MessageId  = string & { readonly __brand: "MessageId" };

// ── Organización (tenant) ───────────────────────────────────────────────────
export interface Organization {
  id:         TenantId;
  name:       string;
  slug:       string;
  created_at: string;
}

export type MemberRole = "admin" | "engineer" | "viewer";

export interface OrganizationMember {
  id:              string;
  organization_id: TenantId;
  user_id:         UserId;
  role:            MemberRole;
  created_at:      string;
}

// ── Proyecto de obra ────────────────────────────────────────────────────────
export interface Project {
  id:              ProjectId;
  organization_id: TenantId;
  name:            string;
  description:     string | null;
  created_by:      UserId;
  created_at:      string;
  updated_at:      string;
}

// ── Archivos subidos ────────────────────────────────────────────────────────
export type FileType = "excel" | "pdf" | "word" | "image" | "other";

export interface UploadedFile {
  id:              FileId;
  organization_id: TenantId;
  project_id:      ProjectId | null;
  uploaded_by:     UserId;
  file_name:       string;
  file_type:       FileType;
  storage_path:    string;   // path dentro del bucket "legajos"
  file_size_bytes: number | null;
  created_at:      string;
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

// ── Auth user (InsForge) ────────────────────────────────────────────────────
export interface AuthUser {
  id:    UserId;
  email: string;
  name?: string;
}
