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
  status: string;
  code: string | null;
  location: string | null;
  contract_amount: number | null;
  created_at: string;
  updated_at: string;
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
