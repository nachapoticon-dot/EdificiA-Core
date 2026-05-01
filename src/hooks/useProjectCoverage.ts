"use client";

import { useQuery } from "@tanstack/react-query";
import { getInsForgeClient } from "@/lib/insforge/client";
import type { ProjectCoverageResult } from "@/lib/obra/coverage";

function getAuthHeaders(): Record<string, string> {
  const h = getInsForgeClient().getHttpClient().getHeaders() as Record<string, string>;
  return h["Authorization"] ? { Authorization: h["Authorization"] } : {};
}

export function useProjectCoverage(projectId: string | null) {
  return useQuery<ProjectCoverageResult>({
    queryKey: ["project-coverage", projectId],
    enabled: Boolean(projectId),
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/coverage`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("coverage fetch failed");
      return res.json() as Promise<ProjectCoverageResult>;
    },
  });
}
