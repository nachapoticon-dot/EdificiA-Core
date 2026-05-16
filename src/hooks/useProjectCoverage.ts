"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/insforge/client";
import type { ProjectCoverageResult } from "@/lib/obra/coverage";

export function useProjectCoverage(projectId: string | null) {
  return useQuery<ProjectCoverageResult>({
    queryKey: ["project-coverage", projectId],
    enabled: Boolean(projectId),
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/coverage`, {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) throw new Error("coverage fetch failed");
      return res.json() as Promise<ProjectCoverageResult>;
    },
  });
}
