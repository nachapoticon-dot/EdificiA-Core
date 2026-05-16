"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/insforge/client";

export interface ProjectDetails {
  id: string;
  name: string;
  description: string | null;
  status: "en_obra" | "planificacion" | "finalizado" | "pausado";
  code: string | null;
  location: string | null;
  contract_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface StorageStats {
  usedBytes: number;
  quotaBytes: number;
  pct: number;
}

export function useProjectDetails(projectId: string | null) {
  return useQuery<{ project: ProjectDetails; storage: StorageStats } | null>({
    queryKey: ["project-details", projectId],
    enabled: !!projectId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      if (!projectId) return null;
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return null;
      const res = await fetch(`/api/projects/${projectId}`, { headers });
      if (!res.ok) return null;
      return res.json() as Promise<{ project: ProjectDetails; storage: StorageStats }>;
    },
  });
}
