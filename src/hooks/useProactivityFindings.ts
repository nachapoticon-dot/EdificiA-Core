"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/insforge/client";
import {
  proactivityFindingsResponseSchema,
  type ProactivityFindingsResponse,
} from "@/lib/validators/api-responses";

interface UseProactivityFindingsOptions {
  projectId?: string | null;
  enabled?: boolean;
}

export function useProactivityFindings(options: UseProactivityFindingsOptions = {}) {
  const projectId = options.projectId ?? null;
  return useQuery<ProactivityFindingsResponse>({
    queryKey: ["proactivity-findings", projectId ?? "all"],
    enabled: options.enabled ?? true,
    staleTime: 60_000,
    queryFn: async () => {
      const url = projectId
        ? `/api/proactivity/findings?projectId=${encodeURIComponent(projectId)}`
        : "/api/proactivity/findings";
      const res = await fetch(url, { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error("proactivity fetch failed");
      const parsed = proactivityFindingsResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("invalid proactivity response");
      return parsed.data;
    },
  });
}
