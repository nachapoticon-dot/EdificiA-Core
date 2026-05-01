"use client";

import { useQuery } from "@tanstack/react-query";
import { getInsForgeClient } from "@/lib/insforge/client";

export interface ProjectFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number | null;
  created_at: string;
}

function getAuthHeaders(): Record<string, string> {
  const h = getInsForgeClient().getHttpClient().getHeaders() as Record<string, string>;
  return h["Authorization"] ? { Authorization: h["Authorization"] } : {};
}

export function useProjectFiles(projectId: string | null) {
  return useQuery<ProjectFile[]>({
    queryKey: ["project-files", projectId],
    enabled: Boolean(projectId),
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("files fetch failed");
      const json = (await res.json()) as { files: ProjectFile[] };
      return json.files ?? [];
    },
  });
}
