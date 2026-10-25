/** Tipos compartidos entre cliente y servidor. */

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

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface ProjectFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number | null;
  created_at: string;
}

