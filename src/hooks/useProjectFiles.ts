"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/insforge/client";

import type { ProjectFile } from "@/types";
export type { ProjectFile } from "@/types";

export function useProjectFiles(projectId: string | null) {
  return useQuery<ProjectFile[]>({
    queryKey: ["project-files", projectId],
    enabled: Boolean(projectId),
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) throw new Error("files fetch failed");
      const json = (await res.json()) as { files: ProjectFile[] };
      return json.files ?? [];
    },
  });
}
